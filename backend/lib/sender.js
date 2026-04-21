import nodemailer from 'nodemailer';
import axios from 'axios';
import logger from './logger.js';

let transporter  = null;
let lastTokenAt  = 0;
const TOKEN_TTL  = 55 * 60 * 1000; // Refresh OAuth token every 55 minutes

/**
 * Create or return the SMTP transporter.
 * Supports two modes:
 *   1. Gmail OAuth2 (when GMAIL_OAUTH_REFRESH_TOKEN is set)
 *   2. Standard SMTP (fallback)
 * @param {boolean} [force=false] - Force re-creation (e.g. after token expiry)
 * @returns {Promise<import('nodemailer').Transporter>}
 */
async function getTransporter(force = false) {
  const now = Date.now();

  // For OAuth, recreate transporter when token approaches expiry
  if (transporter && process.env.GMAIL_OAUTH_REFRESH_TOKEN) {
    if (!force && now - lastTokenAt < TOKEN_TTL) {
      return transporter;
    }
    // Token needs refresh
    transporter = null;
  } else if (transporter && !force) {
    return transporter;
  }

  if (process.env.GMAIL_OAUTH_REFRESH_TOKEN) {
    // Gmail OAuth2 mode
    let accessToken;
    try {
      accessToken = await getGmailAccessToken();
      lastTokenAt = now;
    } catch (err) {
      logger.error({ module: 'sender' }, `Failed to get Gmail access token: ${err.message}`);
      throw err;
    }

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type:          'OAuth2',
        user:          process.env.SMTP_FROM,
        clientId:      process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret:  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        refreshToken:  process.env.GMAIL_OAUTH_REFRESH_TOKEN,
        accessToken
      }
    });

    logger.info({ module: 'sender' }, 'Gmail OAuth2 transporter created');
  } else if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    // Standard SMTP mode
    const port = parseInt(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    logger.info({ module: 'sender' }, 'Standard SMTP transporter created');
  } else {
    throw new Error('No email transport configured. Set GMAIL_OAUTH_REFRESH_TOKEN or SMTP_HOST+SMTP_USER in .env');
  }

  return transporter;
}

/**
 * Get a fresh Gmail OAuth2 access token using the refresh token.
 * @returns {Promise<string>}
 */
async function getGmailAccessToken() {
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id:     process.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
    grant_type:    'refresh_token'
  }, { timeout: 10000 });

  if (!response.data?.access_token) {
    throw new Error('No access_token in OAuth response');
  }

  return response.data.access_token;
}

/**
 * Send an email to a lead.
 * @param {object} lead
 * @param {object} draft - { subject, body }
 * @param {object} config
 * @returns {Promise<{success: boolean, messageId: string|null, error: string|null}>}
 */
export async function sendEmail(lead, draft, config) {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const t = await getTransporter(attempt > 1);
      const senderName  = config?.sender?.name || process.env.SMTP_FROM || 'Envoy';
      const fromAddress = process.env.SMTP_FROM;

      if (!fromAddress) {
        throw new Error('SMTP_FROM not set in .env');
      }

      const result = await t.sendMail({
        from:    `${senderName} <${fromAddress}>`,
        to:      lead.email,
        subject: draft.subject,
        text:    draft.body,
        html:    buildHtmlEmail(draft.body)
      });

      logger.info({ module: 'sender', leadId: lead.id, attempt }, `Email sent: ${result.messageId}`);
      return { success: true, messageId: result.messageId, error: null };
    } catch (err) {
      logger.error({ module: 'sender', leadId: lead.id, attempt }, `Send failed: ${err.message}`);

      // If OAuth token expired, reset transporter to force refresh on retry
      if (
        err.message.includes('invalid_grant') ||
        err.message.includes('Token has been expired') ||
        err.message.includes('Invalid Credentials')
      ) {
        transporter = null;
        lastTokenAt = 0;
        logger.info({ module: 'sender' }, 'OAuth token reset due to auth error');
      }

      if (attempt === maxAttempts) {
        return { success: false, messageId: null, error: err.message };
      }
    }
  }

  return { success: false, messageId: null, error: 'Unknown send error' };
}

/**
 * Wrap plain text email body in minimal HTML.
 * @param {string} body
 * @returns {string}
 */
function buildHtmlEmail(body) {
  const htmlBody = (body || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fff;">
  <div style="max-width:580px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#111;">
    ${htmlBody}
  </div>
</body>
</html>`;
}

/**
 * Test the SMTP/OAuth connection.
 * @returns {Promise<boolean>}
 */
export async function testSMTPConnection() {
  try {
    const t = await getTransporter(true);
    await t.verify();
    logger.info({ module: 'sender' }, 'SMTP connection test passed');
    return true;
  } catch (err) {
    logger.error({ module: 'sender' }, `SMTP test failed: ${err.message}`);
    return false;
  }
}
