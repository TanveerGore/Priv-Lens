/**
 * PrivLens – backend/services/aiSummarizer.js
 * 
 * Sends privacy policy text to an LLM and parses structured output.
 * 
 * Supported providers (set via AI_PROVIDER env var):
 *   - openai  → uses OpenAI GPT-4o-mini (default)
 *   - gemini  → uses Google Gemini 1.5 Flash
 *   - claude  → uses Anthropic claude-3-haiku
 * 
 * Response schema:
 * {
 *   summary:          string,
 *   risk_points:      string[],
 *   privacy_score:    number (0-10),
 *   has_delete_right: boolean,
 * }
 */

'use strict';

const axios = require('axios');

// ─── PROVIDER CONFIG ──────────────────────────────────────────────────────────

const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai').toLowerCase();

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a privacy policy analyst. You read privacy policies and return a structured JSON analysis. Always respond with valid JSON only — no markdown, no explanation outside the JSON.`;

function buildUserPrompt(policyText, domain) {
  return `Analyze this privacy policy for ${domain}.

POLICY TEXT:
${policyText}

Return ONLY this JSON structure (no markdown, no extra text):
{
  "summary": "<2-3 sentence plain-English summary of what this company does with user data>",
  "risk_points": [
    "<specific risk 1>",
    "<specific risk 2>",
    "<specific risk 3>"
  ],
  "privacy_score": <integer 0-10 where 10 is most private>,
  "has_delete_right": <true or false — does the policy explicitly allow users to delete their data>
}

Scoring guide:
- Start at 10
- Subtract 2 if data is shared with advertisers
- Subtract 2 if third-party tracking technologies are used
- Subtract 1 if data retention period is long or undefined
- Subtract 1 if privacy language is vague or unclear
- Subtract 1 if there is no mention of user rights
- Add 1 if explicit data deletion is allowed
- Add 1 if GDPR/CCPA compliance is mentioned

Risk points should be specific, actionable sentences like:
  "User behavior data shared with advertising partners"
  "Third-party tracking cookies enabled across sessions"
  "Data retained indefinitely or for vague periods"
  "No explicit opt-out mechanism"`;
}

function buildDomainFallbackPrompt(domain, trackers) {
  return `I could not retrieve the privacy policy for ${domain}.
${trackers.length > 0 ? `The following trackers were detected on the site: ${trackers.join(', ')}.` : ''}

Based on the domain name and detected trackers, provide a general privacy analysis.

Return ONLY this JSON structure:
{
  "summary": "<2-3 sentence general privacy risk summary based on domain type and detected trackers>",
  "risk_points": [
    "<risk 1>",
    "<risk 2>",
    "<risk 3>"
  ],
  "privacy_score": <integer 0-10>,
  "has_delete_right": false
}`;
}

// ─── MAIN EXPORTS ─────────────────────────────────────────────────────────────

/**
 * Analyze a full policy text.
 */
async function analyze(policyText, domain) {
  const prompt = buildUserPrompt(policyText, domain);
  return callAI(prompt);
}

/**
 * Analyze just from domain + trackers (fallback when policy not found).
 */
async function analyzeByDomain(domain, trackers) {
  const prompt = buildDomainFallbackPrompt(domain, trackers);
  return callAI(prompt);
}

// ─── AI ROUTER ────────────────────────────────────────────────────────────────

async function callAI(userPrompt) {
  switch (AI_PROVIDER) {
    case 'gemini': return callGemini(userPrompt);
    case 'claude': return callClaude(userPrompt);
    default: return callOpenAI(userPrompt);
  }
}

// ─── OPENAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set in environment');

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 800,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  );

  const text = response.data.choices?.[0]?.message?.content || '{}';
  return parseAIResponse(text);
}

// ─── GEMINI ───────────────────────────────────────────────────────────────────

async function callGemini(userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment');

  // Try gemini-2.5-flash first
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await axios.post(
      endpoint,
      {
        contents: [{
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
        },
      },
      { timeout: 30_000 }
    );

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return parseAIResponse(text);
  } catch (err) {
    console.error('[Gemini API Error]', {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
}

// ─── CLAUDE (ANTHROPIC) ───────────────────────────────────────────────────────

async function callClaude(userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in environment');

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  );

  const text = response.data.content?.[0]?.text || '{}';
  return parseAIResponse(text);
}

// ─── RESPONSE PARSER ─────────────────────────────────────────────────────────

function parseAIResponse(text) {
  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON object found');

    const jsonStr = text.substring(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonStr);

    return {
      summary: String(parsed.summary || 'Analysis not available.'),
      risk_points: Array.isArray(parsed.risk_points) ? parsed.risk_points : [],
      privacy_score: typeof parsed.privacy_score === 'number' ? parsed.privacy_score : 5,
      has_delete_right: Boolean(parsed.has_delete_right),
    };
  } catch (err) {
    console.error('[AI Parse Error]', err.message, '\nRaw:', text.slice(0, 200));
    return {
      summary: 'Privacy policy analysis completed. See risk points for details.',
      risk_points: ['Could not parse detailed risks — review policy manually.'],
      privacy_score: 5,
      has_delete_right: false,
    };
  }
}

module.exports = { analyze, analyzeByDomain };
