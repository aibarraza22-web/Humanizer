// ═══════════════════════════════════════════════════════════════════
//  pipeline.js — multi-pass humanization using Groq LLaMA
//  Pass 1: extract topic + keywords
//  Pass 2: rewrite using REAL Reddit examples
//  Pass 3: scrub AI patterns surgically
//  Pass 4: verify — check if it still sounds AI, fix problems
//  Pass 5: final burstiness + fragment check
//  Pass 6: word count enforcement (trim/expand if needed)
// ═══════════════════════════════════════════════════════════════════

import fetch from 'node-fetch';
import { gatherHumanExamples } from './scraper.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// Token budget for free tier (12k TPM):
// ~3k for system prompt scaffolding + rules
// ~2k for input text (158 words ~ 210 tokens, but we allow up to ~1500 words)
// ~2k for Reddit examples (5 examples x 400 chars ~ 270 tokens each = ~1350 tokens)
// ~3k headroom for output
// = safely under 12k per request
const EXAMPLE_COUNT = 5;       // number of Reddit examples to include
const EXAMPLE_MAX_CHARS = 400; // max chars per example (roughly 85 tokens each)

const BANNED = [
  'delve','delves','delving','crucial','multifaceted','comprehensive',
  'leverage','leveraging','utilize','utilizing','furthermore','moreover',
  'in conclusion','ultimately','embark','underscores','underscore','paramount',
  'pivotal','nuanced','robust','seamlessly','groundbreaking','landscape',
  'realm','navigate','tapestry','holistic','synergy','streamline','foster',
  'facilitate','notably','thus','hence','whereby','aforementioned','subsequently',
  'in summary','to summarize','in essence','it goes without saying',
  'needless to say','as previously mentioned','it should be noted','as such',
  'in light of this','with this in mind','it becomes evident','it is evident',
  'it is clear','one can see','it can be argued','this demonstrates',
  'this highlights','this suggests','building on this','this underscores',
  'it is important to','it is worth noting','it is crucial','it is essential',
  'plays a pivotal role','plays a crucial role','a wide range of','a variety of'
];

const AI_OPENERS = [
  /^(Additionally|Furthermore|Moreover|In addition),?\s/i,
  /^(However|Nevertheless|Nonetheless),?\s/i,
  /^(In conclusion|To summarize|In summary|Overall|Ultimately),?\s/i,
  /^It is (important|crucial|essential|worth noting) (to|that)\s/i,
  /^This (shows|demonstrates|highlights|suggests|indicates|underscores)\s/i,
  /^(As such|As a result|As previously mentioned),?\s/i,
  /^(In light of this|With this in mind),?\s/i,
  /^(When considering|When examining|By examining),?\s/i,
  /^(It is (clear|evident|apparent) that)\s/i,
  /^(Building on|Building upon)\s/i,
];

// ─── Groq call ───────────────────────────────────────────────────────────────
async function groq(apiKey, system, user, temp = 0.85, maxTokens = 2048) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: temp,
      max_tokens: maxTokens
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Groq API error');
  return data.choices[0].message.content.trim();
}

// ─── Utils ───────────────────────────────────────────────────────────────────
function wc(text) { return text.trim().split(/\s+/).length; }

function calcBurstiness(text) {
  const sents = text.match(/[^.!?]+[.!?]+/g) || [text];
  const lens = sents.map(s => s.trim().split(/\s+/).length).filter(l => l > 0);
  if (lens.length < 2) return 0;
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lens.length;
  return parseFloat((Math.sqrt(variance) / avg).toFixed(3));
}

function countBannedWords(text) {
  return BANNED.filter(w => text.toLowerCase().includes(w.toLowerCase()));
}

function countAIOpeners(text) {
  const sents = text.match(/[^.!?]+[.!?]+/g) || [];
  return sents.filter(s => AI_OPENERS.some(p => p.test(s.trim())));
}

function countFragments(text) {
  const sents = text.match(/[^.!?]+[.!?]+/g) || [];
  return sents.filter(s => s.trim().split(/\s+/).length <= 6).length;
}

function scoreText(text) {
  const burst = calcBurstiness(text);
  const banned = countBannedWords(text);
  const aiOpeners = countAIOpeners(text);
  const frags = countFragments(text);
  return { burst, banned, aiOpeners, frags };
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

// Select the best N examples by human quality score, then shuffle for variety
function pickExamples(humanExamples, n, maxChars) {
  return shuffle(humanExamples)
    .slice(0, n)
    .map(e => ({ ...e, text: e.text.slice(0, maxChars) }));
}

// ─── PASS 1: Extract topic and keywords ──────────────────────────────────────
async function extractTopic(apiKey, text) {
  const system = `You extract the core topic and search keywords from academic or essay text.
Return JSON only, exactly:
{"topic":"short topic name","keywords":"3-5 word search phrase for Reddit","genre":"essay|argument|analysis|personal|technical"}
No other text.`;
  const raw = await groq(apiKey, system, text.slice(0, 500), 0.1, 200);
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { topic: 'general academic topic', keywords: 'college essay writing', genre: 'essay' };
  }
}

// ─── PASS 2: Rewrite using REAL Reddit examples ───────────────────────────────
async function rewriteWithExamples(apiKey, inputText, humanExamples, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);

  const personas = {
    aggressive: `You are a real college student rewriting this essay entirely from your own memory and voice. You're smart but you write like a person — direct, occasionally uneven, sometimes a sentence that runs a bit long, sometimes one that's almost too short. You are not performing for anyone. You've rebuilt every single sentence from scratch in your own words.`,
    standard: `You are a real person rewriting this in your own natural words. You sound like someone who actually thinks about things, not like a writing template. Clear but not formal. Occasionally imperfect.`,
    subtle: `You are lightly editing this to sound more natural and less machine-like. Adjust rhythm, break up smooth sentences, add small imperfections. Keep the structure mostly intact.`
  };

  // Higher temperatures = more unpredictable token choices = lower perplexity scores on GPTZero
  const temps = { aggressive: 1.1, standard: 0.98, subtle: 0.80 };

  // Pick best examples within token budget
  const examples = pickExamples(humanExamples, EXAMPLE_COUNT, EXAMPLE_MAX_CHARS);

  const examplesBlock = examples.length > 0
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REAL HUMAN WRITING — SCRAPED FROM REDDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These are real Reddit posts on this exact topic. Not AI. Study every detail:
- How they open sentences (never "Furthermore" or "It is important to")
- Their vocabulary (ordinary, direct, not academic jargon)
- Sentence length (wildly varied — very short to very long)
- Imperfections (fragments, asides, hedges, self-corrections)
- How they express opinions ("I think", "honestly", "the thing is")

${examples.map((e, i) =>
  `[EXAMPLE ${i + 1} — ${e.source}]\n"${e.text}"`
).join('\n\n')}

YOUR REWRITE MUST SOUND LIKE THESE REAL PEOPLE — not like an essay assistant.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : `(No Reddit examples — write from pure human voice intuition)`;

  const styleBlock = styleProfile ? buildStyleBlock(styleProfile) : '';

  const system = `${personas[strength]}

${examplesBlock}
${styleBlock}

━━ RULES ━━

MEANING: Preserve 100% of the original meaning. Every idea stays. Nothing added, nothing removed.

WORD COUNT — HARD LIMIT:
Original is ${wordTarget} words. Output MUST be between ${minWords} and ${maxWords} words.
Replace ideas with ideas. One sentence in, one sentence out. Do not pad or expand.

PERPLEXITY — HOW GPTZero DETECTS AI:
GPTZero flags text where every word is the statistically safest choice.
For every 3 sentences, swap one predictable word for a slightly unexpected but natural one.
e.g. "shows" → "makes clear" | "important" → "the thing that matters" | "however" → "but here's the thing"

SENTENCE VARIATION — MANDATORY:
Every 4 sentences must include: 1 under 8 words, 1 over 25 words, rest varied.

FRAGMENTS: Replace 3 existing sentences with short standalone fragments:
"Which is the whole problem." / "Not always." / "Worth thinking about."

DASHES: Use 2 mid-thought dashes — like this — in existing sentences.

HEDGES: Use 2 first-person hedges: "I think", "probably", "at least in my reading".

BANNED WORDS — NEVER USE:
${BANNED.join(', ')}

BANNED OPENERS: "Additionally," / "Furthermore," / "It is important to..." / "This demonstrates..." / "In conclusion,"

OUTPUT: Return ONLY the rewritten text. Nothing before or after.`;

  return await groq(apiKey, system, `Rewrite this text now:\n\n${inputText}`, temps[strength]);
}

// ─── PASS 3: Surgical scrub ────────────────────────────────────────────────────
async function surgicalScrub(apiKey, text, humanExamples, originalWordCount) {
  const { burst, banned, aiOpeners, frags } = scoreText(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const problems = [];
  if (burst < 0.48) problems.push(`BURSTINESS TOO LOW (${burst}) — break 2-3 sentences into short ones (under 8 words), expand 1-2 into long ones (25+ words). Restructure existing sentences, do NOT add content.`);
  if (banned.length > 0) problems.push(`BANNED WORDS — replace each: ${banned.join(', ')}`);
  if (aiOpeners.length > 0) problems.push(`AI OPENERS — rewrite these:\n${aiOpeners.slice(0, 4).map(s => `  • "${s.trim()}"`).join('\n')}`);
  if (frags < 2) problems.push(`NOT ENOUGH FRAGMENTS (${frags}, need 3) — convert 2 sentences into short fragments. Replace, don't add.`);

  // Use 3 short examples as a style reminder — enough to anchor the voice
  const examples = pickExamples(humanExamples, 3, 200);
  const examplesReminder = examples.length > 0
    ? `\nTarget voice — real Reddit writing on this topic:\n${examples.map(e => `"${e.text}"`).join('\n')}`
    : '';

  const system = `You are an AI detection specialist making surgical fixes. Fix ONLY the problems listed.

WORD COUNT: Stay between ${minWords} and ${maxWords} words. Every fix is a swap, not an addition.

PERPLEXITY RULE: For every 3 sentences, swap one predictable word for a slightly unexpected but natural one. This directly lowers GPTZero scores.

PROBLEMS TO FIX:
${problems.length > 0 ? problems.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'No critical problems — apply improvements below:'}

ALWAYS DO THESE (swap, do not add):
1. Replace the 3 most predictable word choices with less obvious but natural alternatives
2. Rewrite the 2 most AI-sounding sentences from scratch at the same length
3. Replace 2 words no real person would actually say
4. Work 1 parenthetical aside (like this) into an existing sentence
5. Cut or rewrite any sentence that just announces what the paragraph will say
6. Edit 1 sentence so a claim is immediately qualified slightly
7. Replace remaining transition phrases with how a person would actually connect ideas
8. Make 1 sentence start mid-thought: dash, "I mean", or "or rather"${examplesReminder}

Output ONLY the fixed text.`;

  return await groq(apiKey, system, `Fix this text:\n\n${text}`, 0.72);
}

// ─── PASS 4: Verification pass ───────────────────────────────────────────────
async function verifyAndFix(apiKey, text, originalText, humanExamples) {
  const { burst, banned, aiOpeners } = scoreText(text);
  const originalWordCount = wc(originalText);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  // Use 3 examples at 250 chars each for verification — enough to check voice match
  const examples = pickExamples(humanExamples, 3, 250);
  const exampleSnippets = examples.map(e => `"${e.text}"`).join('\n');

  const system = `You are a ruthless AI detector. Find every remaining trace of AI writing and fix it.

Look for:
1. Sentences where every word is the most statistically expected choice — rewrite with less predictable but natural choices
2. Paragraphs that flow too smoothly — add bumps, asides, self-corrections
3. Remaining formulaic structure: topic sentence → supporting details → conclusion
4. All sentences ending with a full stop — fragments are missing
5. Vocabulary that is "technically correct but suspiciously polished"
6. Writer demonstrating a thesis rather than actually thinking through it
7. Missing personality — reader should feel like a specific real person wrote this

${examples.length > 0 ? `Real human writing on this topic sounds like:\n${exampleSnippets}` : ''}

Current problems:
- Burstiness: ${burst} ${burst < 0.5 ? '(TOO LOW — fix sentence length variation)' : '(ok)'}
- Banned words: ${banned.length > 0 ? banned.join(', ') : 'none'}
- AI openers: ${aiOpeners.length > 0 ? aiOpeners.slice(0, 3).map(s => s.trim()).join(' | ') : 'none'}

WORD COUNT: Original was ${originalWordCount} words. Stay between ${minWords} and ${maxWords}. Swap, do not add.

Output ONLY the corrected text.`;

  return await groq(apiKey, system, `Review and fix this text:\n\n${text}`, 0.78);
}

// ─── PASS 5: Final burstiness enforcement ────────────────────────────────────
async function enforceBurstiness(apiKey, text, originalWordCount) {
  const burst = calcBurstiness(text);
  if (burst >= 0.5) return text;

  const sents = text.match(/[^.!?]+[.!?]+/g) || [];
  const avg = sents.map(s => s.trim().split(/\s+/).length).reduce((a, b) => a + b, 0) / sents.length;
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const system = `Fix sentence length variation. Burstiness is ${burst} — needs to reach 0.5.
Average sentence length: ~${Math.round(avg)} words.

DO THIS:
1. Break the 4 longest sentences each into 2 (one under 10 words, one normal)
2. Vary the 4 most similar-length sentences dramatically
3. Turn 3 full sentences into fragments under 6 words each
4. Combine 2 pairs of short sentences into longer ones (25+ words)

Keep output between ${minWords} and ${maxWords} words. Restructure — do not add content.
Output ONLY the fixed text.`;

  return await groq(apiKey, system, text, 0.65);
}

// ─── PASS 6: Word count enforcement ──────────────────────────────────────────
async function enforceWordCount(apiKey, text, originalWordCount) {
  const currentWC = wc(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  if (currentWC >= minWords && currentWC <= maxWords) return text;

  const delta = currentWC - originalWordCount;

  if (delta > 0) {
    const system = `This text is ${currentWC} words. Trim to between ${minWords} and ${maxWords} words (original: ${originalWordCount}).

Trim by:
1. Removing filler ("in order to" → "to", "the fact that" → cut)
2. Shortening overly long sentences without changing meaning
3. Cutting elaborations not in the original
Do NOT cut any ideas or key points.

Output ONLY the trimmed text.`;
    return await groq(apiKey, system, text, 0.4, maxWords * 2);
  } else {
    const system = `This text is ${currentWC} words. Expand to between ${minWords} and ${maxWords} words (original: ${originalWordCount}).

Expand by:
1. Adding a short concrete detail to 1-2 existing points
2. Expanding a fragment or very short sentence into a fuller thought
Do NOT add new arguments or change existing ideas.

Output ONLY the expanded text.`;
    return await groq(apiKey, system, text, 0.5, maxWords * 2);
  }
}

// ─── Style block builder ──────────────────────────────────────────────────────
function buildStyleBlock(profile) {
  if (!profile) return '';
  const rules = [];
  const s = (profile.summary || '').toLowerCase();

  if (s.includes('never start sentences with conjunctions')) {
    rules.push('NEVER start sentences with "And", "But", "So", "Or", "Yet"');
  } else if (s.includes('often start')) {
    rules.push('Feel free to start sentences with "And", "But", or "So"');
  }
  if (s.includes('rarely or never use contractions')) {
    rules.push('NEVER use contractions — "do not" not "don\'t", "it is" not "it\'s"');
  } else if (s.includes('always use contractions')) {
    rules.push("Use contractions freely — it's, don't, can't, I'm, they're");
  }
  if (s.includes('very casual')) rules.push('Very casual tone — like talking to a friend');
  if (s.includes('formal and precise')) rules.push('Formal and precise tone throughout');
  if (s.includes('short and punchy')) rules.push('Keep most sentences under 14 words');
  if (s.includes('long and detailed')) rules.push('Use longer flowing sentences');

  if (profile.examples?.length) {
    return `\n━━ THIS WRITER'S SPECIFIC VOICE ━━\nMatch their vocabulary, rhythm, and patterns exactly:\n${profile.examples.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\n\n${rules.length ? 'Additional rules:\n' + rules.map(r => `  • ${r}`).join('\n') : ''}`;
  }
  return rules.length ? `\n━━ STYLE RULES ━━\n${rules.map(r => `  • ${r}`).join('\n')}` : '';
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────────
export async function humanize(apiKey, inputText, strength, styleProfile, onProgress) {

  const log = (step, msg) => {
    console.log(`  [${step}] ${msg}`);
    if (onProgress) onProgress({ step, msg });
  };

  const originalWordCount = wc(inputText);
  log('1/6', `Analyzing topic and keywords... (original: ${originalWordCount} words)`);
  const topicData = await extractTopic(apiKey, inputText);
  log('1/6', `Topic: "${topicData.topic}" | Keywords: "${topicData.keywords}"`);

  log('2/6', `Scraping Reddit for real human writing on "${topicData.keywords}"...`);
  let humanExamples = [];
  try {
    const scraped = await gatherHumanExamples(topicData.keywords, inputText);
    humanExamples = scraped.human || [];
    log('2/6', `Found ${humanExamples.length} real human examples`);
  } catch (e) {
    log('2/6', `Scraping failed (${e.message}) — continuing without examples`);
  }

  log('3/6', 'Rewriting using real Reddit examples...');
  let result = await rewriteWithExamples(apiKey, inputText, humanExamples, strength, styleProfile);
  let scores = scoreText(result);
  let currentWC = wc(result);
  log('3/6', `After rewrite: ${currentWC} words (target: ${originalWordCount}) | burstiness=${scores.burst} | banned=${scores.banned.length} | ai-openers=${scores.aiOpeners.length} | frags=${scores.frags}`);

  log('4/6', 'Surgical scrub — fixing specific AI patterns...');
  result = await surgicalScrub(apiKey, result, humanExamples, originalWordCount);
  scores = scoreText(result);
  currentWC = wc(result);
  log('4/6', `After scrub: ${currentWC} words | burstiness=${scores.burst} | banned=${scores.banned.length} | ai-openers=${scores.aiOpeners.length} | frags=${scores.frags}`);

  log('4/6', 'Verification pass — model checks its own output...');
  result = await verifyAndFix(apiKey, result, inputText, humanExamples);
  scores = scoreText(result);
  currentWC = wc(result);
  log('4/6', `After verify: ${currentWC} words | burstiness=${scores.burst} | banned=${scores.banned.length} | ai-openers=${scores.aiOpeners.length}`);

  if (scores.burst < 0.5) {
    log('5/6', `Burstiness still low (${scores.burst}) — enforcing sentence variation...`);
    result = await enforceBurstiness(apiKey, result, originalWordCount);
    scores = scoreText(result);
    currentWC = wc(result);
    log('5/6', `After burstiness fix: ${currentWC} words | burstiness=${scores.burst}`);
  } else {
    log('5/6', `Burstiness OK (${scores.burst}) — skipping`);
  }

  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  currentWC = wc(result);

  if (currentWC < minWords || currentWC > maxWords) {
    log('6/6', `Word count out of range (${currentWC}, need ${minWords}-${maxWords}) — correcting...`);
    result = await enforceWordCount(apiKey, result, originalWordCount);
    currentWC = wc(result);
    log('6/6', `Final word count: ${currentWC} (target was ${originalWordCount})`);
  } else {
    log('6/6', `Word count OK: ${currentWC} (target: ${originalWordCount})`);
  }

  scores = scoreText(result);

  const finalScores = {
    burstiness: scores.burst,
    bannedWordsFound: scores.banned,
    aiOpenersFound: scores.aiOpeners.length,
    fragments: scores.frags,
    examplesUsed: humanExamples.length,
    originalWordCount,
    outputWordCount: wc(result),
    wordCountDelta: Math.round((wc(result) - originalWordCount) / originalWordCount * 100) + '%',
    humanExampleSources: [...new Set(humanExamples.map(e => e.source))].slice(0, 6)
  };

  return { text: result, scores: finalScores };
}
