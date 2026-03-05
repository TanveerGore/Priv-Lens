/**
 * PrivLens – popup.js
 * Orchestrates the extension popup: fetches analysis from backend,
 * renders the UI, and wires up interactions.
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const BACKEND_URL = 'http://localhost:3000';

// ─── DOM REFS ─────────────────────────────────────────────────────────────────

const loadingState  = document.getElementById('loadingState');
const mainContent   = document.getElementById('mainContent');
const errorState    = document.getElementById('errorState');
const loadingStatus = document.getElementById('loadingStatus');

const siteDomain    = document.getElementById('siteDomain');
const siteFavicon   = document.getElementById('siteFavicon');
const riskBadge     = document.getElementById('riskBadge');
const scoreNum      = document.getElementById('scoreNum');
const scoreVerdict  = document.getElementById('scoreVerdict');
const scoreArc      = document.getElementById('scoreArc');
const scoreBarFill  = document.getElementById('scoreBarFill');
const gradStop1     = document.getElementById('gradStop1');
const gradStop2     = document.getElementById('gradStop2');

const aiSummary     = document.getElementById('aiSummary');
const riskList      = document.getElementById('riskList');
const riskCount     = document.getElementById('riskCount');
const trackerGrid   = document.getElementById('trackerGrid');
const trackerCount  = document.getElementById('trackerCount');
const mismatchCard  = document.getElementById('mismatchCard');
const mismatchList  = document.getElementById('mismatchList');
const reportBtn     = document.getElementById('reportBtn');
const refreshBtn    = document.getElementById('refreshBtn');
const retryBtn      = document.getElementById('retryBtn');

// ─── SCORE RING CONSTANTS ─────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 54; // r=54  → 339.29

// ─── UTILITY ─────────────────────────────────────────────────────────────────

function show(el)  { el.classList.remove('hidden'); }
function hide(el)  { el.classList.add('hidden'); }

function getScoreColors(score) {
  if (score >= 8) return { c1: '#22C55E', c2: '#16A34A', cls: 'safe',     label: 'Safe' };
  if (score >= 5) return { c1: '#FACC15', c2: '#CA8A04', cls: 'moderate', label: 'Moderate Risk' };
  return           { c1: '#EF4444', c2: '#DC2626', cls: 'risky',    label: 'High Risk' };
}

function setStatus(msg) { loadingStatus.textContent = msg; }

// ─── RENDER FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Animate the score ring and bar.
 */
function renderScore(score) {
  const clampedScore = Math.max(0, Math.min(10, score));
  const { c1, c2, cls, label } = getScoreColors(clampedScore);
  const dashOffset = CIRCUMFERENCE * (1 - clampedScore / 10);

  // Number
  scoreNum.textContent = clampedScore;

  // Ring
  setTimeout(() => {
    scoreArc.style.strokeDashoffset = dashOffset;
    gradStop1.setAttribute('stop-color', c1);
    gradStop2.setAttribute('stop-color', c2);
    scoreArc.style.filter = `drop-shadow(0 0 8px ${c1}88)`;
  }, 100);

  // Bar
  setTimeout(() => {
    scoreBarFill.style.width = `${(clampedScore / 10) * 100}%`;
    scoreBarFill.style.background = `linear-gradient(90deg, ${c1}, ${c2})`;
    scoreBarFill.style.boxShadow = `0 0 8px ${c1}66`;
  }, 100);

  // Verdict & badge
  scoreVerdict.textContent = label;
  scoreVerdict.className   = `score-verdict ${cls}`;

  riskBadge.textContent = label;
  riskBadge.className   = `risk-badge ${cls}`;
}

/**
 * Populate the AI summary card.
 */
function renderSummary(summary) {
  aiSummary.textContent = summary || 'No summary available.';
}

/**
 * Render the privacy risks list.
 */
function renderRisks(risks) {
  riskList.innerHTML = '';
  if (!risks || risks.length === 0) {
    riskList.innerHTML = '<li class="risk-item" style="color:var(--text-3)">No significant risks detected.</li>';
    riskCount.textContent = '0';
    return;
  }

  riskCount.textContent = risks.length;

  risks.forEach((risk, i) => {
    const li = document.createElement('li');
    const severity = risk.toLowerCase().includes('third') ||
                     risk.toLowerCase().includes('sell') ? 'high' : '';
    li.className = `risk-item ${severity}`;
    li.innerHTML = `<span class="risk-dot"></span>${escapeHtml(risk)}`;
    li.style.animationDelay = `${i * 0.07}s`;
    li.style.animation = 'chipIn 0.3s ease backwards';
    riskList.appendChild(li);
  });
}

/**
 * Render the trackers grid.
 */
function renderTrackers(trackers) {
  trackerGrid.innerHTML = '';
  if (!trackers || trackers.length === 0) {
    trackerGrid.innerHTML = '<div class="tracker-empty">No trackers detected ✓</div>';
    trackerCount.textContent = '0';
    return;
  }

  trackerCount.textContent = trackers.length;

  trackers.forEach((tracker, i) => {
    const chip = document.createElement('div');
    chip.className = 'tracker-chip';
    chip.style.animationDelay = `${i * 0.06}s`;
    chip.innerHTML = `<span class="tracker-dot"></span>${escapeHtml(tracker)}`;
    trackerGrid.appendChild(chip);
  });
}

/**
 * Render policy-vs-reality mismatches (optional feature).
 */
function renderMismatches(mismatches) {
  if (!mismatches || mismatches.length === 0) {
    hide(mismatchCard);
    return;
  }

  show(mismatchCard);
  mismatchList.innerHTML = '';
  mismatches.forEach(m => {
    const li = document.createElement('li');
    li.className = 'mismatch-item';
    li.innerHTML = `<strong>Policy:</strong> ${escapeHtml(m.policy)}<br>
                    <strong>Reality:</strong> ${escapeHtml(m.reality)}`;
    mismatchList.appendChild(li);
  });
}

/**
 * Render the site favicon using Google's favicon CDN.
 */
function renderFavicon(domain) {
  siteFavicon.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32"
    onerror="this.style.display='none'" alt="" />`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ─── SHOW STATES ──────────────────────────────────────────────────────────────

function showLoading() {
  show(loadingState);
  hide(mainContent);
  hide(errorState);
}

function showMain() {
  hide(loadingState);
  show(mainContent);
  hide(errorState);
}

function showError(title, msg) {
  hide(loadingState);
  hide(mainContent);
  show(errorState);
  document.getElementById('errorTitle').textContent = title || 'Analysis failed';
  document.getElementById('errorMsg').textContent   = msg   || 'Could not analyze this page.';
}

// ─── MAIN FLOW ────────────────────────────────────────────────────────────────

async function runAnalysis() {
  showLoading();

  try {
    // 1. Get current tab info
    setStatus('Getting current tab…');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) throw new Error('No active tab found.');

    const url    = new URL(tab.url);
    const domain = url.hostname.replace(/^www\./, '');

    // Update domain display immediately
    siteDomain.textContent = domain;
    renderFavicon(domain);

    // 2. Try to get trackers from background (already collected via webRequest)
    setStatus('Detecting trackers…');
    let detectedTrackers = [];
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_TRACKERS', tabId: tab.id });
      if (resp && resp.trackers) detectedTrackers = resp.trackers;
    } catch (_) { /* background may not be ready */ }

    // 3. Ask content script for policy link (already on page)
    setStatus('Locating privacy policy…');
    let policyUrl = null;
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'GET_POLICY_URL' });
      if (resp && resp.policyUrl) policyUrl = resp.policyUrl;
    } catch (_) { /* content script not injected on this page */ }

    // Fallback: construct likely policy URL
    if (!policyUrl) {
      policyUrl = `${url.protocol}//${url.hostname}/privacy-policy`;
    }

    // 4. Check cache
    const cacheKey = `privlens_${domain}`;
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey] && (Date.now() - cached[cacheKey].ts < 1000 * 60 * 30)) {
      // Fresh cache (< 30 min)
      setStatus('Loading cached results…');
      const data = cached[cacheKey].data;
      data.trackers = detectedTrackers.length > 0 ? detectedTrackers : data.trackers;
      renderAll(data, domain, policyUrl);
      return;
    }

    // 5. Call backend for analysis
    setStatus('Fetching & analyzing privacy policy…');
    const response = await fetch(`${BACKEND_URL}/api/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ domain, policyUrl, trackers: detectedTrackers }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${response.status}`);
    }

    const data = await response.json();
    data.trackers = detectedTrackers.length > 0 ? detectedTrackers : (data.trackers || []);

    // 6. Cache result
    await chrome.storage.local.set({
      [cacheKey]: { ts: Date.now(), data }
    });

    renderAll(data, domain, policyUrl);

  } catch (err) {
    console.error('[PrivLens]', err);
    showError('Analysis failed', err.message || 'Could not connect to backend. Make sure the PrivLens server is running on port 3000.');
  }
}

function renderAll(data, domain, policyUrl) {
  renderScore(data.privacy_score ?? data.privacyScore ?? 5);
  renderSummary(data.summary);
  renderRisks(data.risk_points ?? data.riskPoints ?? []);
  renderTrackers(data.trackers ?? []);
  renderMismatches(data.mismatches ?? []);

  if (policyUrl) {
    reportBtn.href = policyUrl;
  }

  showMain();
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

refreshBtn.addEventListener('click', () => {
  // Clear cache for current domain then re-run
  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab?.url) return;
    const domain = new URL(tab.url).hostname.replace(/^www\./,'');
    await chrome.storage.local.remove(`privlens_${domain}`);
    runAnalysis();
  });
});

retryBtn.addEventListener('click', runAnalysis);

// ─── BOOT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', runAnalysis);
