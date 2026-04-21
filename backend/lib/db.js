import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'data', 'db.sqlite');

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id              TEXT PRIMARY KEY,
      source          TEXT NOT NULL DEFAULT 'csv',
      first_name      TEXT,
      last_name       TEXT,
      full_name       TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      title           TEXT,
      company         TEXT,
      linkedin_url    TEXT,
      website         TEXT,
      industry        TEXT,
      company_size    INTEGER,
      region          TEXT,
      status          TEXT NOT NULL DEFAULT 'new',
      fit_score       INTEGER,
      fit_reason      TEXT,
      pain_points     TEXT,
      recent_signal   TEXT,
      hook            TEXT,
      draft_subject   TEXT,
      draft_body      TEXT,
      run_id          TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at         TEXT,
      gchat_thread_id TEXT,
      skip_reason     TEXT,
      rewrite_count   INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS runs (
      id              TEXT PRIMARY KEY,
      started_at      TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at        TEXT,
      status          TEXT NOT NULL DEFAULT 'running',
      region          TEXT,
      industry        TEXT,
      leads_count     INTEGER DEFAULT 0,
      config_snapshot TEXT,
      stats           TEXT
    );

    CREATE TABLE IF NOT EXISTS log_entries (
      id          TEXT PRIMARY KEY,
      run_id      TEXT NOT NULL,
      lead_id     TEXT,
      level       TEXT NOT NULL,
      message     TEXT NOT NULL,
      highlight   TEXT,
      ts          TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add ts column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE log_entries ADD COLUMN ts TEXT`);
  } catch (_) {
    // Column already exists, ignore
  }
}

initDB();

// --- Leads ---

const _insertLead = db.prepare(`
  INSERT OR IGNORE INTO leads (id, source, first_name, last_name, full_name, email, title, company,
    linkedin_url, website, industry, company_size, region, status, run_id, created_at, updated_at)
  VALUES (@id, @source, @first_name, @last_name, @full_name, @email, @title, @company,
    @linkedin_url, @website, @industry, @company_size, @region, @status, @run_id, @created_at, @updated_at)
`);

/**
 * @param {object} lead
 */
export function insertLead(lead) {
  _insertLead.run({
    id:           lead.id,
    source:       lead.source || 'csv',
    first_name:   lead.first_name || null,
    last_name:    lead.last_name || null,
    full_name:    lead.full_name,
    email:        lead.email,
    title:        lead.title || null,
    company:      lead.company || null,
    linkedin_url: lead.linkedin_url || null,
    website:      lead.website || null,
    industry:     lead.industry || null,
    company_size: lead.company_size || null,
    region:       lead.region || null,
    status:       lead.status || 'new',
    run_id:       lead.run_id || null,
    created_at:   lead.created_at || new Date().toISOString(),
    updated_at:   lead.updated_at || new Date().toISOString()
  });
}

/**
 * @param {string} id
 * @returns {object|undefined}
 */
export function getLeadById(id) {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

/**
 * @param {string} email
 * @returns {object|undefined}
 */
export function getLeadByEmail(email) {
  return db.prepare('SELECT * FROM leads WHERE email = ?').get(email);
}

/**
 * @param {string} id
 * @param {object} fields
 */
export function updateLead(id, fields) {
  const entries = Object.entries(fields).filter(([k]) => k !== 'id');
  if (entries.length === 0) return;
  entries.push(['updated_at', new Date().toISOString()]);
  const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
  const params = Object.fromEntries(entries);
  params.id = id;
  db.prepare(`UPDATE leads SET ${sets} WHERE id = @id`).run(params);
}

/**
 * @param {string} runId
 * @returns {object[]}
 */
export function getLeadsByRunId(runId) {
  return db.prepare('SELECT * FROM leads WHERE run_id = ?').all(runId);
}

/**
 * @param {string[]} csvEmails
 * @returns {string[]} emails not yet in DB
 */
export function getNewLeadsFromCSV(csvEmails) {
  return csvEmails.filter(email => !getLeadByEmail(email));
}

/**
 * @param {string} runId
 * @returns {object}
 */
export function getLeadStatusCounts(runId) {
  const leads = getLeadsByRunId(runId);
  return {
    total:    leads.length,
    profiled: leads.filter(l => l.fit_score !== null).length,
    drafted:  leads.filter(l => l.draft_subject !== null).length,
    pending:  leads.filter(l => l.status === 'pending').length,
    sent:     leads.filter(l => l.status === 'sent').length,
    skipped:  leads.filter(l => l.status === 'skipped' || l.status === 'low-fit').length
  };
}

// --- Runs ---

const _insertRun = db.prepare(`
  INSERT OR IGNORE INTO runs (id, started_at, status, region, industry, leads_count, config_snapshot)
  VALUES (@id, @started_at, @status, @region, @industry, @leads_count, @config_snapshot)
`);

/**
 * @param {object} run
 */
export function insertRun(run) {
  _insertRun.run({
    id:              run.id,
    started_at:      run.started_at || new Date().toISOString(),
    status:          run.status || 'running',
    region:          run.region || null,
    industry:        run.industry || null,
    leads_count:     run.leads_count || 0,
    config_snapshot: run.config_snapshot || null
  });
}

/**
 * @param {string} id
 * @param {object} fields
 */
export function updateRun(id, fields) {
  const entries = Object.entries(fields).filter(([k]) => k !== 'id');
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
  const params = Object.fromEntries(entries);
  params.id = id;
  db.prepare(`UPDATE runs SET ${sets} WHERE id = @id`).run(params);
}

/**
 * @param {string} id
 * @returns {object|undefined}
 */
export function getRunById(id) {
  return db.prepare('SELECT * FROM runs WHERE id = ?').get(id);
}

/**
 * @returns {object[]}
 */
export function getAllRuns() {
  return db.prepare('SELECT * FROM runs ORDER BY started_at DESC').all();
}

/**
 * @returns {object|undefined}
 */
export function getRecentRun() {
  return db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT 1').get();
}

// --- Logs ---

const _insertLog = db.prepare(`
  INSERT OR IGNORE INTO log_entries (id, run_id, lead_id, level, message, highlight, ts, created_at)
  VALUES (@id, @run_id, @lead_id, @level, @message, @highlight, @ts, @created_at)
`);

/**
 * @param {object} entry
 */
export function insertLog(entry) {
  _insertLog.run({
    id:         entry.id,
    run_id:     entry.run_id,
    lead_id:    entry.lead_id || null,
    level:      entry.level,
    message:    entry.message,
    highlight:  entry.highlight || null,
    ts:         entry.ts || null,
    created_at: entry.created_at || new Date().toISOString()
  });
}

/**
 * @param {string} runId
 * @returns {object[]}
 */
export function getLogsByRunId(runId) {
  return db.prepare('SELECT * FROM log_entries WHERE run_id = ? ORDER BY created_at ASC').all(runId);
}
