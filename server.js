// server.js — Humanizer v13
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { humanize, answerAsHuman } from './pipeline.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve static files — no cache on HTML
app.use(express.static(__dirname, {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }
}));

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(__dirname + '/index.html');
});

// ─── Session & Usage System ──────────────────────────────────────────────────
const sessions = new Map();
const PLANS = {
  free:      { uses: 2,  monthly: false },
  basic:     { uses: 20, monthly: true },
  pro:       { uses: 50, monthly: true },
  unlimited: { uses: -1, monthly: true }
};

function getOrCreateSession(token) {
  if (token && sessions.has(token)) return sessions.get(token);
  const newToken = crypto.randomUUID();
  const session = { token: newToken, plan: 'free', usesLeft: 2, totalUses: 0 };
  sessions.set(newToken, session);
  return session;
}

function checkUsage(req, res) {
  const token = req.headers['x-session-token'];
  const session = getOrCreateSession(token);
  if (session.usesLeft === 0) {
    res.status(402).json({ error: 'OUT_OF_USES' });
    return null;
  }
  // Decrement (unless unlimited which is -1)
  if (session.usesLeft > 0) session.usesLeft--;
  session.totalUses++;
  return session;
}

// GET /session — return or create session
app.get('/session', (req, res) => {
  const token = req.headers['x-session-token'];
  const session = getOrCreateSession(token);
  res.json({
    token: session.token,
    usesLeft: session.usesLeft,
    plan: session.plan,
    totalUses: session.totalUses
  });
});

// POST /use — decrement uses manually
app.post('/use', (req, res) => {
  const token = req.headers['x-session-token'];
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Invalid session' });
  const session = sessions.get(token);
  if (session.usesLeft === 0) return res.status(402).json({ error: 'OUT_OF_USES' });
  if (session.usesLeft > 0) session.usesLeft--;
  session.totalUses++;
  res.json({ usesLeft: session.usesLeft, plan: session.plan, totalUses: session.totalUses });
});

// POST /upgrade — upgrade plan (no real payment yet)
app.post('/upgrade', (req, res) => {
  const { token, plan } = req.body;
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Invalid session' });
  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });
  const session = sessions.get(token);
  session.plan = plan;
  session.usesLeft = PLANS[plan].uses;
  res.json({
    token: session.token,
    usesLeft: session.usesLeft,
    plan: session.plan,
    totalUses: session.totalUses
  });
});

// ─── /humanize ────────────────────────────────────────────────────────────────
app.post('/humanize', async (req, res) => {
  // Check usage
  const session = checkUsage(req, res);
  if (!session) return;

  const { apiKey, text, strength, styleProfile } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  if (!text) return res.status(400).json({ error: 'Missing text' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const result = await humanize(
      apiKey, text, strength || 'aggressive', styleProfile || null,
      ({ step, msg }) => send({ type: 'progress', step, msg })
    );
    send({ type: 'result', text: result.text, scores: result.scores, usesLeft: session.usesLeft });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }
  res.end();
});

// ─── /answer ──────────────────────────────────────────────────────────────────
app.post('/answer', async (req, res) => {
  // Check usage
  const session = checkUsage(req, res);
  if (!session) return;

  const { apiKey, question, styleProfile, history } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  if (!question) return res.status(400).json({ error: 'Missing question' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const result = await answerAsHuman(
      apiKey, question, styleProfile || null,
      ({ step, msg }) => send({ type: 'progress', step, msg }),
      Array.isArray(history) ? history : []
    );
    send({ type: 'result', text: result.text, scores: result.scores, usesLeft: session.usesLeft });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }
  res.end();
});

// ─── /extract-style ───────────────────────────────────────────────────────────
app.post('/extract-style', async (req, res) => {
  const { apiKey, sample } = req.body;
  if (!apiKey || !sample) return res.status(400).json({ error: 'Missing fields' });

  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content: `Analyze this writing sample and produce exactly 8 NEW sentences that capture this person's unique voice. Write on varied topics but copy their vocabulary, rhythm, formality, contractions, and sentence patterns exactly. Output ONLY the 8 sentences numbered 1–8, one per line. Nothing else.`
          },
          { role: 'user', content: sample }
        ],
        temperature: 0.3,
        max_tokens: 600
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error?.message || 'API error');
    const text = data.choices[0].message.content.trim();
    const examples = text.split('\n')
      .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(l => l.length > 12)
      .slice(0, 8);
    res.json({ examples });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Humanizer v13 running at http://localhost:${PORT}\n`);
});
