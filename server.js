// ═══════════════════════════════════════════════════════════════════
//  server.js — Express server
//  Serves the UI and proxies pipeline calls (solves CORS for Reddit)
// ═══════════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import { humanize } from './pipeline.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

// SSE endpoint — streams progress back to browser in real time
app.post('/humanize', async (req, res) => {
  const { apiKey, text, strength, styleProfile } = req.body;

  if (!apiKey) return res.status(400).json({ error: 'Missing API key' });
  if (!text) return res.status(400).json({ error: 'Missing text' });

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await humanize(
      apiKey,
      text,
      strength || 'aggressive',
      styleProfile || null,
      ({ step, msg }) => send({ type: 'progress', step, msg })
    );

    send({ type: 'result', text: result.text, scores: result.scores });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }

  res.end();
});

// Style extraction endpoint
app.post('/extract-style', async (req, res) => {
  const { apiKey, sample } = req.body;
  if (!apiKey || !sample) return res.status(400).json({ error: 'Missing fields' });

  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
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
    if (!response.ok) throw new Error(data.error?.message || 'Groq error');
    const text = data.choices[0].message.content.trim();
    const examples = text.split('\n').map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(l => l.length > 12).slice(0, 8);
    res.json({ examples });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Humanizer v8 running at http://localhost:${PORT}`);
  console.log(`  Open that URL in your browser.\n`);
});
