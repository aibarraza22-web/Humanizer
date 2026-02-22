// ═══════════════════════════════════════════════════════════════════
//  pipeline.js — multi-pass humanization using Mistral AI
//  Uses Mistral's own API (api.mistral.ai) — pass your Mistral key.
//
//  Pass 1: extract topic + keywords
//  Pass 2: rewrite using REAL Reddit examples
//  Pass 3: splice real human sentences directly into the text
//  Pass 4: scrub AI patterns surgically
//  Pass 5: verify — model checks its own output
//  Pass 6: final burstiness enforcement
//  Pass 7: word count enforcement
// ═══════════════════════════════════════════════════════════════════

import fetch from 'node-fetch';
import { gatherHumanExamples } from './scraper.js';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';

// Use large for everything — small was ignoring word count constraints
const MODEL = 'mistral-large-latest';

const EXAMPLE_COUNT_REWRITE  = 12;
const EXAMPLE_COUNT_SPLICE   = 25;
const EXAMPLE_COUNT_SCRUB    = 6;
const EXAMPLE_COUNT_VERIFY   = 5;
const EXAMPLE_MAX_CHARS      = 500;
const EXAMPLE_MAX_CHARS_FAST = 250;

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

// ─── Mistral API call ─────────────────────────────────────────────────────────
async function mistral(apiKey, system, user, temp = 0.85, maxTokens = 2048) {
  const res = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: Math.min(temp, 1.0), // Mistral hard cap at 1.0
      max_tokens: maxTokens
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error?.message || 'Mistral API error');
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

function pickExamples(humanExamples, n, maxChars) {
  return shuffle(humanExamples)
    .slice(0, n)
    .map(e => ({ ...e, text: e.text.slice(0, maxChars) }));
}

// ─── Hard trim: if a pass balloons the word count, cut it back immediately ────
// This prevents one bad pass from snowballing into 1000+ words
async function hardTrim(apiKey, text, targetWC) {
  const current = wc(text);
  const max = Math.ceil(targetWC * 1.15);
  if (current <= max) return text;

  console.log(`  → Hard trim: ${current} words → targeting ~${targetWC}`);
  const system = `You are trimming text to approximately ${targetWC} words (currently ${current} words).

Cut aggressively:
1. Remove any repeated or restated ideas — keep only the first time something is said
2. Remove filler and padding phrases
3. Shorten long sentences by cutting redundant clauses
4. Do NOT remove any unique ideas or arguments

Output ONLY the trimmed text. No explanation.`;
  return await mistral(apiKey, system, text, 0.3, targetWC * 3);
}

// ─── PASS 1: Extract topic and keywords ──────────────────────────────────────
async function extractTopic(apiKey, text) {
  const system = `You extract the core topic and a SHORT search phrase from academic or essay text.
Return JSON only, exactly this format:
{"topic":"short topic name","keywords":"3 to 5 words max for Reddit search","genre":"essay|argument|analysis|personal|technical"}

IMPORTANT: keywords must be 3-5 words total, like "AI fintech startups" or "climate change policy".
Do NOT return multiple phrases or a long list. One short phrase only.
No other text outside the JSON.`;
  const raw = await mistral(apiKey, system, text.slice(0, 600), 0.1, 200);
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    // Safety: truncate keywords if model ignored instructions
    if (parsed.keywords && parsed.keywords.split(/\s+/).length > 6) {
      parsed.keywords = parsed.keywords.split(/\s+/).slice(0, 5).join(' ');
    }
    return parsed;
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

  const temps = { aggressive: 0.95, standard: 0.85, subtle: 0.72 };

  const examples = pickExamples(humanExamples, EXAMPLE_COUNT_REWRITE, EXAMPLE_MAX_CHARS);

  const examplesBlock = examples.length > 0
    ? `━━━ REAL HUMAN WRITING FROM REDDIT ━━━
These are real posts by real people. Not AI. Study how they write:
• They never start with "Furthermore" or "It is important to"
• They use ordinary words, not academic jargon
• Their sentences vary wildly in length — very short to very long
• They hedge: "I think", "honestly", "the thing is", "I mean"
• They use fragments. Like this.

${examples.map((e, i) => `[EXAMPLE ${i + 1} — ${e.source}]\n"${e.text}"`).join('\n\n')}

YOUR REWRITE MUST SOUND LIKE THESE PEOPLE WROTE IT.`
    : `(No Reddit examples — write from pure human voice intuition)`;

  const styleBlock = styleProfile ? buildStyleBlock(styleProfile) : '';

  const system = `${personas[strength]}

${examplesBlock}
${styleBlock}

━━ MANDATORY RULES ━━

WORD COUNT — YOUR #1 RULE:
The input is ${wordTarget} words. Output MUST be ${minWords}–${maxWords} words.
Count as you write. Stop at ${maxWords}. Do not add anything not in the original.
One idea in = one idea out. No padding, no elaboration, no new examples.

MEANING: Keep 100% of the original meaning and all original ideas.

PERPLEXITY (how GPTZero catches AI):
For every 3 sentences, swap one predictable word for a slightly unexpected but natural one.
Bad: "This shows the importance of regulation."
Good: "That's basically the whole case for oversight right there."

SENTENCE VARIATION:
Every 4 sentences: 1 under 8 words, 1 over 25 words, rest varied.

FRAGMENTS: Replace 3 sentences with short standalone fragments.
"Which is the whole point." / "Not always." / "Worth thinking about."

DASHES: Use 2 mid-thought interruptions — like this — in existing sentences.

HEDGES: Use 2 first-person hedges: "I think", "probably", "sort of".

BANNED WORDS — NEVER USE:
${BANNED.join(', ')}

BANNED OPENERS: "Additionally," / "Furthermore," / "It is important to..." / "This demonstrates..." / "In conclusion,"

OUTPUT: Return ONLY the rewritten text. Nothing before or after.`;

  const result = await mistral(apiKey, system, `Rewrite this text now:\n\n${inputText}`, temps[strength], 3000);
  // Guard: if it went way over, hard trim immediately
  return await hardTrim(apiKey, result, wordTarget);
}

// ─── PASS 3: Splice real human sentences directly into the text ───────────────
async function spliceHumanSentences(apiKey, text, humanExamples, originalWordCount) {
  if (humanExamples.length === 0) return text;

  const humanSentences = humanExamples
    .flatMap(e => (e.text.match(/[^.!?]+[.!?]+/g) || []))
    .map(s => s.trim())
    .filter(s => {
      const words = s.split(/\s+/).length;
      return words >= 8 && words <= 35;
    })
    .filter(s => {
      const lower = s.toLowerCase();
      return !lower.includes('subreddit') &&
             !lower.includes('upvote') &&
             !lower.includes('downvote') &&
             !lower.includes(' op ') &&
             !lower.includes('edit:') &&
             !lower.match(/^(lol|lmao|omg|wtf|smh)/i);
    });

  if (humanSentences.length < 5) return text;

  const selected = shuffle(humanSentences).slice(0, EXAMPLE_COUNT_SPLICE);
  const currentWC = wc(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const system = `You are a text editor replacing 4 AI-written sentences with real human-written ones.

Real human sentences to use:
${selected.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

TASK:
1. Find the 4 most AI-sounding sentences in the text (smooth, formulaic, predictable)
2. Replace each with a sentence from the list above that fits the same context
3. Lightly adapt the human sentence if needed (change a noun, adjust tense) — keep 75%+ of the wording
4. Do not change any other sentences
5. Paragraph meaning must stay intact

WORD COUNT: Current is ${currentWC} words. Keep output between ${minWords} and ${maxWords} words.
If a replacement sentence is longer than what it replaces, shorten another sentence nearby to compensate.

Output ONLY the edited text.`;

  const result = await mistral(apiKey, system, `Edit this text:\n\n${text}`, 0.45, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 4: Surgical scrub ────────────────────────────────────────────────────
async function surgicalScrub(apiKey, text, humanExamples, originalWordCount) {
  const { burst, banned, aiOpeners, frags } = scoreText(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const problems = [];
  if (burst < 0.48) problems.push(`BURSTINESS TOO LOW (${burst}) — break 2 sentences into short ones (under 8 words), expand 1 into a long one (25+ words). Restructure only — do NOT add content.`);
  if (banned.length > 0) problems.push(`BANNED WORDS — replace each: ${banned.join(', ')}`);
  if (aiOpeners.length > 0) problems.push(`AI OPENERS — rewrite these:\n${aiOpeners.slice(0, 4).map(s => `  • "${s.trim()}"`).join('\n')}`);
  if (frags < 2) problems.push(`NOT ENOUGH FRAGMENTS (${frags}, need 3) — convert 2 sentences into short fragments. Replace, don't add.`);

  const examples = pickExamples(humanExamples, EXAMPLE_COUNT_SCRUB, EXAMPLE_MAX_CHARS_FAST);
  const examplesReminder = examples.length > 0
    ? `\nTarget voice:\n${examples.map((e, i) => `[${i + 1}] "${e.text}"`).join('\n')}`
    : '';

  const system = `You are making surgical fixes to a text. Fix ONLY what is listed. Do not rewrite whole paragraphs.

⚠️ WORD COUNT IS CRITICAL: Output MUST be between ${minWords} and ${maxWords} words.
The text is currently ${wc(text)} words.
Every change is a SWAP — replace content, never add new content.
If you fix a banned word, replace it with one word, not a phrase.
If you rewrite a sentence, keep it the same length as the original.

PROBLEMS TO FIX:
${problems.length > 0 ? problems.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'No critical problems — apply improvements below:'}

ALWAYS DO (swap only, no additions):
1. Replace 3 predictable word choices with less obvious but natural alternatives
2. Rewrite the 2 most AI-sounding sentences at the same length
3. Replace 2 words no real person would say
4. Work 1 parenthetical aside (like this) into an existing sentence
5. Replace formal transitions with how a person would actually connect ideas
6. Make 1 sentence start mid-thought: dash, "I mean,", or "or rather,"${examplesReminder}

Output ONLY the fixed text.`;

  const result = await mistral(apiKey, system, `Fix this text:\n\n${text}`, 0.68, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 5: Verification pass ───────────────────────────────────────────────
async function verifyAndFix(apiKey, text, originalText, humanExamples) {
  const { burst, banned, aiOpeners } = scoreText(text);
  const originalWordCount = wc(originalText);
  const currentWC = wc(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const examples = pickExamples(humanExamples, EXAMPLE_COUNT_VERIFY, EXAMPLE_MAX_CHARS_FAST);
  const exampleSnippets = examples.map((e, i) => `[${i + 1}] "${e.text}"`).join('\n');

  const system = `You are checking a text for remaining AI patterns and fixing them.

⚠️ WORD COUNT IS CRITICAL: Text is ${currentWC} words. Output MUST be ${minWords}–${maxWords} words.
Every fix is a swap. Do not add new content under any circumstances.

WHAT TO LOOK FOR AND FIX:
1. Sentences where every word is the safest expected choice — rewrite with less predictable but natural words
2. Paragraphs flowing too smoothly — add a bump, aside, or self-correction
3. Remaining formulaic structure: topic → evidence → conclusion
4. Missing fragments — short punchy incomplete thoughts
5. Polished vocabulary no real person would actually say
6. Writer demonstrating a thesis rather than thinking out loud

${examples.length > 0 ? `Real human voice for comparison:\n${exampleSnippets}` : ''}

Current issues:
- Burstiness: ${burst} ${burst < 0.5 ? '(TOO LOW)' : '(ok)'}
- Banned words: ${banned.length > 0 ? banned.join(', ') : 'none'}
- AI openers: ${aiOpeners.length > 0 ? aiOpeners.slice(0, 3).map(s => s.trim()).join(' | ') : 'none'}

Output ONLY the corrected text.`;

  const result = await mistral(apiKey, system, `Review and fix this text:\n\n${text}`, 0.75, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 6: Final burstiness enforcement ────────────────────────────────────
async function enforceBurstiness(apiKey, text, originalWordCount) {
  const burst = calcBurstiness(text);
  if (burst >= 0.5) return text;

  const sents = text.match(/[^.!?]+[.!?]+/g) || [];
  const avg = sents.map(s => s.trim().split(/\s+/).length).reduce((a, b) => a + b, 0) / sents.length;
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const system = `Fix sentence length variation. Burstiness is ${burst} — needs to reach 0.5.
Current average sentence length: ~${Math.round(avg)} words.
Current word count: ${wc(text)}. Output MUST stay between ${minWords} and ${maxWords} words.

DO THIS (restructure only — do not add content):
1. Break the 4 longest sentences each into 2 (one under 10 words, one normal)
2. Vary the 4 most similar-length sentences dramatically
3. Turn 3 full sentences into fragments under 6 words each
4. Combine 2 pairs of short sentences into longer ones (25+ words)

Keep 100% of the meaning. Output ONLY the fixed text.`;

  const result = await mistral(apiKey, system, text, 0.65, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 7: Word count enforcement ──────────────────────────────────────────
async function enforceWordCount(apiKey, text, originalWordCount) {
  const currentWC = wc(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  if (currentWC >= minWords && currentWC <= maxWords) return text;

  const delta = currentWC - originalWordCount;

  if (delta > 0) {
    const system = `Trim this text from ${currentWC} words to between ${minWords} and ${maxWords} words.

Cut by:
1. Removing filler ("in order to" → "to", "due to the fact that" → "because")
2. Shortening long sentences without changing meaning
3. Removing repeated ideas — keep only the first mention
Do NOT cut any unique ideas or arguments.

Output ONLY the trimmed text.`;
    return await mistral(apiKey, system, text, 0.3, maxWords * 3);
  } else {
    const system = `Expand this text from ${currentWC} words to between ${minWords} and ${maxWords} words.

Expand by:
1. Adding a short concrete detail to 1-2 existing points
2. Expanding a fragment or very short sentence into a fuller thought
Do NOT add new arguments.

Output ONLY the expanded text.`;
    return await mistral(apiKey, system, text, 0.5, maxWords * 3);
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
    rules.push('NEVER use contractions — "do not" not "don\'t"');
  } else if (s.includes('always use contractions')) {
    rules.push("Use contractions freely — it's, don't, can't, I'm");
  }
  if (s.includes('very casual')) rules.push('Very casual tone — like talking to a friend');
  if (s.includes('formal and precise')) rules.push('Formal and precise tone throughout');
  if (s.includes('short and punchy')) rules.push('Keep most sentences under 14 words');
  if (s.includes('long and detailed')) rules.push('Use longer flowing sentences');

  if (profile.examples?.length) {
    return `\n━━ THIS WRITER'S VOICE ━━\nMatch their vocabulary and rhythm:\n${profile.examples.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}\n\n${rules.length ? 'Rules:\n' + rules.map(r => `  • ${r}`).join('\n') : ''}`;
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

  log('1/7', `Analyzing topic and keywords... (original: ${originalWordCount} words)`);
  const topicData = await extractTopic(apiKey, inputText);
  log('1/7', `Topic: "${topicData.topic}" | Keywords: "${topicData.keywords}"`);

  log('2/7', `Scraping Reddit for: "${topicData.keywords}"...`);
  let humanExamples = [];
  try {
    const scraped = await gatherHumanExamples(topicData.keywords, inputText);
    humanExamples = scraped.human || [];
    log('2/7', `Found ${humanExamples.length} real human examples`);
  } catch (e) {
    log('2/7', `Scraping failed (${e.message}) — continuing without examples`);
  }

  log('3/7', 'Rewriting using real Reddit examples...');
  let result = await rewriteWithExamples(apiKey, inputText, humanExamples, strength, styleProfile);
  let scores = scoreText(result);
  let currentWC = wc(result);
  log('3/7', `After rewrite: ${currentWC} words (target: ${originalWordCount}) | burstiness=${scores.burst} | banned=${scores.banned.length} | ai-openers=${scores.aiOpeners.length} | frags=${scores.frags}`);

  log('4/7', 'Splicing real human sentences into AI-sounding spots...');
  result = await spliceHumanSentences(apiKey, result, humanExamples, originalWordCount);
  scores = scoreText(result);
  currentWC = wc(result);
  log('4/7', `After splice: ${currentWC} words | burstiness=${scores.burst} | banned=${scores.banned.length}`);

  log('5/7', 'Surgical scrub — fixing remaining AI patterns...');
  result = await surgicalScrub(apiKey, result, humanExamples, originalWordCount);
  scores = scoreText(result);
  currentWC = wc(result);
  log('5/7', `After scrub: ${currentWC} words | burstiness=${scores.burst} | banned=${scores.banned.length} | ai-openers=${scores.aiOpeners.length} | frags=${scores.frags}`);

  log('6/7', 'Verification pass — model checks its own output...');
  result = await verifyAndFix(apiKey, result, inputText, humanExamples);
  scores = scoreText(result);
  currentWC = wc(result);
  log('6/7', `After verify: ${currentWC} words | burstiness=${scores.burst} | banned=${scores.banned.length} | ai-openers=${scores.aiOpeners.length}`);

  if (scores.burst < 0.5) {
    log('6/7', `Burstiness still low (${scores.burst}) — enforcing sentence variation...`);
    result = await enforceBurstiness(apiKey, result, originalWordCount);
    scores = scoreText(result);
    currentWC = wc(result);
    log('6/7', `After burstiness fix: ${currentWC} words | burstiness=${scores.burst}`);
  } else {
    log('6/7', `Burstiness OK (${scores.burst}) — skipping`);
  }

  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  currentWC = wc(result);

  if (currentWC < minWords || currentWC > maxWords) {
    log('7/7', `Word count out of range (${currentWC}, need ${minWords}–${maxWords}) — correcting...`);
    result = await enforceWordCount(apiKey, result, originalWordCount);
    currentWC = wc(result);
    log('7/7', `Final word count: ${currentWC} (target: ${originalWordCount})`);
  } else {
    log('7/7', `Word count OK: ${currentWC} (target: ${originalWordCount})`);
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
    humanExampleSources: [...new Set(humanExamples.map(e => e.source))].slice(0, 8)
  };

  return { text: result, scores: finalScores };
}
