import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import crypto from 'crypto';

import { insertRun, updateRun, insertLead, updateLead, getLeadStatusCounts, getLeadByEmail } from './db.js';
import { parseLeadsCSV } from './csv.js';
import { launchBrowser, closeBrowser, scrapeLead } from './scraper.js';
import { profileLead } from './profiler.js';
import { draftEmail } from './drafter.js';
import { postDraftToGChat, pollForApproval } from './gchat.js';
import { sendEmail } from './sender.js';
import { emit, emitLog, toCamelCase } from './emitter.js';
import { approvalBus } from './approvalBus.js';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let runStopped = false;

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Load and parse config.yaml
 * @returns {object}
 */
export function loadConfig() {
  const configPath = join(__dirname, '..', 'config.yaml');
  const raw = readFileSync(configPath, 'utf-8');
  return yaml.load(raw);
}

/**
 * Signal the current run to stop
 */
export function stopRun() {
  runStopped = true;
  logger.info({ module: 'runner' }, 'Stop signal received');
}

/**
 * Retry a stage function up to maxRetries times with a delay between retries.
 * @param {Function} fn - async function to retry
 * @param {number} maxRetries
 * @param {number} delayMs
 * @param {string} stageName - for logging
 * @returns {Promise<any>}
 */
async function withRetry(fn, maxRetries, delayMs, stageName) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      logger.warn({ module: 'runner', stage: stageName, attempt: attempt + 1 },
        `${stageName} attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < maxRetries - 1) {
        await sleep(delayMs);
      }
    }
  }
  throw lastErr;
}

/**
 * Run the full pipeline
 * @param {object} config - merged configuration
 * @param {string} runId
 * @param {object[]|null} preloadedLeads - optional uploaded leads (skips CSV read)
 * @returns {Promise<object>} RunSummary
 */
export async function runPipeline(config, runId, preloadedLeads = null) {
  runStopped = false;

  // STEP 0 - Setup
  insertRun({
    id:              runId,
    started_at:      new Date().toISOString(),
    status:          'running',
    region:          config.region || null,
    industry:        config.industry || null,
    leads_count:     0,
    config_snapshot: JSON.stringify(config)
  });

  emit('run:started', { runId, config });
  emitLog(runId, 'system', '--- Run started ---');

  const leadsSource = preloadedLeads ? 'uploaded_csv' : (config.run?.leads_source || 'csv');
  emitLog(runId, 'info',
    `Source: ${leadsSource} | Leads: ${config.run?.leads_per_run || 10} | Dry run: ${config.run?.dry_run}`);

  let browserLaunched = false;

  try {
    // Launch browser
    try {
      await launchBrowser();
      browserLaunched = true;
    } catch (err) {
      emitLog(runId, 'warn', `Browser launch failed: ${err.message} — scraping will be skipped`);
      logger.warn({ module: 'runner', runId }, `Browser launch failed: ${err.message}`);
    }

    // STEP 1 - Load leads: prefer uploaded leads, fallback to CSV file
    const leadsPerRun = config.run?.leads_per_run || 10;
    let allLeads;

    if (preloadedLeads && preloadedLeads.length > 0) {
      // Use uploaded leads — filter out emails already in DB
      allLeads = [];
      for (const lead of preloadedLeads) {
        try {
          if (getLeadByEmail(lead.email)) {
            logger.info({ module: 'runner', email: lead.email }, `Skipped ${lead.email}: already in database`);
            continue;
          }
        } catch (_) {}
        allLeads.push(lead);
      }
      emitLog(runId, 'info', `Using ${allLeads.length} uploaded leads (${preloadedLeads.length - allLeads.length} skipped as duplicates)`);
    } else {
      const csvPath = join(__dirname, '..', config.run?.csv_path || './data/leads.csv');
      allLeads = parseLeadsCSV(csvPath);
      emitLog(runId, 'info', `Loaded leads from default CSV: ${csvPath}`);
    }

    const leads = allLeads.slice(0, leadsPerRun);

    if (leads.length === 0) {
      emitLog(runId, 'warn', 'No new leads found in CSV. Add leads to data/leads.csv');
      return finishRun(runId, 'complete');
    }

    // Insert leads into DB
    for (const lead of leads) {
      lead.run_id = runId;
      try {
        insertLead(lead);
        emit('lead:added', toCamelCase({ ...lead, progress: 0, stepLabel: 'Queued' }));
      } catch (err) {
        logger.warn({ module: 'runner', leadId: lead.id }, `Failed to insert lead: ${err.message}`);
      }
    }

    updateRun(runId, { leads_count: leads.length });
    emitLog(runId, 'success', `Loaded ${leads.length} leads from CSV`);
    emitStatsUpdate(runId);

    // STEP 2 — Process leads in PARALLEL (scrape → profile → draft).
    // Each lead runs independently and stops at status="drafted"; the user
    // then explicitly clicks "Approve & Send" in the UI to actually send.
    emitLog(runId, 'info', `Processing ${leads.length} leads in parallel...`);

    const leadPromises = leads.map((lead) =>
      processLead(lead, config, runId).catch((err) => {
        // Final safety net — processLead already catches internally, but isolate here too
        logger.error(
          { module: 'runner', runId, leadId: lead.id },
          `Unexpected error for ${lead.full_name}: ${err.message}`
        );
        emitLog(
          runId, 'error',
          `Unexpected error for ${lead.full_name}: ${err.message}`,
          null, lead.id
        );
        try {
          updateLead(lead.id, { status: 'send_failed', skip_reason: err.message });
          emit('lead:updated', toCamelCase({ id: lead.id, status: 'send_failed', stepLabel: 'Error' }));
        } catch (_) {}
      })
    );

    // Wait for all leads to finish drafting (they do NOT await approval).
    await Promise.all(leadPromises);

    // STEP 3 - Finalize
    return finishRun(runId, runStopped ? 'stopped' : 'complete');
  } catch (err) {
    logger.error({ module: 'runner', runId }, `Pipeline error: ${err.message}`);
    emitLog(runId, 'error', `Pipeline error: ${err.message}`);
    return finishRun(runId, 'error');
  } finally {
    if (browserLaunched) {
      try { await closeBrowser(); } catch (_) {}
    }
  }
}

/**
 * Process a single lead through all pipeline stages.
 * Catches and isolates errors at each stage so one failure doesn't kill others.
 * @param {object} lead
 * @param {object} config
 * @param {string} runId
 */
async function processLead(lead, config, runId) {
  const fitThreshold = config.run?.fit_score_threshold ?? config.claude?.fit_score_threshold ?? 6;

  try {
    // ── Stage A: Scraping ──────────────────────────────────────────────────
    emitLeadUpdate(lead, { status: 'scraping', progress: 20, stepLabel: 'Scraping LinkedIn + website...' });
    emitLog(runId, 'info', `Scraping ${lead.full_name} at ${lead.company}`, lead.company, lead.id);

    let scraped = { linkedinText: null, websiteText: null, scrapedAt: new Date().toISOString(), errors: [] };
    try {
      scraped = await withRetry(
        () => scrapeLead(lead, config),
        2, 3000, 'scrape'
      );
      if (scraped.errors.length > 0) {
        emitLog(runId, 'warn', `Scrape partial: ${scraped.errors.join(', ')}`, null, lead.id);
      }
    } catch (err) {
      emitLog(runId, 'warn', `Scrape failed (continuing with empty data): ${err.message}`, null, lead.id);
    }

    emitLeadUpdate(lead, { progress: 35, stepLabel: 'Scrape complete' });

    // ── Stage B: Profiling ─────────────────────────────────────────────────
    emitLeadUpdate(lead, { status: 'profiling', progress: 50, stepLabel: 'Profiling with AI...' });
    emitLog(runId, 'info', `Profiling ${lead.full_name}...`, lead.full_name, lead.id);

    let profile;
    try {
      profile = await withRetry(
        () => profileLead(lead, scraped, config),
        1, 3000, 'profile'
      );
    } catch (err) {
      emitLog(runId, 'warn', `Profiling failed: ${err.message} — using defaults`, null, lead.id);
      profile = {
        what_they_do: 'Unknown', what_they_are_building: 'Unknown',
        likely_pain_points: [], recent_signals: 'None',
        personalisation_hook: '', fit_score: 0, fit_reason: 'Profiling failed'
      };
    }

    // Fit score check
    if (profile.fit_score < fitThreshold) {
      emitLeadUpdate(lead, {
        status:    'low-fit',
        progress:  100,
        fit_score: profile.fit_score,
        fit_reason:profile.fit_reason,
        stepLabel: `Low fit (${profile.fit_score}/10) — skipped`
      });
      emitLog(runId, 'warn',
        `Low fit ${profile.fit_score}/10: ${lead.full_name} — ${profile.fit_reason}`,
        lead.full_name, lead.id);
      emitStatsUpdate(runId);
      return;
    }

    emitLeadUpdate(lead, {
      progress:      65,
      fit_score:     profile.fit_score,
      fit_reason:    profile.fit_reason,
      pain_points:   JSON.stringify(profile.likely_pain_points || []),
      recent_signal: profile.recent_signals,
      hook:          profile.personalisation_hook,
      stepLabel:     `Profile built — fit ${profile.fit_score}/10`
    });
    emitLog(runId, 'success', `Profile built: fit ${profile.fit_score}/10`, null, lead.id);

    // ── Stage C: Draft only (parallel-safe — does NOT wait for approval) ─
    // After drafting, status becomes "drafted". The user approves from the UI,
    // which hits POST /api/action/send to actually dispatch the email.
    await draftOnly(lead, profile, config, runId);

  } catch (err) {
    // Final catch for the whole lead
    logger.error({ module: 'runner', leadId: lead.id }, `processLead error: ${err.message}`);
    try {
      updateLead(lead.id, { status: 'send_failed', skip_reason: err.message });
      emit('lead:updated', toCamelCase({ id: lead.id, status: 'send_failed', stepLabel: `Error: ${err.message}` }));
      emitLog(runId, 'error', `Failed: ${lead.full_name} — ${err.message}`, null, lead.id);
      emitStatsUpdate(runId);
    } catch (_) {}
  }
}

/**
 * Draft, post to GChat, and handle approval (with rewrite loop).
 * @param {object} lead
 * @param {object} profile
 * @param {object} config
 * @param {string} runId
 * @param {string|null} rewriteNote
 */
async function draftAndApproveLoop(lead, profile, config, runId, rewriteNote) {
  const maxRewrites = 3;
  if (lead.rewrite_count === undefined || lead.rewrite_count === null) {
    lead.rewrite_count = 0;
  }

  while (lead.rewrite_count <= maxRewrites) {
    // ── Drafting ────────────────────────────────────────────────────────
    emitLeadUpdate(lead, { status: 'drafting', progress: 75, stepLabel: 'Drafting email with AI...' });
    emitLog(runId, 'info', `Drafting email for ${lead.full_name}...`, lead.full_name, lead.id);

    let draft;
    try {
      draft = await withRetry(
        () => draftEmail(lead, profile, config, rewriteNote),
        1, 3000, 'draft'
      );
    } catch (err) {
      emitLog(runId, 'error', `Drafting failed: ${err.message}`, null, lead.id);
      emitLeadUpdate(lead, {
        status:    'skipped',
        progress:  100,
        skip_reason: `Draft failed: ${err.message}`,
        stepLabel: 'Draft failed — skipped'
      });
      emitStatsUpdate(runId);
      return;
    }

    emitLeadUpdate(lead, {
      draft_subject: draft.subject,
      draft_body:    draft.body,
      progress:      85,
      stepLabel:     'Draft ready'
    });
    emitLog(runId, 'success', `Draft ready for ${lead.full_name}`, lead.full_name, lead.id);

    // ── GChat post ───────────────────────────────────────────────────────
    const gchatConfigured = !!process.env.GCHAT_WEBHOOK_URL;
    if (gchatConfigured && !config.run?.dry_run) {
      try {
        await postDraftToGChat(lead, profile, draft);
        emitLog(runId, 'info', 'Draft sent to GChat for approval', null, lead.id);
      } catch (_) {
        emitLog(runId, 'warn', 'GChat post failed — waiting for dashboard approval instead', null, lead.id);
      }
    }

    emitLeadUpdate(lead, { status: 'pending', progress: 90, stepLabel: 'Awaiting approval on dashboard' });
    emit('approval:required', { leadId: lead.id });
    emitStatsUpdate(runId);

    // ── Wait for approval ────────────────────────────────────────────────
    let approval;
    try {
      if (gchatConfigured && !config.run?.dry_run) {
        emitLog(runId, 'info', 'Waiting for approval via dashboard or GChat...', null, lead.id);
        approval = await pollForApproval(lead, config);
      } else {
        emitLog(runId, 'info', 'Waiting for approval on dashboard...', null, lead.id);
        approval = await waitForDashboardApproval(lead, config);
      }
    } catch (err) {
      emitLog(runId, 'error', `Approval wait error: ${err.message}`, null, lead.id);
      approval = { action: 'skip', rewriteNote: 'Approval error' };
    }

    // ── Handle decision ──────────────────────────────────────────────────
    if (approval.action === 'approve') {
      if (!config.run?.dry_run) {
        emitLeadUpdate(lead, { status: 'approved', stepLabel: 'Approved — sending...' });

        let sendResult;
        try {
          sendResult = await sendEmail(lead, draft, config);
        } catch (err) {
          sendResult = { success: false, error: err.message };
        }

        if (sendResult.success) {
          emitLeadUpdate(lead, {
            status:    'sent',
            progress:  100,
            sent_at:   new Date().toISOString(),
            stepLabel: 'Email sent'
          });
          emitLog(runId, 'success', `Email sent to ${lead.full_name} at ${lead.company}`, lead.company, lead.id);
        } else {
          emitLeadUpdate(lead, { status: 'send_failed', stepLabel: `Send failed: ${sendResult.error}` });
          emitLog(runId, 'error', `Send failed: ${sendResult.error}`, null, lead.id);
        }
      } else {
        emitLeadUpdate(lead, { status: 'sent', progress: 100, stepLabel: '[DRY RUN] Would have sent' });
        emitLog(runId, 'warn', '[DRY RUN] Approved — not actually sent', null, lead.id);
      }
      emitStatsUpdate(runId);
      return;
    }

    if (approval.action === 'rewrite') {
      lead.rewrite_count = (lead.rewrite_count || 0) + 1;
      if (lead.rewrite_count > maxRewrites) {
        emitLeadUpdate(lead, {
          status:      'skipped',
          progress:    100,
          skip_reason: 'max_rewrites_reached',
          stepLabel:   'Skipped (max rewrites)'
        });
        emitLog(runId, 'warn', `Max rewrites reached for ${lead.full_name}`, lead.full_name, lead.id);
        emitStatsUpdate(runId);
        return;
      }
      emitLeadUpdate(lead, {
        status:        'rewriting',
        stepLabel:     'Rewriting with AI...',
        rewrite_count: lead.rewrite_count
      });
      emitLog(runId, 'info', `Rewriting for ${lead.full_name}: "${approval.rewriteNote || ''}"`, lead.full_name, lead.id);
      rewriteNote = approval.rewriteNote || '';
      continue;
    }

    if (approval.action === 'skip') {
      emitLeadUpdate(lead, {
        status:      'skipped',
        progress:    100,
        skip_reason: approval.rewriteNote || 'Skipped by user',
        stepLabel:   'Skipped'
      });
      emitLog(runId, 'system', `Skipped: ${lead.full_name}`, null, lead.id);
      emitStatsUpdate(runId);
      return;
    }

    // Unknown action — skip to be safe
    emitLeadUpdate(lead, { status: 'skipped', progress: 100, stepLabel: 'Skipped (unknown action)' });
    emitStatsUpdate(runId);
    return;
  }

  // Safety: max rewrites exceeded
  emitLeadUpdate(lead, { status: 'skipped', progress: 100, skip_reason: 'max_rewrites_reached', stepLabel: 'Skipped (max rewrites)' });
  emitLog(runId, 'warn', `Max rewrites reached for ${lead.full_name}`, lead.full_name, lead.id);
  emitStatsUpdate(runId);
}

/**
 * Draft-only step for parallel orchestration.
 * Generates the email draft and leaves the lead in status="drafted".
 * Does NOT wait for approval — the user approves explicitly via the UI,
 * which triggers POST /api/action/send → sendLeadEmail().
 *
 * @param {object} lead
 * @param {object} profile
 * @param {object} config
 * @param {string} runId
 */
async function draftOnly(lead, profile, config, runId) {
  emitLeadUpdate(lead, { status: 'drafting', progress: 75, stepLabel: 'Drafting email with AI...' });
  emitLog(runId, 'info', `Drafting email for ${lead.full_name}...`, lead.full_name, lead.id);

  let draft;
  try {
    draft = await withRetry(
      () => draftEmail(lead, profile, config, null),
      1, 3000, 'draft'
    );
  } catch (err) {
    emitLog(runId, 'error', `Drafting failed: ${err.message}`, null, lead.id);
    emitLeadUpdate(lead, {
      status:      'skipped',
      progress:    100,
      skip_reason: `Draft failed: ${err.message}`,
      stepLabel:   'Draft failed — skipped',
    });
    emitStatsUpdate(runId);
    return;
  }

  // Persist the draft and mark lead as "drafted" — ready for user review.
  emitLeadUpdate(lead, {
    status:        'drafted',
    draft_subject: draft.subject,
    draft_body:    draft.body,
    progress:      100,
    stepLabel:     'Draft ready — awaiting approval',
  });
  emitLog(runId, 'success', `Draft ready for ${lead.full_name} — click Approve to send`, lead.full_name, lead.id);
  emitStatsUpdate(runId);
}

/**
 * Send a drafted lead's email immediately.
 * Called from the REST endpoint POST /api/action/send when the user clicks
 * "Approve & Send" in the UI. Blocks on the actual SMTP delivery so the
 * endpoint response reflects success/failure, then emits socket updates.
 *
 * Safety: refuses to send when config.run.dry_run is true.
 *
 * @param {string} leadId
 * @param {object} config - loaded config (with dry_run flag)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendLeadEmail(leadId, config) {
  const lead = getLeadById(leadId);
  if (!lead) {
    return { success: false, error: 'Lead not found' };
  }
  if (lead.status !== 'drafted') {
    return { success: false, error: `Lead status is ${lead.status}, not drafted` };
  }
  if (config?.run?.dry_run) {
    return { success: false, error: 'Cannot send in Dry Run mode' };
  }
  if (!lead.draft_subject || !lead.draft_body) {
    return { success: false, error: 'No draft available for this lead' };
  }

  const runId = lead.run_id;

  // Mark as approved — UI shows "sending..."
  try {
    updateLead(leadId, { status: 'approved' });
    emit('lead:updated', toCamelCase({
      id: leadId, status: 'approved', stepLabel: 'Approved — sending...',
    }));
    if (runId) emitLog(runId, 'info', `Approved by user: ${lead.full_name}`, lead.full_name, leadId);
  } catch (_) {}

  // Actually dispatch via SMTP / Gmail
  let sendResult;
  try {
    sendResult = await sendEmail(
      lead,
      { subject: lead.draft_subject, body: lead.draft_body },
      config
    );
  } catch (err) {
    sendResult = { success: false, error: err.message };
  }

  if (sendResult.success) {
    const sentAt = new Date().toISOString();
    try {
      updateLead(leadId, { status: 'sent', sent_at: sentAt });
      emit('lead:updated', toCamelCase({
        id: leadId, status: 'sent', progress: 100, sent_at: sentAt, stepLabel: 'Email sent',
      }));
      if (runId) {
        emitLog(runId, 'success', `Email sent to ${lead.full_name} at ${lead.company}`, lead.company, leadId);
        try { emit('stats:updated', getLeadStatusCounts(runId)); } catch (_) {}
      }
    } catch (_) {}
    return { success: true };
  } else {
    try {
      updateLead(leadId, { status: 'send_failed', skip_reason: sendResult.error });
      emit('lead:updated', toCamelCase({
        id: leadId, status: 'send_failed', stepLabel: `Send failed: ${sendResult.error}`,
      }));
      if (runId) {
        emitLog(runId, 'error', `Send failed for ${lead.full_name}: ${sendResult.error}`, null, leadId);
        try { emit('stats:updated', getLeadStatusCounts(runId)); } catch (_) {}
      }
    } catch (_) {}
    return { success: false, error: sendResult.error };
  }
}

/**
 * Wait for approval purely from the dashboard (approvalBus).
 * @param {object} lead
 * @param {object} config
 * @returns {Promise<{action: string, rewriteNote: string|null}>}
 */
function waitForDashboardApproval(lead, config) {
  const timeoutMs = (config?.gchat?.poll_timeout_minutes || 60) * 60 * 1000;
  const busEvent  = `approval:${lead.id}`;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      approvalBus.removeAllListeners(busEvent);
      logger.warn({ module: 'runner', leadId: lead.id }, 'Dashboard approval timed out');
      resolve({ action: 'skip', rewriteNote: 'Approval timed out' });
    }, timeoutMs);

    approvalBus.once(busEvent, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

/**
 * Helper to update lead in DB and emit event.
 * @param {object} lead
 * @param {object} changedFields
 */
function emitLeadUpdate(lead, changedFields) {
  Object.assign(lead, changedFields);

  // Only persist DB-storable fields
  const dbColumns = [
    'status', 'fit_score', 'fit_reason', 'pain_points', 'recent_signal',
    'hook', 'draft_subject', 'draft_body', 'sent_at', 'gchat_thread_id',
    'skip_reason', 'rewrite_count'
  ];
  const dbFields = {};
  for (const key of dbColumns) {
    if (key in changedFields) dbFields[key] = changedFields[key];
  }
  if (Object.keys(dbFields).length > 0) {
    try {
      updateLead(lead.id, dbFields);
    } catch (err) {
      logger.warn({ module: 'runner', leadId: lead.id }, `DB update failed: ${err.message}`);
    }
  }

  // Emit to frontend — include transient fields (progress, stepLabel)
  emit('lead:updated', toCamelCase({ id: lead.id, ...changedFields }));
}

/**
 * Emit stats update to frontend.
 * @param {string} runId
 */
function emitStatsUpdate(runId) {
  try {
    const stats = getLeadStatusCounts(runId);
    emit('stats:updated', stats);
  } catch (err) {
    logger.warn({ module: 'runner' }, `Stats update failed: ${err.message}`);
  }
}

/**
 * Finalize a run.
 * @param {string} runId
 * @param {string} status
 * @returns {object} RunSummary
 */
function finishRun(runId, status) {
  let stats = { total: 0, profiled: 0, drafted: 0, pending: 0, sent: 0, skipped: 0 };
  try {
    stats = getLeadStatusCounts(runId);
  } catch (_) {}

  try {
    updateRun(runId, { status, ended_at: new Date().toISOString(), stats: JSON.stringify(stats) });
  } catch (err) {
    logger.warn({ module: 'runner' }, `Failed to update run record: ${err.message}`);
  }

  const summary = { runId, status, stats };

  if (status === 'complete') {
    emit('run:complete', summary);
    emitLog(runId, 'system', '--- Run complete ---');
    emitLog(runId, 'success',
      `Done: ${stats.sent} sent, ${stats.skipped} skipped, ${stats.pending} pending of ${stats.total} total`);
  } else if (status === 'stopped') {
    emit('run:stopped', { runId });
    emitLog(runId, 'system', '--- Run stopped by user ---');
  } else {
    emit('run:stopped', { runId });
    emitLog(runId, 'error', '--- Run ended with errors ---');
  }

  return summary;
}
