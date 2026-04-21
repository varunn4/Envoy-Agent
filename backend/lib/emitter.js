import crypto from 'crypto';
import { insertLog } from './db.js';

let _io = null;

/**
 * Map of snake_case DB field names to camelCase frontend field names
 */
const FIELD_MAP = {
  full_name:       'name',
  first_name:      'firstName',
  last_name:       'lastName',
  linkedin_url:    'linkedinUrl',
  company_size:    'companySize',
  fit_score:       'fitScore',
  fit_reason:      'fitReason',
  pain_points:     'painPoints',
  recent_signal:   'recentSignal',
  draft_subject:   'draftSubject',
  draft_body:      'draftBody',
  created_at:      'createdAt',
  updated_at:      'updatedAt',
  sent_at:         'sentAt',
  run_id:          'runId',
  skip_reason:     'skipReason',
  rewrite_count:   'rewriteCount',
  gchat_thread_id: 'gchatThreadId',
  step_label:      'stepLabel',
  apollo_id:       'apolloId'
};

/**
 * Convert snake_case object keys to camelCase for frontend consumption.
 * Also ensures transient UI fields (progress, stepLabel) pass through unchanged.
 * @param {object} obj
 * @returns {object}
 */
export function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = FIELD_MAP[key] || key;
    // Parse pain_points JSON string to array if needed
    if (key === 'pain_points' && typeof value === 'string') {
      try { result[camelKey] = JSON.parse(value); } catch { result[camelKey] = []; }
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

/**
 * Set the Socket.io server instance
 * @param {import('socket.io').Server} io
 */
export function setIO(io) {
  _io = io;
}

/**
 * Emit an event to all connected Socket.io clients
 * @param {string} event
 * @param {object} payload
 */
export function emit(event, payload) {
  if (_io) _io.emit(event, payload);
}

/**
 * Emit a log entry and persist it to the database.
 * Uses ISO timestamp string for consistent frontend parsing.
 * @param {string} runId
 * @param {string} level - info | success | warn | error | system
 * @param {string} message
 * @param {string|null} [highlight]
 * @param {string|null} [leadId]
 */
export function emitLog(runId, level, message, highlight, leadId) {
  const now = new Date();
  // Use HH:MM:SS format for display, full ISO for DB
  const ts = now.toTimeString().split(' ')[0]; // "HH:MM:SS"

  const entry = {
    id:         crypto.randomUUID(),
    run_id:     runId,
    lead_id:    leadId || null,
    level,
    message,
    highlight:  highlight || null,
    ts,
    created_at: now.toISOString()
  };

  try {
    insertLog(entry);
  } catch (err) {
    // Don't let log persistence failures crash the pipeline
    console.error('[emitter] Failed to insert log:', err.message);
  }

  emit('log:entry', entry);
}
