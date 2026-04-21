import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import { getLeadByEmail } from './db.js';
import logger from './logger.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse leads from a CSV file, returning only new leads not in DB.
 * Never throws — returns empty array on failure.
 * @param {string} filePath - path to the CSV file
 * @returns {object[]} array of lead objects
 */
export function parseLeadsCSV(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    logger.error({ module: 'csv' }, `Failed to read CSV at ${filePath}: ${err.message}`);
    return [];
  }

  let records;
  try {
    records = parse(raw, {
      columns:            true,
      skip_empty_lines:   true,
      trim:               true,
      relax_column_count: true
    });
  } catch (err) {
    logger.error({ module: 'csv' }, `Failed to parse CSV: ${err.message}`);
    return [];
  }

  const leads = [];

  for (let i = 0; i < records.length; i++) {
    try {
      const row = records[i];

      // Normalise column names to lowercase
      const norm = {};
      for (const [k, v] of Object.entries(row)) {
        norm[k.toLowerCase().trim()] = (v || '').trim();
      }

      const name  = norm.name || norm.full_name || '';
      const email = norm.email || '';

      // Validate required fields
      if (!name) {
        logger.warn({ module: 'csv', row: i + 2 }, `Skipped row ${i + 2}: missing name`);
        continue;
      }
      if (!email || !EMAIL_RE.test(email)) {
        logger.warn({ module: 'csv', row: i + 2 }, `Skipped row ${i + 2}: missing or invalid email`);
        continue;
      }

      // Check if already in DB
      try {
        if (getLeadByEmail(email)) {
          logger.info({ module: 'csv', email }, `Skipped ${email}: already in database`);
          continue;
        }
      } catch (dbErr) {
        logger.warn({ module: 'csv', email }, `DB check failed for ${email}: ${dbErr.message}`);
        // Continue — treat as new lead to avoid blocking the run
      }

      // Normalise linkedin_url
      let linkedinUrl = norm.linkedin_url || norm.linkedin || '';
      if (linkedinUrl && !linkedinUrl.startsWith('http')) {
        linkedinUrl = 'https://' + linkedinUrl.replace(/^\/\//, '');
      }

      // Parse company_size
      const companySizeParsed = parseInt(norm.company_size, 10);
      const companySize = Number.isNaN(companySizeParsed) ? null : companySizeParsed;

      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || name;
      const lastName  = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

      leads.push({
        id:           crypto.randomUUID(),
        source:       'csv',
        first_name:   firstName,
        last_name:    lastName,
        full_name:    name,
        email,
        title:        norm.title       || null,
        company:      norm.company     || null,
        linkedin_url: linkedinUrl      || null,
        website:      norm.website     || null,
        industry:     norm.industry    || null,
        company_size: companySize,
        region:       norm.region      || null,
        notes:        norm.notes       || null,
        status:       'new',
        created_at:   new Date().toISOString(),
        updated_at:   new Date().toISOString()
      });
    } catch (rowErr) {
      logger.warn({ module: 'csv', row: i + 2 }, `Error processing row ${i + 2}: ${rowErr.message}`);
    }
  }

  return leads;
}

/**
 * Parse leads from a CSV string (e.g. from an uploaded buffer).
 * Validates rows but does NOT deduplicate against DB — that happens at run time.
 * Never throws — returns { leads, errors }.
 * @param {string} csvContent - raw CSV text
 * @returns {{ leads: object[], errors: string[] }}
 */
export function parseLeadsCSVFromString(csvContent) {
  const errors = [];
  let records;

  try {
    records = parse(csvContent, {
      columns:            true,
      skip_empty_lines:   true,
      trim:               true,
      relax_column_count: true,
    });
  } catch (err) {
    return { leads: [], errors: [`CSV parse error: ${err.message}`] };
  }

  const leads = [];

  for (let i = 0; i < records.length; i++) {
    try {
      const row = records[i];
      const norm = {};
      for (const [k, v] of Object.entries(row)) {
        norm[k.toLowerCase().trim()] = (v || '').trim();
      }

      const name  = norm.name || norm.full_name || '';
      const email = norm.email || '';

      if (!name) {
        errors.push(`Row ${i + 2}: missing name`);
        continue;
      }
      if (!email || !EMAIL_RE.test(email)) {
        errors.push(`Row ${i + 2}: missing or invalid email (${email || 'empty'})`);
        continue;
      }

      let linkedinUrl = norm.linkedin_url || norm.linkedin || '';
      if (linkedinUrl && !linkedinUrl.startsWith('http')) {
        linkedinUrl = 'https://' + linkedinUrl.replace(/^\/\//, '');
      }

      const companySizeParsed = parseInt(norm.company_size, 10);
      const companySize = Number.isNaN(companySizeParsed) ? null : companySizeParsed;

      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || name;
      const lastName  = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

      leads.push({
        id:           crypto.randomUUID(),
        source:       'csv_upload',
        first_name:   firstName,
        last_name:    lastName,
        full_name:    name,
        email,
        title:        norm.title       || null,
        company:      norm.company     || null,
        linkedin_url: linkedinUrl      || null,
        website:      norm.website     || null,
        industry:     norm.industry    || null,
        company_size: companySize,
        region:       norm.region      || null,
        notes:        norm.notes       || null,
        status:       'new',
        created_at:   new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      });
    } catch (rowErr) {
      errors.push(`Row ${i + 2}: ${rowErr.message}`);
    }
  }

  return { leads, errors };
}
