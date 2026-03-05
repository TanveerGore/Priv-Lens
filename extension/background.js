/**
 * PrivLens – background.js (Service Worker)
 * 
 * Responsibilities:
 *  1. Monitor all network requests per tab
 *  2. Identify third-party trackers
 *  3. Provide tracker lists to the popup on demand
 *  4. Handle extension lifecycle events
 */

'use strict';

// ─── TRACKER DEFINITIONS ─────────────────────────────────────────────────────

const TRACKER_SIGNATURES = [
  { pattern: /google-analytics\.com/i,         name: 'Google Analytics' },
  { pattern: /googletagmanager\.com/i,          name: 'Google Tag Manager' },
  { pattern: /googlesyndication\.com/i,         name: 'Google AdSense' },
  { pattern: /doubleclick\.net/i,               name: 'DoubleClick' },
  { pattern: /facebook\.net/i,                  name: 'Facebook Pixel' },
  { pattern: /facebook\.com\/tr/i,              name: 'Facebook Pixel' },
  { pattern: /connect\.facebook\.net/i,         name: 'Facebook SDK' },
  { pattern: /hotjar\.com/i,                    name: 'Hotjar' },
  { pattern: /mixpanel\.com/i,                  name: 'Mixpanel' },
  { pattern: /segment\.io/i,                    name: 'Segment' },
  { pattern: /segment\.com/i,                   name: 'Segment' },
  { pattern: /amplitude\.com/i,                 name: 'Amplitude' },
  { pattern: /fullstory\.com/i,                 name: 'FullStory' },
  { pattern: /mouseflow\.com/i,                 name: 'Mouseflow' },
  { pattern: /clarity\.ms/i,                    name: 'Microsoft Clarity' },
  { pattern: /linkedin\.com\/insight/i,         name: 'LinkedIn Insight' },
  { pattern: /twitter\.com\/i\/adsct/i,         name: 'Twitter Ads' },
  { pattern: /ads\.twitter\.com/i,              name: 'Twitter Ads' },
  { pattern: /snap\.licdn\.com/i,               name: 'LinkedIn' },
  { pattern: /sc-static\.net/i,                 name: 'Snapchat Pixel' },
  { pattern: /tiktok\.com/i,                    name: 'TikTok Pixel' },
  { pattern: /pintrk/i,                         name: 'Pinterest Tag' },
  { pattern: /pinterest\.com\/v3/i,             name: 'Pinterest Tag' },
  { pattern: /criteo\.com/i,                    name: 'Criteo' },
  { pattern: /taboola\.com/i,                   name: 'Taboola' },
  { pattern: /outbrain\.com/i,                  name: 'Outbrain' },
  { pattern: /pubmatic\.com/i,                  name: 'PubMatic' },
  { pattern: /rubiconproject\.com/i,             name: 'Rubicon Project' },
  { pattern: /adroll\.com/i,                    name: 'AdRoll' },
  { pattern: /adsrvr\.org/i,                    name: 'The Trade Desk' },
  { pattern: /intercom\.io/i,                   name: 'Intercom' },
  { pattern: /hubspot\.com/i,                   name: 'HubSpot' },
  { pattern: /pardot\.com/i,                    name: 'Salesforce Pardot' },
  { pattern: /marketo\.net/i,                   name: 'Marketo' },
  { pattern: /newrelic\.com/i,                  name: 'New Relic' },
  { pattern: /datadog-browser-agent/i,          name: 'Datadog RUM' },
  { pattern: /sentry\.io/i,                     name: 'Sentry' },
  { pattern: /loggly\.com/i,                    name: 'Loggly' },
];

// ─── PER-TAB TRACKER STORAGE ──────────────────────────────────────────────────

// Map<tabId, Set<trackerName>>
const tabTrackers = new Map();

// ─── NETWORK REQUEST MONITORING ──────────────────────────────────────────────

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return; // background requests

    const url = details.url;
    for (const sig of TRACKER_SIGNATURES) {
      if (sig.pattern.test(url)) {
        if (!tabTrackers.has(details.tabId)) {
          tabTrackers.set(details.tabId, new Set());
        }
        tabTrackers.get(details.tabId).add(sig.name);
        break; // one tracker per URL match is sufficient
      }
    }
  },
  { urls: ['<all_urls>'] }
);

// ─── CLEANUP ON TAB NAVIGATION ────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    // New navigation: reset tracker list
    tabTrackers.delete(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabTrackers.delete(tabId);
});

// ─── MESSAGE HANDLER ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_TRACKERS') {
    const trackers = tabTrackers.has(message.tabId)
      ? Array.from(tabTrackers.get(message.tabId))
      : [];
    sendResponse({ trackers });
    return true;
  }

  if (message.type === 'POLICY_URL_FOUND') {
    // Store for possible prefetch (future feature)
    chrome.storage.session?.set?.({
      [`policy_${message.domain}`]: message.url
    }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
});

// ─── EXTENSION INSTALL HANDLER ────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[PrivLens] Extension installed. Backend should be running on port 3000.');
});
