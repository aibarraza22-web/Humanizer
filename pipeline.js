// pipeline.js — Humanizer v15
// Dataset: Human vs AI writing by Aiden vs ChatGPT vs Claude
// AIDEN_EXAMPLES = all Aiden answers — write LIKE these
// AI_COUNTER_EXAMPLES = ChatGPT + Claude answers — write NOTHING like these
// hardScrub() = regex post-processor catching AI casual patterns

import fetch from 'node-fetch';
import { AIDEN_EXAMPLES, AI_COUNTER_EXAMPLES, BANNED, DRAMATIC_PHRASES, AI_OPENERS } from './data.js';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

// ═══════════════════════════════════════════════════════════════════
//  HARD SCRUB — regex post-processor, runs on every LLM output
//  Catches AI-trying-to-sound-casual patterns the model generates itself
// ═══════════════════════════════════════════════════════════════════
function hardScrub(text) {
  let t = text;

  // Em dashes → period + new sentence
  t = t.replace(/\s*—\s*/g, '. ');

  // "Here's the X:" setup phrases
  t = t.replace(/here's the (real |)?(twist|thing|deal|catch|key|truth|problem|issue|point)[:\s]/gi, 'The thing is, ');
  t = t.replace(/but here's (the |)(real |)?(twist|thing|deal|catch|key|truth)[:\s]/gi, 'But the thing is, ');
  t = t.replace(/here's (what|why|how)[:\s]/gi, '');
  t = t.replace(/the (bottom line|key takeaway|main point|real answer)[:\s]/gi, 'The main point is ');

  // Rhetorical questions + answer pattern
  t = t.replace(/([A-Z][^.!?]{2,30})\?\s+(Yeah,?\s+)?(they're|it's|that's|he's|she's|we're|they are|it is)/gi,
    (match, subject, yeah, verb) => `${subject} ${verb}`);
  t = t.replace(/\b(Now|Why|How|What|When|Where)\?\s+/g, '');

  // One-word dramatic standalone sentences
  const dramaticOneWord = [
    'Unstoppable','Remarkable','Extraordinary','Revolutionary','Transformative',
    'Unprecedented','Incredible','Unbelievable','Fascinating','Stunning',
    'Period','Full stop','Simple as that','End of story','Case closed',
    'Mind-blowing','Game-changing','Game changing','That simple','That easy','That big'
  ];
  for (const word of dramaticOneWord) {
    const pattern = new RegExp(`(\\.|\\n|^)\\s*${word}\\.\\s*`, 'gi');
    t = t.replace(pattern, (match, pre) => `${pre} `);
  }

  // Colon list setups mid-sentence
  t = t.replace(/[Bb]ut here's what('s| has) changed:\s*/g, 'But ');
  t = t.replace(/[Hh]ere's why:\s*/g, 'Because ');
  t = t.replace(/[Hh]ere's how:\s*/g, '');

  // Dramatic contrast sentences "Not X. Y them."
  t = t.replace(/\bNot (replacing|removing|eliminating|cutting|reducing)\s+([^.]+)\.\s+([A-Z][^.]+ing)\s+them\./g,
    "It's not about $1 $2. It's about $3 them.");

  // Clean up
  t = t.replace(/\.\.+/g, '.');
  t = t.replace(/\s{2,}/g, ' ');
  t = t.replace(/\.\s*\./g, '.');
  t = t.replace(/\.\s+([a-z])/g, (m, c) => `. ${c.toUpperCase()}`);

  return t.trim();
}

// ─── Mistral API ──────────────────────────────────────────────────────────────
async function mistral(apiKey, system, user, temp = 0.85, maxTokens = 2048) {
  const res = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: Math.min(temp, 1.0),
      max_tokens: maxTokens
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Mistral error: ${data.message || data.error?.message || JSON.stringify(data).slice(0, 200)}`);
  if (!data.choices?.[0]) throw new Error(`Unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
  return data.choices[0].message.content.trim();
}

// ─── Utils ────────────────────────────────────────────────────────────────────
const wc = t => t?.trim() ? t.trim().split(/\s+/).length : 0;
const getSentences = t => (t.match(/[^.!?]+[.!?]+/g) || [t]).map(s => s.trim()).filter(Boolean);

function calcBurstiness(text) {
  const lens = getSentences(text).map(s => s.split(/\s+/).length).filter(l => l > 0);
  if (lens.length < 2) return 0;
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lens.length;
  return parseFloat((Math.sqrt(variance) / avg).toFixed(3));
}

const countBanned = text => BANNED.filter(w => text.toLowerCase().includes(w.toLowerCase()));
const countAIOpeners = text => getSentences(text).filter(s => AI_OPENERS.some(p => p.test(s)));
const countFragments = text => getSentences(text).filter(s => s.split(/\s+/).length <= 6).length;

function detectInputType(text) {
  const lower = text.toLowerCase();
  const analysis = (lower.match(/\b(research|study|studies|data|evidence|according|analysis|found|shows|results|percent|million|billion|report|survey)\b/g) || []).length;
  const opinion = (lower.match(/\b(should|must|I |we |our |believe|think|wrong|right|bad|good)\b/g) || []).length;
  return analysis > opinion + 2 ? 'analysis' : 'opinion';
}

function detectProblems(text) {
  const sentences = getSentences(text);
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 17);
  const hasEmDash = text.includes('—');
  const dramatic = DRAMATIC_PHRASES.filter(p => text.toLowerCase().includes(p.toLowerCase()));
  const banned = countBanned(text);
  const aiOpeners = countAIOpeners(text);
  const burst = calcBurstiness(text);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  const structuredParaPatterns = [
    /^(AI is|Finance is|Startups are|The future|This shift|This allows|This enables)/i,
    /^[A-Z][^.!?]+(revolutionizing|reshaping|transforming|enabling|empowering)/i,
    /^(In this|In today's|In the current|In recent)/i,
  ];
  const structuredParas = paragraphs.filter(p => {
    const first = (getSentences(p)[0] || '').trim();
    return structuredParaPatterns.some(pat => pat.test(first));
  }).length;

  // Claude-style hedging patterns
  const claudePatterns = [
    /\bthat said\b/gi,
    /\bon the other hand\b/gi,
    /\bit's worth (noting|considering|acknowledging)\b/gi,
    /\bcompeting (perspectives|considerations|views)\b/gi,
    /\bthe (honest|real) (caveat|truth) is\b/gi,
    /\bmore (nuanced|complex) than\b/gi,
  ];
  const claudeFound = claudePatterns.filter(p => p.test(text)).length;

  const score =
    longSentences.length * 4 + dramatic.length * 5 + banned.length * 3 +
    aiOpeners.length * 3 + (hasEmDash ? 6 : 0) + (burst < 0.35 ? 8 : 0) +
    structuredParas * 4 + (paragraphs.length >= 5 ? 5 : 0) + claudeFound * 4;

  return { longSentences, dramatic, banned, aiOpeners, hasEmDash, burst, structuredParas, paragraphs, claudeFound, score };
}

function buildUserStyleBlock(profile) {
  if (!profile) return '';
  const rules = [];
  const s = (profile.summary || '').toLowerCase();
  if (s.includes('rarely or never use contractions')) rules.push('Avoid contractions');
  else if (s.includes('always use contractions')) rules.push('Use contractions freely');
  if (profile.examples?.length) {
    return `\n━━ USER'S OWN WRITING — copy this voice ━━\n${profile.examples.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n${rules.map(r => `• ${r}`).join('\n')}`;
  }
  return rules.length ? `\n━━ STYLE NOTES ━━\n${rules.map(r => `• ${r}`).join('\n')}` : '';
}

async function enforceWordCount(apiKey, text, targetWC) {
  const current = wc(text);
  const min = Math.floor(targetWC * 0.93);
  const max = Math.ceil(targetWC * 1.07);
  if (current >= min && current <= max) return text;
  if (current > max) {
    return await mistral(apiKey,
      `Trim from ${current} to between ${min} and ${max} words. Cut whole sentences. Keep all main arguments. Output ONLY the result.`,
      text, 0.3, max * 3);
  } else {
    return await mistral(apiKey,
      `Expand from ${current} to between ${min} and ${max} words. Add one short plain casual sentence to an existing point. Keep the same voice. Output ONLY the result.`,
      text, 0.5, max * 3);
  }
}

// Build the full positive + negative example blocks for prompts
function buildExampleBlocks(numPositive = 4, numNegative = 3) {
  const positiveBlock = AIDEN_EXAMPLES.slice(0, numPositive)
    .map((e, i) => `[HUMAN EXAMPLE ${i + 1} — Q: "${e.question}"]\n"${e.answer}"`)
    .join('\n\n');

  const negativeBlock = AI_COUNTER_EXAMPLES.slice(0, numNegative)
    .map((e, i) => `[AI EXAMPLE ${i + 1} — ${e.label}]\n"${e.sample}"`)
    .join('\n\n');

  return { positiveBlock, negativeBlock };
}

// ═══════════════════════════════════════════════════════════════════
//  STEP 2: Initial rewrite
// ═══════════════════════════════════════════════════════════════════
async function initialRewrite(apiKey, inputText, inputType, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);
  const temps = { aggressive: 0.92, standard: 0.82, subtle: 0.70 };
  const { positiveBlock, negativeBlock } = buildExampleBlocks(4, 3);
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const extraGuidance = inputType === 'analysis'
    ? `EXTRA FOR ANALYSIS TEXT:
Reframe explanations as personal reactions. Sound like someone telling you something they find interesting.
"AI reduces barriers" → "Anyone can do this now. The barriers are gone."
"Studies show 40% gains" → "The productivity numbers are real. We're talking 40% gains."`
    : `EXTRA FOR OPINION TEXT:
Take a clear side. State it at the start. Repeat it at the end.
Use "I" and "we" naturally. Say what you actually think, directly.`;

  const system = `You are rewriting text to pass GPTZero AI detection. Your output must look like it was typed by a real student — specifically this student named Aiden.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AIDEN'S REAL WRITING — WRITE EXACTLY LIKE THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${positiveBlock}

WHY AIDEN'S WRITING PASSES GPTZERO:
• Short direct sentences — gets to the point immediately
• Takes a strong position and repeats it — no hedging, no "on the other hand"
• Personal references: "When I start my startup...", "I think..."
• Slightly loose reasoning — not every sentence perfectly connects to the next (this is KEY)
• Casual imperfect phrases: "lots of funding", "anyone and everyone", "way behind"
• Real specific examples from his own life or knowledge
• Writes the way people actually talk, not the way people write essays

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT MAKES AIDEN'S WRITING HUMAN (from dataset analysis)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- LIVELY AND PERSONAL — not academic, not analytical, not measured
- DIFFERENT AND QUIRKY — unexpected phrasing, real references like "clawdbot", "macbook minis"
- ON THE FLY — not carefully structured, doesn't feel pre-planned
- CERTAIN AND CONFIDENT — doesn't second-guess himself, doesn't present counterarguments he doesn't believe
- USES "I" NATURALLY — "When I start my startup", "I think", "I get that feeling"
- REPEATS HIMSELF slightly — restates the main point in different words (this is human)
- SLIGHTLY LOOSE REASONING — sentences don't all connect perfectly, some jump around
- SPECIFIC PERSONAL DETAILS — 8th grade graduation, his own startup plans, clawdbots as COO/CFO
- SHORT PUNCHY SENTENCES mixed with occasional longer ones

WHAT MAKES AI WRITING DETECTABLE:
- ChatGPT: numbered lists, balanced both-sides, "First... Second... Third...", never commits
- Claude: very long, maps competing perspectives, qualifiers everywhere ("however", "but", "that said"), intellectually careful but never decisive
- Both: too organized, too comprehensive, no personality, no "I", no specific personal details
- Both: perfect logical flow where every sentence connects to the next

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI WRITING — NEVER WRITE LIKE THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${negativeBlock}

WHY AI WRITING FAILS GPTZERO:
• Numbered lists: "First... Second... Third..." = instant AI detection
• Balanced both sides: "On one hand... on the other hand..." = AI trying to be fair
• Never takes a clear position — always hedges with "likely", "probably", "most economists"
• Perfect logical flow — every sentence connects to the next too cleanly
• Colon setups: "Here's what's driving the shift:" = AI
• Too comprehensive — covers every angle, leaves nothing out

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NO SENTENCE OVER 18 WORDS.
2. NO EM DASHES (—). Use a period instead.
3. NO COLON SETUPS. No "here's the thing:", "here's the twist:", "the real point:"
4. NO RHETORICAL QUESTIONS. No "Why? Because...", "The answer? Simple."
5. NO ONE-WORD DRAMATIC SENTENCES. No "Unstoppable." "Period." "Remarkable."
6. NO NUMBERED OR BULLETED LISTS. Never "First... Second... Third..."
7. NO HEDGING. Don't say "likely", "probably", "most experts think". Take a position.
8. NO BALANCED BOTH-SIDES. Don't present the counterargument unless Aiden would.
9. NO STRUCTURED ESSAY PARAGRAPHS. Write as one flowing stream of thought.
10. PLAIN CASUAL WORDS: "lots of" not "numerous", "way faster" not "significantly faster"
11. WORD COUNT: ${minWords}–${maxWords} words.

${extraGuidance}
${userStyleBlock}

OUTPUT: Return ONLY the rewritten text.`;

  const raw = await mistral(apiKey, system,
    `Rewrite this text in Aiden's voice:\n\n${inputText}`,
    temps[strength || 'aggressive'], 3000);

  return await enforceWordCount(apiKey, hardScrub(raw), wordTarget);
}

// ═══════════════════════════════════════════════════════════════════
//  ROUND 1: Fix detectable problems
// ═══════════════════════════════════════════════════════════════════

const bannedReplacements = {
  'furthermore': 'also', 'moreover': 'also', 'additionally': 'and also',
  'utilize': 'use', 'utilizing': 'using', 'leverage': 'use',
  'crucial': 'important', 'paramount': 'important', 'pivotal': 'key',
  'robust': 'strong', 'comprehensive': 'full', 'nuanced': 'detailed',
  'seamlessly': 'smoothly', 'groundbreaking': 'new', 'landscape': 'space',
  'navigate': 'deal with', 'holistic': 'full', 'streamline': 'simplify',
  'foster': 'help', 'facilitate': 'help', 'notably': 'importantly',
  'thus': 'so', 'hence': 'so', 'subsequently': 'then',
  'trajectory': 'path', 'paradigm': 'model', 'ecosystem': 'space'
};

async function round1_fixProblems(apiKey, text, originalWordCount) {
  const problems = detectProblems(text);
  if (problems.score <= 2) return { text, skipped: true };

  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  const fixList = [];

  if (problems.hasEmDash) fixList.push(`EM DASHES: Replace every — with a period. Start a new sentence.`);

  if (problems.longSentences.length > 0) {
    fixList.push(`LONG SENTENCES — split each into 2 shorter sentences (each under 14 words):\n${problems.longSentences.slice(0, 5).map(s => `  • "${s}"`).join('\n')}`);
  }

  if (problems.dramatic.length > 0) {
    const rep = {
      'transformative ways':'big ways','reshaping industries':'changing industries',
      'revolutionizing':'changing','revolutionize':'change',
      'remarkable accuracy':'really good accuracy','fast-paced markets':'fast markets',
      'innovative tools':'new tools','innovative approach':'new approach',
      'democratizes':'opens up for everyone','democratize':'open up for everyone',
      'drives innovation':'helps people build new things',
      'the future belongs to':'whoever does this will win',
      'unlocks potential':'helps people do more','silver bullet':'magic fix',
      'leave them in the dust':'beat them','unprecedented scale':'a huge scale',
      'levels the playing field':'lets anyone compete',
      'game changer':'a big deal','game-changer':'a big deal',
      'redefining':'changing','cutting-edge':'new','state-of-the-art':'the best',
      'superpowers':'a big advantage','outrun the big':'beat the big',
    };
    fixList.push(`DRAMATIC PHRASES — replace each:\n${problems.dramatic.slice(0, 6).map(p => `  • "${p}" → "${rep[p.toLowerCase()] || 'a plain casual phrase'}"`).join('\n')}`);
  }

  if (problems.banned.length > 0) {
    fixList.push(`BANNED WORDS — replace each with a plain casual word:\n${problems.banned.slice(0, 6).map(w => `  • "${w}" → "${bannedReplacements[w.toLowerCase()] || 'a plain casual word'}"`).join('\n')}`);
  }

  if (problems.aiOpeners.length > 0) {
    fixList.push(`AI OPENERS — rewrite these:\n${problems.aiOpeners.slice(0, 4).map(s => `  • "${s.trim().slice(0, 80)}"`).join('\n')}`);
  }

  if (problems.claudeFound > 0) {
    fixList.push(`CLAUDE HEDGING PATTERNS — remove these:\n• "that said" → just continue the point\n• "on the other hand" → delete it, just state Aiden's view\n• "it's worth noting" → delete it, just say the thing\n• "competing perspectives" → pick one perspective and state it directly`);
  }

  if (fixList.length === 0) return { text, skipped: true };

  const raw = await mistral(apiKey,
    `Fix ONLY the specific problems listed. Do not rewrite everything else.
WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)}).
━━ FIX THESE ━━\n${fixList.join('\n\n')}\nOutput ONLY the corrected text.`,
    text, 0.55, 3000);

  return { text: await enforceWordCount(apiKey, hardScrub(raw), originalWordCount), skipped: false };
}

// ═══════════════════════════════════════════════════════════════════
//  ROUND 2: Break up essay structure — ALWAYS RUNS
// ═══════════════════════════════════════════════════════════════════
async function round2_breakStructure(apiKey, text, originalWordCount) {
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  const { positiveBlock } = buildExampleBlocks(2, 0);

  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paraOpenings = paragraphs.map((p, i) => {
    const first = (getSentences(p)[0] || '').trim();
    return `  Para ${i + 1}: "${first.slice(0, 90)}"`;
  }).join('\n');

  const raw = await mistral(apiKey,
    `This text is still being detected as AI. The problem is it reads like an organized essay.

REFERENCE — Aiden's real writing that passes GPTZero:
${positiveBlock}

Notice: Aiden's writing flows as one stream of thought. He doesn't write in organized sections. His reasoning is sometimes a little loose — not every sentence perfectly connects.

RULES FOR THIS PASS:
• Do NOT use em dashes (—)
• Do NOT use colon setups
• Do NOT write rhetorical questions
• Do NOT use numbered lists

YOUR JOB:
1. Merge 2–3 paragraphs together so it flows as one stream of thought
2. Rewrite formal topic sentence openers to be more casual
3. Add connecting words: "also", "and", "but", "so", "now", "plus", "and also"
4. Let some sentences be slightly loose — not perfectly connecting to the next one
5. Word count must stay ${minWords}–${maxWords} words (currently ${wc(text)})

AIDEN'S WRITING COMPARED TO AI (from dataset):
- Aiden uses "I" — AI uses impersonal third person
- Aiden repeats his main point — AI covers every angle once and moves on
- Aiden's reasoning is sometimes loose — AI reasoning is always tight and connected
- Aiden is lively and personal — AI is strict and organized
- If this text still sounds like a briefing or essay, it is still AI. Make it sound like someone talking.

Current paragraph openers:
${paraOpenings}

Output ONLY the result.`,
    text, 0.65, 3000);

  return await enforceWordCount(apiKey, hardScrub(raw), originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  ROUND 3: Add burstiness and casual language — ALWAYS RUNS
// ═══════════════════════════════════════════════════════════════════
async function round3_addBurstiness(apiKey, text, originalWordCount) {
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  const burst = calcBurstiness(text);
  const aiExamplesBlock = AI_COUNTER_EXAMPLES.slice(0, 2)
    .map(e => `[AVOID — ${e.label}]\n"${e.sample}"`)
    .join('\n\n');

  const raw = await mistral(apiKey,
    `Final polish. This text needs to sound more like a real person talking and less like AI.

WHAT AI SOUNDS LIKE — DO NOT WRITE LIKE THIS:
${aiExamplesBlock}

YOUR JOB:
1. Add 2–3 SHORT plain sentences (4–7 words) to break up the rhythm.
   Good: "That changes everything." / "No one could do this before." / "Anyone can do this now." / "That is the whole point." / "It just makes sense." / "That is a big deal."
   Bad (still AI): "Unstoppable." / "Period." / "Game over." — too dramatic
2. Find 2–3 sentences that sound too smooth or polished — make them slightly more casual
3. Replace formal words: "however" → "but", "obtain" → "get", "currently" → "now", "significant" → "big", "individuals" → "people"
4. Word count must stay ${minWords}–${maxWords} words (currently ${wc(text)})
   Current burstiness: ${burst} (target: above 0.45)
5. If any sentence sounds like it's "mapping perspectives" or "acknowledging tradeoffs" — rewrite it to just state a direct opinion instead
6. If the text feels comprehensive (covers every angle) — cut something. Aiden leaves things out. That's human.

Output ONLY the result.`,
    text, 0.70, 3000);

  return await enforceWordCount(apiKey, hardScrub(raw), originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN HUMANIZE EXPORT
// ═══════════════════════════════════════════════════════════════════
export async function humanize(apiKey, inputText, strength, styleProfile, onProgress) {
  const log = (step, msg) => {
    console.log(`  [${step}] ${msg}`);
    if (onProgress) onProgress({ step, msg });
  };

  if (!apiKey) throw new Error('No API key provided');
  if (!inputText?.trim()) throw new Error('No input text provided');

  const originalWordCount = wc(inputText);
  console.log(`\n=== HUMANIZE START === ${originalWordCount} words ===`);

  // Step 1: Analyze input
  log('1/6', 'Analyzing input...');
  let analysis = { topic: 'general', type: detectInputType(inputText) };
  try {
    const raw = await mistral(apiKey,
      `Analyze this text. Return JSON only: {"topic":"2-4 word topic","type":"opinion or analysis"}`,
      inputText.slice(0, 400), 0.1, 80);
    analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());
    log('1/6', `Topic: "${analysis.topic}" | Type: ${analysis.type}`);
  } catch {
    log('1/6', `Analysis defaulting to: ${analysis.type}`);
  }

  // Step 2: Initial rewrite
  log('2/6', `Rewriting in Aiden's voice (${analysis.type} mode)...`);
  let result;
  try {
    result = await initialRewrite(apiKey, inputText, analysis.type, strength || 'aggressive', styleProfile);
    const p = detectProblems(result);
    log('2/6', `Rewrite done: ${wc(result)} words | score=${p.score} | burst=${p.burst}`);
  } catch (e) {
    throw new Error(`Rewrite failed: ${e.message}`);
  }

  // Step 3: Round 1 — fix detectable problems (score-gated)
  {
    const p = detectProblems(result);
    if (p.score <= 2) {
      log('3/6', `Round 1: Score clean (${p.score}) — skipping`);
    } else {
      const summary = [
        p.longSentences.length > 0 ? `long=${p.longSentences.length}` : null,
        p.dramatic.length > 0 ? `dramatic=${p.dramatic.length}` : null,
        p.banned.length > 0 ? `banned=${p.banned.length}` : null,
        p.hasEmDash ? 'em-dash' : null,
        p.claudeFound > 0 ? `claude=${p.claudeFound}` : null,
      ].filter(Boolean).join(' | ');
      log('3/6', `Round 1: Fix problems (score=${p.score} | ${summary || 'misc'})...`);
      try {
        const fix = await round1_fixProblems(apiKey, result, originalWordCount);
        result = fix.text;
        log('3/6', `After round 1: ${wc(result)} words | score=${detectProblems(result).score} | burst=${calcBurstiness(result)}`);
      } catch (e) {
        log('3/6', `Round 1 failed (${e.message}) — continuing`);
      }
    }
  }

  // Step 4: Round 2 — break essay structure (ALWAYS RUNS)
  log('4/6', 'Round 2: Breaking up essay structure and improving flow...');
  try {
    result = await round2_breakStructure(apiKey, result, originalWordCount);
    log('4/6', `After round 2: ${wc(result)} words | burst=${calcBurstiness(result)}`);
  } catch (e) {
    log('4/6', `Round 2 failed (${e.message}) — continuing`);
  }

  // Step 5: Round 3 — burstiness and casual language (ALWAYS RUNS)
  log('5/6', 'Round 3: Adding burstiness and casual language...');
  try {
    result = await round3_addBurstiness(apiKey, result, originalWordCount);
    log('5/6', `After round 3: ${wc(result)} words | burst=${calcBurstiness(result)}`);
  } catch (e) {
    log('5/6', `Round 3 failed (${e.message}) — continuing`);
  }

  // Final hard scrub
  result = hardScrub(result);

  // Step 6: Word count fix
  const currentWC = wc(result);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  if (currentWC < min || currentWC > max) {
    log('6/6', `Word count fix (${currentWC} → target ${originalWordCount})...`);
    try {
      result = await enforceWordCount(apiKey, result, originalWordCount);
      log('6/6', `Final: ${wc(result)} words`);
    } catch (e) {
      log('6/6', 'Word count fix failed — keeping as is');
    }
  } else {
    log('6/6', `Word count OK: ${currentWC} words`);
  }

  console.log(`=== HUMANIZE DONE === ${wc(result)} words ===\n`);

  return {
    text: result,
    scores: {
      burstiness: calcBurstiness(result),
      bannedWordsFound: countBanned(result),
      aiOpenersFound: countAIOpeners(result).length,
      fragments: countFragments(result),
      examplesUsed: AIDEN_EXAMPLES.length,
      originalWordCount,
      outputWordCount: wc(result),
      wordCountDelta: Math.round((wc(result) - originalWordCount) / originalWordCount * 100) + '%',
      humanExampleSources: ['Aiden dataset']
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
//  ANSWER AS HUMAN EXPORT
// ═══════════════════════════════════════════════════════════════════
function findClosestAidenExample(question) {
  const q = question.toLowerCase();
  const qWords = q.split(/\s+/).filter(w => w.length > 3);
  const scored = AIDEN_EXAMPLES.map((ex, i) => {
    const exWords = ex.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return {
      i,
      score: qWords.filter(w => exWords.includes(w)).length * 2 +
        qWords.filter(w => exWords.some(ew => ew.includes(w) || w.includes(ew))).length
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return AIDEN_EXAMPLES[scored[0].i];
}

export async function answerAsAiden(apiKey, question, styleProfile, onProgress) {
  const log = (step, msg) => {
    console.log(`  [${step}] ${msg}`);
    if (onProgress) onProgress({ step, msg });
  };

  if (!apiKey) throw new Error('No API key provided');
  if (!question?.trim()) throw new Error('No question provided');

  // Step 1/3: Write initial draft
  log('1/3', 'Finding closest human example...');
  const closest = findClosestAidenExample(question);
  log('1/3', `Using "${closest.question}" as template — writing draft...`);

  const humanSentences = getSentences(closest.answer);
  const allAidenText = AIDEN_EXAMPLES.map((e, i) => `[HUMAN ${i + 1} — Q: "${e.question}"]\n"${e.answer}"`).join('\n\n');
  const aiExamplesBlock = AI_COUNTER_EXAMPLES.slice(0, 3).map(e => `[AVOID — ${e.label}]\n"${e.sample}"`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';
  const sentenceBreakdown = humanSentences.map((s, i) => `  S${i + 1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n');

  const draftRaw = await mistral(apiKey,
    `Answer a question in Aiden's exact voice. Study all his real answers carefully.

AIDEN'S REAL ANSWERS — WRITE EXACTLY LIKE THESE:
${allAidenText}

AI WRITING TO AVOID — DO NOT WRITE LIKE THIS:
${aiExamplesBlock}

STRUCTURAL TEMPLATE — match this sentence-by-sentence pattern:
${sentenceBreakdown}

KEY TRAITS OF AIDEN'S VOICE:
• LIVELY AND PERSONAL — sounds like someone actually talking, not writing an essay
• DIFFERENT AND QUIRKY — unexpected word choices, personal references
• CONFIDENT — picks a side immediately and doesn't apologize for it
• REPEATS THE MAIN POINT at start and end (Aiden always does this)
• SPECIFIC DETAILS — if he has a personal example, he uses it
• DOES NOT present the other side unless he's dismissing it
• DOES NOT use "however", "that said", "on the other hand", "it's worth noting"
• SHORT AND DIRECT — Aiden's answers are often 80-150 words. Don't over-explain.
• Personal references: "I think", "When I...", "We"
• Slightly loose reasoning — not every sentence perfectly connects (this is normal and human)
• Casual words: "lots of", "way behind", "anyone and everyone", "a lot of"

RULES:
• Every sentence under 18 words
• No em dashes (—) — use a period instead
• No colon setups: "here's the thing:", "here's the twist:"
• No rhetorical questions
• No one-word dramatic sentences
• No numbered lists
• No hedging — take a position

${userStyleBlock}

OUTPUT: Return ONLY the answer.`,
    `Question: "${question}"\n\nWrite the answer matching the sentence-by-sentence structure of the template.`,
    0.88, 800);

  let result = hardScrub(draftRaw);
  log('1/3', `Draft done: ${wc(result)} words | burst=${calcBurstiness(result)}`);

  // Step 2/3: Fix AI patterns and improve flow
  log('2/3', 'Fixing AI patterns and improving flow...');
  try {
    const targetWC = wc(result);
    const minWords = Math.floor(targetWC * 0.90);
    const maxWords = Math.ceil(targetWC * 1.10);

    const fixedRaw = await mistral(apiKey,
      `This answer may still be detected as AI. Fix it to sound more like Aiden.

AIDEN'S REAL WRITING (copy this voice):
${AIDEN_EXAMPLES.slice(0, 3).map((e, i) => `[${i + 1}] "${e.answer}"`).join('\n\n')}

KEY: Aiden's reasoning is sometimes loose. Not every sentence perfectly connects. That's normal and human.

RULES:
• No em dashes (—)
• No colon setups
• No rhetorical questions
• No one-word sentences
• No numbered lists
• No hedging

YOUR JOB:
1. Bring the draft closer to Aiden's voice
2. If it has clean organized paragraphs, merge them into one flowing stream
3. Add casual connecting words: "also", "and", "but", "so", "now", "plus"
4. Let some sentences be slightly loose
5. Word count must stay ${minWords}–${maxWords} words (currently ${wc(result)})

Output ONLY the corrected answer.`,
      result, 0.60, 1000);

    result = hardScrub(fixedRaw);
    result = await enforceWordCount(apiKey, result, targetWC);
    log('2/3', `After fix: ${wc(result)} words | burst=${calcBurstiness(result)}`);
  } catch (e) {
    log('2/3', `Fix pass failed (${e.message}) — continuing`);
  }

  // Step 3/3: Add burstiness
  log('3/3', 'Adding burstiness and final polish...');
  try {
    const targetWC = wc(result);
    const minWords = Math.floor(targetWC * 0.90);
    const maxWords = Math.ceil(targetWC * 1.10);
    const burst = calcBurstiness(result);

    const burstRaw = await mistral(apiKey,
      `Final polish. Add short punchy sentences to make this sound more like a real person.

RULES:
• No em dashes (—)
• No colon setups
• No rhetorical questions or one-word sentences

YOUR JOB:
1. Add 1–2 SHORT sentences (4–7 words) to break up the rhythm.
   Good: "That is the whole point." / "Anyone can do this now." / "It just makes sense." / "That changes everything." / "That is a big deal."
   Bad: "Unstoppable." / "Period." — too dramatic, still AI
2. Find 1–2 sentences that sound too polished and make them more casual
3. Replace formal words: "however" → "but", "obtain" → "get", "currently" → "now"
4. Word count must stay ${minWords}–${maxWords} words (currently ${wc(result)})
   Current burstiness: ${burst} (target: above 0.4)

Output ONLY the result.`,
      result, 0.70, 800);

    result = hardScrub(burstRaw);
    result = await enforceWordCount(apiKey, result, targetWC);
    log('3/3', `Final: ${wc(result)} words | burst=${calcBurstiness(result)}`);
  } catch (e) {
    log('3/3', `Burst pass failed — keeping previous`);
  }

  result = hardScrub(result);

  return {
    text: result,
    scores: {
      bannedWordsFound: countBanned(result),
      aiOpenersFound: countAIOpeners(result).length,
      burstiness: calcBurstiness(result),
      wordCount: wc(result)
    }
  };
}
