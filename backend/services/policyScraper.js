/**
 * PrivLens – backend/services/policyScraper.js
 * 
 * Fetches and parses privacy policy pages.
 * Uses cheerio for HTML parsing and extracts clean text.
 */

'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT  = 10_000; // 10 seconds
const MAX_TEXT_CHARS = 12_000; // Trim to avoid overwhelming AI context window

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36';

// Tags whose text content is noise
const SKIP_SELECTORS = [
  'script', 'style', 'noscript', 'svg', 'img',
  'nav', 'header', 'footer', '.cookie-banner',
  '.popup', '#cookie-notice', '.notification',
];

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * Fetch a URL and return the cleaned privacy policy text.
 * @param {string} url
 * @returns {Promise<string>} Cleaned text (up to MAX_TEXT_CHARS characters)
 */
async function scrape(url) {
  const html = await fetchHtml(url);
  const text = extractText(html);
  return text;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function fetchHtml(url) {
  try {
    const response = await axios.get(url, {
      timeout: FETCH_TIMEOUT,
      headers: {
        'User-Agent':      USER_AGENT,
        'Accept':          'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control':   'no-cache',
      },
      maxRedirects: 5,
      validateStatus: (s) => s < 400,
    });

    return response.data || '';
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${err.message}`);
  }
}

function extractText(html) {
  if (!html || typeof html !== 'string') return '';

  const $ = cheerio.load(html);

  // Remove noise elements
  $(SKIP_SELECTORS.join(',')).remove();

  // Try to find the main policy content area
  const candidates = [
    'main',
    '[class*="privacy"]',
    '[class*="policy"]',
    '[id*="privacy"]',
    '[id*="policy"]',
    'article',
    '.content',
    '#content',
    '.page-content',
    '.entry-content',
  ];

  let textContent = '';

  for (const selector of candidates) {
    const el = $(selector).first();
    if (el.length && el.text().trim().length > 500) {
      textContent = el.text();
      break;
    }
  }

  // Fallback: full body text
  if (!textContent || textContent.length < 200) {
    textContent = $('body').text();
  }

  // Clean whitespace
  textContent = textContent
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Verify it looks like a privacy policy
  if (!looksLikePrivacyPolicy(textContent)) {
    return '';
  }

  return textContent.slice(0, MAX_TEXT_CHARS);
}

/**
 * Basic heuristic: does the text look like a privacy policy?
 */
function looksLikePrivacyPolicy(text) {
  const lower = text.toLowerCase();
  const keywords = [
    'privacy', 'personal data', 'personal information',
    'data collection', 'cookies', 'third party',
    'data retention', 'gdpr', 'ccpa',
    'your rights', 'opt-out', 'tracking',
  ];
  const matches = keywords.filter(k => lower.includes(k)).length;
  return matches >= 2;
}

module.exports = { scrape };
