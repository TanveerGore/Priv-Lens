/**
 * PrivLens – content.js
 * Injected into every web page.
 * Responsibilities:
 *  1. Scan the page for privacy policy links
 *  2. Respond to popup requests with the discovered link
 */

(function () {
  'use strict';

  // ─── PRIVACY POLICY LINK DETECTION ──────────────────────────────────────────

  /**
   * Known URL patterns for privacy policies.
   */
  const POLICY_PATTERNS = [
    /privacy[-_]?policy/i,
    /privacy[-_]?notice/i,
    /privacy[-_]?statement/i,
    /data[-_]?privacy/i,
    /datenschutz/i,           // German
    /politique[-_]?de[-_]?confidentialite/i, // French
    /\/privacy\/?$/i,
    /\/legal\/privacy/i,
  ];

  /**
   * Known anchor text that links to privacy policies.
   */
  const LINK_TEXT_PATTERNS = [
    /^privacy\s*(policy|notice|statement)?$/i,
    /^data\s*privacy$/i,
    /^your\s*privacy$/i,
    /^privacy\s*&\s*terms$/i,
  ];

  function findPrivacyPolicyUrl() {
    const anchors = Array.from(document.querySelectorAll('a[href]'));

    // 1. Match by href pattern (most reliable)
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      if (POLICY_PATTERNS.some(p => p.test(href))) {
        return absoluteUrl(href);
      }
    }

    // 2. Match by visible link text
    for (const a of anchors) {
      const text = (a.textContent || '').trim();
      if (LINK_TEXT_PATTERNS.some(p => p.test(text))) {
        const href = a.getAttribute('href') || '';
        if (href) return absoluteUrl(href);
      }
    }

    // 3. Match by aria-label
    for (const a of anchors) {
      const label = (a.getAttribute('aria-label') || '').trim();
      if (LINK_TEXT_PATTERNS.some(p => p.test(label))) {
        const href = a.getAttribute('href') || '';
        if (href) return absoluteUrl(href);
      }
    }

    return null;
  }

  function absoluteUrl(href) {
    try {
      return new URL(href, window.location.href).href;
    } catch {
      return null;
    }
  }

  // ─── MESSAGE HANDLER ─────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_POLICY_URL') {
      const policyUrl = findPrivacyPolicyUrl();
      sendResponse({ policyUrl });
      return true; // keep channel open
    }
  });

  // ─── AUTO-SIGNAL TO BACKGROUND ───────────────────────────────────────────────

  // When the page loads, proactively send the policy URL to the background
  // so it can start a prefetch if desired.
  try {
    const policyUrl = findPrivacyPolicyUrl();
    if (policyUrl) {
      chrome.runtime.sendMessage({
        type:   'POLICY_URL_FOUND',
        domain: window.location.hostname,
        url:    policyUrl,
      }).catch(() => {}); // ignore if background is not ready
    }
  } catch (_) {}

})();
