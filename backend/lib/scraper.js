import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = join(__dirname, '..', 'data', 'screenshots');

try {
  mkdirSync(screenshotsDir, { recursive: true });
} catch (_) {}

let browser = null;

/**
 * Launch the Playwright browser (call once per run)
 */
export async function launchBrowser() {
  if (browser) return;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    logger.info({ module: 'scraper' }, 'Browser launched');
  } catch (err) {
    logger.error({ module: 'scraper' }, `Failed to launch browser: ${err.message}`);
    browser = null;
    throw err;
  }
}

/**
 * Close the Playwright browser
 */
export async function closeBrowser() {
  if (browser) {
    try {
      await browser.close();
    } catch (err) {
      logger.warn({ module: 'scraper' }, `Browser close error: ${err.message}`);
    } finally {
      browser = null;
      logger.info({ module: 'scraper' }, 'Browser closed');
    }
  }
}

/**
 * Scrape LinkedIn profile and company website for a lead.
 * ALWAYS returns a structured result — never throws.
 * @param {object} lead
 * @param {object} config
 * @returns {Promise<{linkedinText: string|null, websiteText: string|null, scrapedAt: string, errors: string[]}>}
 */
export async function scrapeLead(lead, config) {
  const result = {
    linkedinText: null,
    websiteText:  null,
    scrapedAt:    new Date().toISOString(),
    errors:       []
  };

  // If browser is not available, return empty result gracefully
  if (!browser) {
    try {
      await launchBrowser();
    } catch (err) {
      result.errors.push(`Browser unavailable: ${err.message}`);
      return result;
    }
  }

  let context = null;
  try {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });
  } catch (err) {
    result.errors.push(`Failed to create browser context: ${err.message}`);
    // Try to reset browser
    try { await closeBrowser(); } catch (_) {}
    return result;
  }

  try {
    // --- LinkedIn scrape ---
    try {
      result.linkedinText = await scrapeLinkedIn(context, lead, config);
    } catch (err) {
      const msg = `LinkedIn scrape error: ${err.message}`;
      result.errors.push(msg);
      logger.warn({ module: 'scraper', leadId: lead.id }, msg);
    }

    // --- Website scrape ---
    try {
      result.websiteText = await scrapeWebsite(context, lead, config);
    } catch (err) {
      const msg = `Website scrape error: ${err.message}`;
      result.errors.push(msg);
      logger.warn({ module: 'scraper', leadId: lead.id }, msg);
    }
  } finally {
    try {
      await context.close();
    } catch (_) {}
  }

  return result;
}

/**
 * @param {import('playwright').BrowserContext} context
 * @param {object} lead
 * @param {object} config
 * @returns {Promise<string|null>}
 */
async function scrapeLinkedIn(context, lead, config) {
  if (!lead.linkedin_url) {
    logger.warn({ module: 'scraper', leadId: lead.id }, 'No LinkedIn URL provided');
    return null;
  }

  const timeoutMs = config?.scraping?.timeout_ms || 15000;
  const waitMs    = config?.scraping?.linkedin_wait_ms || 3000;
  const maxLen    = config?.scraping?.max_text_length || 1000;

  const page = await context.newPage();
  try {
    await page.goto(lead.linkedin_url, {
      waitUntil: 'domcontentloaded',
      timeout:   timeoutMs
    });

    await page.waitForTimeout(Math.min(waitMs, 5000));

    // Check for login wall
    let pageContent = '';
    try {
      pageContent = await page.content();
    } catch (_) {}

    const hasLoginWall = pageContent.includes('authwall') ||
                         pageContent.includes('sign-in-modal') ||
                         pageContent.includes('login');

    let text = null;

    if (hasLoginWall) {
      logger.info({ module: 'scraper', leadId: lead.id }, 'LinkedIn login wall detected — using partial fallback');
      // Try to extract anything visible before the wall
      try {
        text = await page.evaluate(() => document.body.innerText.slice(0, 800));
      } catch (_) {}

      // If nothing useful, try Google cache
      if (!text || text.length < 50) {
        try {
          const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(lead.linkedin_url)}`;
          await page.goto(cacheUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
          text = await page.evaluate(() => document.body.innerText);
        } catch (cacheErr) {
          logger.warn({ module: 'scraper', leadId: lead.id }, `Cache fallback failed: ${cacheErr.message}`);
          return null;
        }
      }
    } else {
      // Try structured selectors first
      const selectors = [
        '.text-body-medium',
        '[data-section="summary"]',
        '[data-section="experience"]',
        '[data-section="activity"]',
        '.pv-text-details__left-panel',
        '.artdeco-card'
      ];

      const parts = [];
      for (const sel of selectors) {
        try {
          const els = await page.$$(sel);
          for (const el of els.slice(0, 3)) {
            try {
              const t = await el.innerText();
              if (t && t.trim().length > 10) parts.push(t.trim());
            } catch (_) {}
          }
        } catch (_) {
          // selector not found, continue
        }
      }

      if (parts.length > 0) {
        text = parts.join('\n');
      } else {
        // Fall back to full body text
        try {
          text = await page.evaluate(() => document.body.innerText.slice(0, 1500));
        } catch (_) {
          return null;
        }
      }
    }

    if (config?.scraping?.save_screenshots) {
      await page.screenshot({ path: join(screenshotsDir, `${lead.id}_linkedin.png`) }).catch(() => {});
    }

    if (text && text.trim().length > 10) {
      return text.slice(0, maxLen);
    }
    return null;
  } finally {
    try { await page.close(); } catch (_) {}
  }
}

/**
 * @param {import('playwright').BrowserContext} context
 * @param {object} lead
 * @param {object} config
 * @returns {Promise<string|null>}
 */
async function scrapeWebsite(context, lead, config) {
  const timeoutMs = config?.scraping?.timeout_ms || 15000;
  const waitMs    = config?.scraping?.website_wait_ms || 2000;
  const maxLen    = config?.scraping?.max_text_length || 1000;

  // Derive website from email domain if not provided
  let website = lead.website;
  if (!website && lead.email) {
    const domain = lead.email.split('@')[1];
    if (domain) website = 'https://' + domain;
  }

  if (!website) {
    logger.warn({ module: 'scraper', leadId: lead.id }, 'No website or email domain to scrape');
    return null;
  }

  if (!website.startsWith('http')) {
    website = 'https://' + website;
  }

  const page = await context.newPage();
  try {
    await page.goto(website, {
      waitUntil: 'domcontentloaded',
      timeout:   timeoutMs
    });
    await page.waitForTimeout(Math.min(waitMs, 3000));

    const parts = [];

    // Extract structured content — each wrapped in try/catch
    try {
      const headlineText = await page.$$eval('h1, h2', els =>
        els.slice(0, 5).map(e => e.innerText.trim()).filter(t => t.length > 3)
      );
      parts.push(...headlineText);
    } catch (_) {}

    try {
      const metaDesc = await page.$eval('meta[name="description"]', el => el.content);
      if (metaDesc && metaDesc.length > 10) parts.push(metaDesc);
    } catch (_) {}

    try {
      const paragraphs = await page.$$eval('p', els =>
        els.slice(0, 5).map(e => e.innerText.trim()).filter(t => t.length > 20)
      );
      parts.push(...paragraphs);
    } catch (_) {}

    try {
      const aboutText = await page.$$eval('.about, #about, [class*="about"]', els =>
        els.slice(0, 2).map(e => e.innerText.trim()).filter(t => t.length > 10)
      );
      parts.push(...aboutText);
    } catch (_) {}

    // Try /about page if main page didn't yield much
    if (parts.join('').length < 200) {
      try {
        const aboutUrl = new URL('/about', website).href;
        if (aboutUrl !== website) {
          await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
          await page.waitForTimeout(1000);

          const aboutPageText = await page.$$eval('p, h1, h2', els =>
            els.slice(0, 5).map(e => e.innerText.trim()).filter(t => t.length > 10)
          ).catch(() => []);
          parts.push(...aboutPageText);
        }
      } catch (_) {
        // /about doesn't exist or fails, that's fine
      }
    }

    if (config?.scraping?.save_screenshots) {
      await page.screenshot({ path: join(screenshotsDir, `${lead.id}_website.png`) }).catch(() => {});
    }

    const combined = parts.join('\n').replace(/<[^>]*>/g, '').trim();
    return combined.length > 10 ? combined.slice(0, maxLen) : null;
  } catch (err) {
    logger.warn({ module: 'scraper', leadId: lead.id }, `Website scrape failed for ${website}: ${err.message}`);
    return null;
  } finally {
    try { await page.close(); } catch (_) {}
  }
}
