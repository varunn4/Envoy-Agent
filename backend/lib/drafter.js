import axios from 'axios';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const systemPrompt = readFileSync(join(__dirname, '..', 'prompts', 'email.txt'), 'utf-8');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_RETRIES  = 2;
const RETRY_DELAY  = 3000;

const DEFAULT_DRAFT = {
  subject: 'Following up',
  body:    'Hi,\n\nI wanted to reach out about a potential collaboration.\n\nBest regards'
};

/**
 * Draft a cold email using Groq Cloud API.
 * Never throws — returns DEFAULT_DRAFT on total failure.
 * @param {object} lead
 * @param {object} profile
 * @param {object} config
 * @param {string|null} rewriteNote
 * @returns {Promise<{subject: string, body: string}>}
 */
export async function draftEmail(lead, profile, config, rewriteNote) {
  if (!process.env.GROQ_API_KEY) {
    logger.warn({ module: 'drafter', leadId: lead.id }, 'GROQ_API_KEY not set — returning default draft');
    return { ...DEFAULT_DRAFT };
  }

  const userPrompt = buildDraftPrompt(lead, profile, config, rewriteNote);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(GROQ_API_URL, {
        model:       config?.claude?.groq_model || 'llama-3.3-70b-versatile',
        max_tokens:  config?.claude?.max_tokens  || 1000,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type':  'application/json'
        },
        timeout: 30000
      });

      const text = response.data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Empty response from Groq');

      const draft = parseDraftResponse(text);
      logger.info({ module: 'drafter', leadId: lead.id }, `Draft ready: "${draft.subject}"`);
      return draft;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      logger.warn({ module: 'drafter', leadId: lead.id, attempt: attempt + 1 }, `Groq API error: ${msg}`);

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    }
  }

  logger.error({ module: 'drafter', leadId: lead.id }, `Draft failed after ${MAX_RETRIES} attempts — using defaults`);
  return { ...DEFAULT_DRAFT };
}

/**
 * @param {string} text
 * @returns {{subject: string, body: string}}
 */
function parseDraftResponse(text) {
  try {
    let clean = text;
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    // Remove control characters that Groq sometimes injects (preserve \n \r \t)
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    const draft = JSON.parse(clean);

    if (!draft.subject || typeof draft.subject !== 'string') {
      draft.subject = DEFAULT_DRAFT.subject;
    }
    if (!draft.body || typeof draft.body !== 'string') {
      draft.body = DEFAULT_DRAFT.body;
    }

    return { subject: draft.subject.trim(), body: draft.body.trim() };
  } catch (err) {
    logger.error({ module: 'drafter' }, `Failed to parse draft JSON: ${err.message}`);

    // Last-resort: try to extract subject/body from plain text
    const subjectMatch = text.match(/subject[:\s]+(.+)/i);
    if (subjectMatch) {
      const subject = subjectMatch[1].trim().replace(/^["']|["']$/g, '');
      return { subject, body: DEFAULT_DRAFT.body };
    }

    return { ...DEFAULT_DRAFT };
  }
}

/**
 * @param {object} lead
 * @param {object} profile
 * @param {object} config
 * @param {string|null} rewriteNote
 * @returns {string}
 */
function buildDraftPrompt(lead, profile, config, rewriteNote) {
  const sender    = config?.sender || {};
  const firstName = lead.first_name || (lead.full_name || '').split(' ')[0] || 'there';

  return `---
SENDER:
Name: ${sender.name || 'Unknown'}
Role: ${sender.role || 'Unknown'}
Company: ${sender.company || 'Unknown'}
Value prop: ${sender.value_prop || ''}
Tone: ${sender.tone || 'professional'}
CTA: ${sender.cta || 'a quick call'}
Signature: ${sender.signature || sender.name || 'Best regards'}

LEAD PROFILE:
Name: ${lead.full_name}, specifically address them as ${firstName}
Title: ${lead.title || 'Unknown'}
Company: ${lead.company || 'Unknown'}
What they do: ${profile.what_they_do || 'Unknown'}
What they are building: ${profile.what_they_are_building || 'Unknown'}
Pain points: ${(profile.likely_pain_points || []).join(', ') || 'Unknown'}
Recent signal: ${profile.recent_signals || 'None'}
Personalisation hook: ${profile.personalisation_hook || ''}

${rewriteNote ? `REWRITE INSTRUCTION: ${rewriteNote}` : ''}
---`;
}
