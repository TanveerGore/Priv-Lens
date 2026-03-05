/**
 * PrivLens – backend/server.js
 * Express server that powers the privacy analysis API.
 * 
 * Endpoints:
 *   POST /api/analyze  →  Full privacy policy analysis
 *   GET  /health       →  Health check
 */

'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const analyzeRouter = require('./routes/analyze');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: ['chrome-extension://*', 'null'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Allow requests from Chrome extensions (null origin)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.use('/api', analyzeRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'PrivLens API', version: '1.0.0' });
});

// ─── 404 & ERROR ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[PrivLens Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🔒 PrivLens API running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Analyze: POST http://localhost:${PORT}/api/analyze\n`);
});

module.exports = app;
