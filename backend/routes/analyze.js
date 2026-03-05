/**
 * PrivLens – backend/routes/analyze.js
 * 
 * POST /api/analyze
 * Body: { domain, policyUrl, trackers[] }
 * 
 * Flow:
 *  1. Scrape the privacy policy text
 *  2. Send to AI for summarization + risk extraction
 *  3. Calculate privacy score
 *  4. Detect policy/reality mismatches
 *  5. Return structured JSON
 */

'use strict';

const express        = require('express');
const router         = express.Router();
const policyScraper  = require('../services/policyScraper');
const aiSummarizer   = require('../services/aiSummarizer');
const privacyScore   = require('../services/privacyScore');

// ─── POST /analyze ────────────────────────────────────────────────────────────

router.post('/analyze', async (req, res) => {
  const { domain, policyUrl, trackers = [] } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'domain is required' });
  }

  console.log(`[Analyze] ${domain} — policy: ${policyUrl || 'auto-detect'}`);

  try {
    // ── 1. Scrape policy text ────────────────────────────────────────────────
    let policyText = '';
    let usedUrl    = policyUrl;

    if (policyUrl) {
      try {
        policyText = await policyScraper.scrape(policyUrl);
      } catch (scrapeErr) {
        console.warn(`[Scrape] Failed for ${policyUrl}: ${scrapeErr.message}`);
      }
    }

    // Fallback: try common privacy URL patterns
    if (!policyText) {
      const fallbacks = [
        `https://${domain}/privacy-policy`,
        `https://${domain}/privacy`,
        `https://${domain}/legal/privacy`,
        `https://www.${domain}/privacy-policy`,
        `https://www.${domain}/privacy`,
      ];

      for (const url of fallbacks) {
        try {
          policyText = await policyScraper.scrape(url);
          if (policyText && policyText.length > 200) {
            usedUrl = url;
            break;
          }
        } catch (_) { /* try next */ }
      }
    }

    // ── 2. AI summarization ──────────────────────────────────────────────────
    let aiResult;

    try {
      if (policyText && policyText.length > 100) {
        aiResult = await aiSummarizer.analyze(policyText, domain);
      } else {
        // No policy found — use domain-aware fallback analysis
        aiResult = await aiSummarizer.analyzeByDomain(domain, trackers);
      }
    } catch (aiErr) {
      console.warn('[AI Error]', aiErr.message);
      // Fallback to dummy data
      aiResult = {
        summary: 'Unable to analyze privacy policy due to API issues. Please check your API key and configuration.',
        risk_points: ['API analysis failed'],
        privacy_score: 5,
        has_delete_right: false,
      };
    }

    // ── 3. Privacy score ─────────────────────────────────────────────────────
    const scoreResult = privacyScore.calculate({
      riskPoints:   aiResult.risk_points || [],
      trackers,
      hasDeleteRight: aiResult.has_delete_right,
      scoreFromAI:  aiResult.privacy_score,
    });

    // ── 4. Mismatch detection ────────────────────────────────────────────────
    const mismatches = detectMismatches(aiResult, trackers);

    // ── 5. Response ──────────────────────────────────────────────────────────
    res.json({
      domain,
      policy_url:    usedUrl,
      summary:       aiResult.summary,
      risk_points:   aiResult.risk_points || [],
      privacy_score: scoreResult.score,
      risk_level:    scoreResult.level,
      trackers:      trackers,
      mismatches,
      policy_found:  policyText.length > 100,
    });

  } catch (err) {
    console.error('[Analyze Error]', err);
    res.status(500).json({
      error:   'Analysis failed',
      details: err.message,
    });
  }
});

// ─── MISMATCH DETECTION ───────────────────────────────────────────────────────

function detectMismatches(aiResult, trackers) {
  const mismatches = [];
  const summary    = (aiResult.summary || '').toLowerCase();
  const risks      = (aiResult.risk_points || []).map(r => r.toLowerCase()).join(' ');

  // Claim: limited third-party sharing → Reality: FB Pixel detected
  const claimsLimitedSharing =
    summary.includes('limited') && (summary.includes('sharing') || summary.includes('third party'));

  if (claimsLimitedSharing && trackers.some(t => /facebook|meta/i.test(t))) {
    mismatches.push({
      policy:  'Claims limited third-party data sharing',
      reality: 'Facebook Pixel detected — data shared with Meta',
    });
  }

  // Claim: no advertising → Reality: ad trackers detected
  const claimsNoAds = summary.includes('no advertising') || summary.includes('not used for advertising');
  const hasAdTrackers = trackers.some(t => /adroll|criteo|doubleclick|taboola|outbrain/i.test(t));

  if (claimsNoAds && hasAdTrackers) {
    mismatches.push({
      policy:  'States data is not used for advertising',
      reality: 'Advertising tracker scripts detected on page',
    });
  }

  // Claim: no analytics → Reality: analytics detected
  const claimsNoAnalytics = summary.includes('no analytics') || summary.includes('not collect analytics');
  const hasAnalytics = trackers.some(t => /analytics|mixpanel|segment|amplitude/i.test(t));

  if (claimsNoAnalytics && hasAnalytics) {
    mismatches.push({
      policy:  'Claims analytics data is not collected',
      reality: 'Analytics tracking scripts detected',
    });
  }

  return mismatches;
}

module.exports = router;
