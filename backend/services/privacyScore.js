/**
 * PrivLens – backend/services/privacyScore.js
 * 
 * Calculates a final privacy score from AI results + detected trackers.
 * 
 * Score range:  0 – 10
 * Safe:         8 – 10
 * Moderate:     5 – 7
 * Risky:        0 – 4
 */

'use strict';

// ─── SCORING RULES ────────────────────────────────────────────────────────────

const RISK_DEDUCTIONS = [
  // Rule: { test: fn(riskText) => bool, points: number, label: string }
  {
    label:  'Data shared with advertisers',
    points: 2,
    test:   (r) => /advert|advertis|marketing partner|third.party partner/i.test(r),
  },
  {
    label:  'Third-party tracking',
    points: 2,
    test:   (r) => /third.party track|cross.site track|tracking technolog|pixel/i.test(r),
  },
  {
    label:  'Long or undefined data retention',
    points: 1,
    test:   (r) => /retention|indefinite|long.term|years/i.test(r),
  },
  {
    label:  'Vague or unclear privacy language',
    points: 1,
    test:   (r) => /vague|unclear|may share|might share|at our discretion/i.test(r),
  },
  {
    label:  'No user rights mentioned',
    points: 1,
    test:   (r) => /no user rights|no opt.out|cannot delete|cannot opt/i.test(r),
  },
  {
    label:  'Data sold to third parties',
    points: 2,
    test:   (r) => /sell.*data|data.*sold|sold to third/i.test(r),
  },
];

const TRACKER_DEDUCTIONS = [
  { pattern: /facebook|meta pixel/i,  points: 1.5, label: 'Facebook Pixel' },
  { pattern: /doubleclick/i,           points: 1,   label: 'DoubleClick' },
  { pattern: /google analytics/i,      points: 0.5, label: 'Google Analytics' },
  { pattern: /hotjar|fullstory/i,      points: 1,   label: 'Session Replay Tracker' },
  { pattern: /criteo|adroll/i,         points: 1,   label: 'Ad Retargeting' },
];

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * @param {object}   opts
 * @param {string[]} opts.riskPoints      - AI-detected risk descriptions
 * @param {string[]} opts.trackers        - Tracker names detected on page
 * @param {boolean}  opts.hasDeleteRight  - Whether policy allows data deletion
 * @param {number}   [opts.scoreFromAI]   - Raw AI suggestion (used as hint)
 * @returns {{ score: number, level: string, breakdown: object[] }}
 */
function calculate({ riskPoints = [], trackers = [], hasDeleteRight = false, scoreFromAI }) {
  let score    = 10;
  const log    = [];

  // ── 1. Deduct based on risk point text ─────────────────────────────────────
  const allRiskText = riskPoints.join(' ').toLowerCase();

  for (const rule of RISK_DEDUCTIONS) {
    if (rule.test(allRiskText)) {
      score -= rule.points;
      log.push({ reason: rule.label, delta: -rule.points });
    }
  }

  // ── 2. Deduct based on detected trackers ───────────────────────────────────
  const trackerStr = trackers.join(' ');
  let trackerPenalty = 0;

  for (const td of TRACKER_DEDUCTIONS) {
    if (td.pattern.test(trackerStr)) {
      trackerPenalty += td.points;
      log.push({ reason: `Tracker: ${td.label}`, delta: -td.points });
    }
  }

  // Cap tracker penalty at 3 (avoid double-penalising heavily tracked sites)
  trackerPenalty = Math.min(trackerPenalty, 3);
  score -= trackerPenalty;

  // ── 3. Any tracker at all = small baseline penalty ─────────────────────────
  if (trackers.length > 0 && trackerPenalty === 0) {
    score -= 0.5;
    log.push({ reason: 'Trackers present', delta: -0.5 });
  }

  // ── 4. Bonus for deletion right ────────────────────────────────────────────
  if (hasDeleteRight) {
    score += 1;
    log.push({ reason: 'User data deletion allowed', delta: +1 });
  }

  // ── 5. Blend with AI score hint (weighted 80/20 our calc, AI hint) ─────────
  if (typeof scoreFromAI === 'number' && !isNaN(scoreFromAI)) {
    score = Math.round(score * 0.8 + scoreFromAI * 0.2);
  }

  // ── 6. Clamp ───────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(10, Math.round(score)));

  return {
    score,
    level:     getLevel(score),
    breakdown: log,
  };
}

function getLevel(score) {
  if (score >= 8) return 'Safe';
  if (score >= 5) return 'Moderate Risk';
  return 'High Risk';
}

module.exports = { calculate };
