import axios from 'axios';
import { approvalBus } from './approvalBus.js';
import logger from './logger.js';

const POLL_INTERVAL = 30000; // 30 seconds

/**
 * Post a draft to Google Chat webhook for human review.
 * @param {object} lead
 * @param {object} profile
 * @param {object} draft
 * @returns {Promise<void>}
 */
export async function postDraftToGChat(lead, profile, draft) {
  const webhookUrl = process.env.GCHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('GCHAT_WEBHOOK_URL not configured');
  }

  const firstName = lead.first_name || (lead.full_name || '').split(' ')[0] || 'Unknown';

  const message = {
    text: [
      `*🎯 New Draft Ready — ${lead.full_name}*`,
      `*Company:* ${lead.company || 'Unknown'}`,
      `*Title:* ${lead.title || 'Unknown'}`,
      `*Fit Score:* ${profile.fit_score}/10 — ${profile.fit_reason || ''}`,
      `*Hook:* ${profile.personalisation_hook || 'N/A'}`,
      '',
      `*Subject:* ${draft.subject}`,
      '',
      draft.body,
      '',
      `*Lead ID:* \`${lead.id}\``,
      `Reply: *approve*, *skip*, or *rewrite: <note>*`
    ].join('\n')
  };

  try {
    await axios.post(webhookUrl, message, { timeout: 10000 });
    logger.info({ module: 'gchat', leadId: lead.id }, 'Draft posted to GChat');
  } catch (err) {
    logger.error({ module: 'gchat', leadId: lead.id }, `GChat post failed: ${err.message}`);
    throw err;
  }
}

/**
 * Poll for approval from both GChat and the dashboard approval bus.
 * Resolves with the first approval received from either source.
 * @param {object} lead
 * @param {object} config
 * @returns {Promise<{action: string, rewriteNote: string|null}>}
 */
export async function pollForApproval(lead, config) {
  const timeoutMs = (config?.gchat?.poll_timeout_minutes || 60) * 60 * 1000;
  const intervalMs = (config?.gchat?.poll_interval_seconds || 30) * 1000;
  const busEvent = `approval:${lead.id}`;

  return new Promise((resolve) => {
    let resolved = false;
    let pollTimer = null;

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      if (pollTimer) clearInterval(pollTimer);
      approvalBus.removeAllListeners(busEvent);
      resolve(result);
    };

    // Timeout
    const timeout = setTimeout(() => {
      logger.warn({ module: 'gchat', leadId: lead.id }, 'Approval timed out');
      done({ action: 'skip', rewriteNote: 'Approval timed out' });
    }, timeoutMs);

    // Dashboard approval bus
    approvalBus.once(busEvent, (result) => {
      clearTimeout(timeout);
      done(result);
    });

    // GChat polling (only if Space ID is configured)
    if (process.env.GCHAT_SPACE_ID) {
      pollTimer = setInterval(async () => {
        if (resolved) {
          clearInterval(pollTimer);
          return;
        }
        try {
          const result = await checkGChatForApproval(lead);
          if (result) {
            clearTimeout(timeout);
            done(result);
          }
        } catch (err) {
          logger.warn({ module: 'gchat', leadId: lead.id }, `Poll error: ${err.message}`);
        }
      }, intervalMs);
    }
  });
}

/**
 * Check GChat space for a reply approving/skipping/rewriting a lead.
 * @param {object} lead
 * @returns {Promise<{action: string, rewriteNote: string|null}|null>}
 */
async function checkGChatForApproval(lead) {
  // GChat polling via Service Account requires a proper implementation.
  // This stub returns null (no decision) until implemented.
  return null;
}

/**
 * Test the GChat webhook connection.
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function testGChatWebhook() {
  const webhookUrl = process.env.GCHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, error: 'GCHAT_WEBHOOK_URL not configured' };
  }
  try {
    await axios.post(webhookUrl, { text: '✅ Envoy GChat connection test successful' }, { timeout: 10000 });
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
