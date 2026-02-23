// pipeline.js — Humanizer v15
// Dataset: Human vs AI writing by Aiden vs ChatGPT vs Claude
// AIDEN_EXAMPLES = all Aiden answers — write LIKE these
// AI_COUNTER_EXAMPLES = ChatGPT + Claude answers — write NOTHING like these
// hardScrub() = regex post-processor catching AI casual patterns

import fetch from 'node-fetch';
import { AIDEN_EXAMPLES, AI_COUNTER_EXAMPLES, BANNED, DRAMATIC_PHRASES, AI_OPENERS, CONTRACTION_MAP, FILLER_PHRASES } from './data.js';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';
const MIN_BURSTINESS = 0.42;

// ═══════════════════════════════════════════════════════════════════
//  HARD SCRUB — regex post-processor, runs on every LLM output
//  Catches AI-trying-to-sound-casual patterns the model generates itself
// ═══════════════════════════════════════════════════════════════════
function hardScrub(text) {
  let t = text;

  // Remove parenthetical asides that read like model-disclaimer glue
  t = t.replace(/\s*\(([^)]{0,140})\)\s*/g, ' ');

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


  // Semicolons often make model text feel overly formal
  t = t.replace(/;/g, '.');

  // Passive voice softening for common detector-trigger patterns
  t = t.replace(/\b(is|are|was|were|been|being)\s+([a-z]+ed)\s+by\b/gi, '$2 by');

  // Subtle hedging removals
  t = t.replace(/\b(it seems|it appears|arguably|possibly|potentially|to some extent|in many ways)\b/gi, '');
  t = t.replace(/\b(might|may)\b/gi, 'can');
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

async function mistralMessages(apiKey, messages, temp = 0.8, maxTokens = 1200) {
  const res = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
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


function shufflePick(items, count) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

function humanizeText(text) {
  let out = hardScrub(text);

  for (const [plain, contraction] of Object.entries(CONTRACTION_MAP)) {
    const re = new RegExp(`\b${plain.replace(/ /g, '\s+')}\b`, 'gi');
    out = out.replace(re, contraction);
  }

  const casualMap = {
    additionally: 'also', furthermore: 'also', moreover: 'also',
    therefore: 'so', thus: 'so', however: 'but', nevertheless: 'but',
    individuals: 'people', obtain: 'get', currently: 'now',
    significant: 'big', numerous: 'lots of'
  };
  for (const [formal, casual] of Object.entries(casualMap)) {
    out = out.replace(new RegExp(`\b${formal}\b`, 'gi'), casual);
  }

  out = out.replace(/\b(on the other hand|that said|it is worth noting)\b/gi, '');
  out = out.replace(/\s{2,}/g, ' ').trim();

  const sentences = getSentences(out);
  if (sentences.length >= 3 && sentences.every(s => s.split(/\s+/).length > 10)) {
    const idx = 1 + Math.floor(Math.random() * Math.max(1, sentences.length - 2));
    sentences.splice(idx, 0, FILLER_PHRASES[Math.floor(Math.random() * FILLER_PHRASES.length)] + '.');
  }

  return sentences.join(' ').replace(/\s{2,}/g, ' ').trim();
}

async function enforceWordCount(apiKey, text, targetWC) {
  const current = wc(text);
  const min = Math.floor(targetWC * 0.80);
  const max = Math.ceil(targetWC * 1.20);
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

async function enforceBurstiness(apiKey, text, targetWC) {
  const currentBurst = calcBurstiness(text);
  if (currentBurst >= MIN_BURSTINESS) return text;

  const minWords = Math.floor(targetWC * 0.80);
  const maxWords = Math.ceil(targetWC * 1.20);

  const revised = await mistral(apiKey,
    `Increase sentence-length variation so the output feels more naturally human.
Current burstiness is ${currentBurst}. Target at least ${MIN_BURSTINESS}.
Mix short, medium, and occasional longer lines while keeping the original meaning and voice.
Keep it natural and personal. Do NOT use random fragments, weird punctuation, or awkward phrasing.
Keep total length between ${minWords} and ${maxWords} words.
Return ONLY the revised text.`,
    text,
    0.74,
    Math.max(1200, maxWords * 5)
  );

  return revised;
}

// Build the full positive + negative example blocks for prompts
function buildExampleBlocks(numPositive = 4, numNegative = 3) {
  const positiveBlock = shufflePick(AIDEN_EXAMPLES, numPositive)
    .map((e, i) => `[HUMAN EXAMPLE ${i + 1} — Q: "${e.question}"]\n"${e.answer}"`)
    .join('\n\n');

  const negativeBlock = shufflePick(AI_COUNTER_EXAMPLES, numNegative)
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
  const inputType = detectInputType(inputText);
  const temps = { aggressive: 0.88, standard: 0.78, subtle: 0.68 };

  log('1/3', `Rewriting (${inputType}) with low-structure prompt...`);
  const { positiveBlock, negativeBlock } = buildExampleBlocks(4, 3);
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const rewritePrompt = `Rewrite this text so it reads like a real person writing naturally.
Keep the original meaning and roughly similar length.
Use conversational flow, varied sentence lengths, and direct language.
Require noticeable burstiness: mix short and medium sentences plus occasional longer ones, but keep every sentence natural.
Make it feel personal and lively without sounding forced.
Remove parenthetical asides unless they are essential factual data.
Avoid list formatting, headers, and over-structured transitions.
Avoid Quillbot-like synonym swaps and "academic polish" phrasing.
Avoid these AI-like patterns:
${negativeBlock}
Use this human style as anchor:
${positiveBlock}
${userStyleBlock}
Return only the rewritten text.`;

  let result = await mistral(apiKey, rewritePrompt, inputText, temps[strength || 'aggressive'], 2600);

  log('2/3', 'Applying deterministic human post-processing...');
  result = humanizeText(result);

  const min = Math.floor(originalWordCount * 0.80);
  const max = Math.ceil(originalWordCount * 1.20);
  if (wc(result) < min || wc(result) > max) {
    log('3/3', `One final length correction (${wc(result)} words)...`);
    result = await enforceWordCount(apiKey, result, originalWordCount);
    result = humanizeText(result);
  } else {
    log('3/3', `Length within tolerance (${wc(result)} words).`);
  }

  if (calcBurstiness(result) < MIN_BURSTINESS) {
    log('3/3', `Boosting burstiness (${calcBurstiness(result)} → target ${MIN_BURSTINESS})...`);
    result = await enforceBurstiness(apiKey, result, originalWordCount);
    result = humanizeText(result);
    result = await enforceWordCount(apiKey, result, originalWordCount);
    result = humanizeText(result);
  }

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

export async function answerAsAiden(apiKey, question, styleProfile, onProgress, chatHistory = []) {
  const log = (step, msg) => {
    console.log(`  [${step}] ${msg}`);
    if (onProgress) onProgress({ step, msg });
  };

  if (!apiKey) throw new Error('No API key provided');
  if (!question?.trim()) throw new Error('No question provided');

  log('1/2', 'Building conversational context...');
  const { positiveBlock, negativeBlock } = buildExampleBlocks(3, 2);
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const historyMessages = Array.isArray(chatHistory)
    ? chatHistory
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content.trim() }))
    : [];

  const messages = [
    {
      role: 'system',
      content: `You are a normal helpful assistant. Sound human and conversational, not robotic.
Answer directly, then explain briefly, in a way that still sounds strong after light humanization.
Use bursty rhythm: blend short and medium lines with occasional longer ones, but keep it smooth and natural.
Make the tone personal and lively, like a real person talking.
Do not use list formatting unless the user asks.
Do not hedge excessively or write like an essay.
Avoid parenthetical asides and "over-polished" Quillbot phrasing.
Avoid these AI patterns:
${negativeBlock}
Human voice anchors:
${positiveBlock}
${userStyleBlock}`
    },
    ...historyMessages,
    { role: 'user', content: question }
  ];

  log('2/2', 'Generating answer (single model pass)...');
  const isLongForm = wc(question) > 120;
  let result = await mistralMessages(apiKey, messages, isLongForm ? 0.76 : 0.82, isLongForm ? 1600 : 1000);
  result = hardScrub(result).replace(/\s{2,}/g, ' ').trim();

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
