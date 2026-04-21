import axios from 'axios';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const systemPrompt = readFileSync(join(__dirname, '..', 'prompts', 'profile.txt'), 'utf-8');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_RETRIES  = 2;
const RETRY_DELAY  = 3000;

const DEFAULT_PROFILE = {
  what_they_do:          'Unknown',
  what_they_are_building:'Unknown',
  likely_pain_points:    [],
  recent_signals:        'None',
  personalisation_hook:  '',
  fit_score:             0,
  fit_reason:            'Could not profile'
};

/**
 * Build lead profile using Groq Cloud API.
 * Never throws — returns DEFAULT_PROFILE on total failure.
 * @param {object} lead
 * @param {object} scrapedData
 * @param {object} config
 * @returns {Promise<object>} profile object
 */
export async function profileLead(lead, scrapedData, config) {
  if (!process.env.GROQ_API_KEY) {
    logger.warn({ module: 'profiler', leadId: lead.id }, 'GROQ_API_KEY not set — returning default profile');
    return { ...DEFAULT_PROFILE, fit_reason: 'GROQ_API_KEY not configured' };
  }

  const userPrompt = buildProfilePrompt(lead, scrapedData, config);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(GROQ_API_URL, {
        model:       config?.claude?.groq_model || 'llama-3.3-70b-versatile',
        max_tokens:  config?.claude?.max_tokens  || 1000,
        temperature: 0.3,
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

      const profile = parseProfileResponse(text);
      logger.info({ module: 'profiler', leadId: lead.id }, `Profile built — fit ${profile.fit_score}/10`);
      return profile;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      logger.warn({ module: 'profiler', leadId: lead.id, attempt: attempt + 1 }, `Groq API error: ${msg}`);

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    }
  }

  logger.error({ module: 'profiler', leadId: lead.id }, `Profile failed after ${MAX_RETRIES} attempts — using defaults`);
  return { ...DEFAULT_PROFILE };
}

/**
 * @param {string} text
 * @returns {object}
 */
function parseProfileResponse(text) {
  try {
    // Strip code fences if present
    let clean = text;
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    // Remove stray control characters
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    const profile = JSON.parse(clean);

    // Validate and fill required keys
    const required = [
      'what_they_do', 'what_they_are_building', 'likely_pain_points',
      'recent_signals', 'personalisation_hook', 'fit_score', 'fit_reason'
    ];
    for (const key of required) {
      if (!(key in profile)) {
        logger.warn({ module: 'profiler' }, `Missing key in profile: ${key}`);
        profile[key] = DEFAULT_PROFILE[key];
      }
    }

    // Clamp fit_score to 1-10
    profile.fit_score = Math.max(1, Math.min(10, Math.round(Number(profile.fit_score) || 0)));

    // Ensure pain_points is array
    if (!Array.isArray(profile.likely_pain_points)) {
      profile.likely_pain_points = profile.likely_pain_points
        ? [String(profile.likely_pain_points)]
        : [];
    }

    // Ensure strings
    profile.recent_signals       = String(profile.recent_signals || DEFAULT_PROFILE.recent_signals);
    profile.personalisation_hook = String(profile.personalisation_hook || '');
    profile.fit_reason           = String(profile.fit_reason || DEFAULT_PROFILE.fit_reason);

    return profile;
  } catch (err) {
    logger.error({ module: 'profiler' }, `Failed to parse profile JSON: ${err.message}`);
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * @param {object} lead
 * @param {object} scrapedData
 * @param {object} config
 * @returns {string}
 */
function buildProfilePrompt(lead, scrapedData, config) {
  const sender = config?.sender || {};
  const icp    = config?.icp    || {};

  return `---
LEAD INFORMATION:
Name: ${lead.full_name}
Title: ${lead.title || 'Unknown'}
Company: ${lead.company || 'Unknown'}
Email: ${lead.email}
Industry: ${lead.industry || 'Unknown'}
Company size: ${lead.company_size || 'Unknown'}
Region: ${lead.region || 'Unknown'}
Additional notes: ${lead.notes || 'None'}

SENDER CONTEXT:
Sender: ${sender.name || 'Unknown'}, ${sender.role || 'Unknown'} at ${sender.company || 'Unknown'}
Value proposition: ${sender.value_prop || ''}
ICP industries: ${(icp.industries || []).join(', ')}
ICP titles: ${(icp.titles || []).join(', ')}
ICP company size: ${icp.company_size?.min || 0}-${icp.company_size?.max || 1000}

LINKEDIN RAW TEXT:
${scrapedData?.linkedinText || 'Not available'}

WEBSITE RAW TEXT:
${scrapedData?.websiteText || 'Not available'}
---`;
}
