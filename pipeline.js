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
async function groq(apiKey, system, user, temp = 0.85, maxTokens = 4096) {
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

  const temps = { aggressive: 0.95, standard: 0.82, subtle: 0.65 };

  const examplesBlock = humanExamples.length > 0
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REAL HUMAN WRITING — SCRAPED FROM REDDIT RIGHT NOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These are actual Reddit posts and comments written by real people on this topic.
They were not written by AI. They are raw, unpolished, and genuinely human.
Study them obsessively:
- How do they open sentences? (Not with "Furthermore" or "It is important to")
- What vocabulary do they use? (Ordinary words, not academic jargon)
- How long are their sentences? (Wildly varied — some very short, some long)
- What imperfections do they have? (Fragments, asides, self-corrections, hedges)
- How do they express opinions? (Directly, with "I think" and "honestly" and "the thing is")

${shuffle(humanExamples).slice(0, 10).map((e, i) =>
  `[REAL HUMAN EXAMPLE ${i + 1} — ${e.source}]\n"${e.text}"`
).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR REWRITE MUST SOUND LIKE THESE EXAMPLES
Not like an essay assistant. Like a real person who wrote these.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : `(No Reddit examples available — write purely from natural human voice intuition)`;

  const styleBlock = styleProfile
    ? buildStyleBlock(styleProfile)
    : '';

  const system = `${personas[strength]}

${examplesBlock}
${styleBlock}

━━ RULES YOU MUST FOLLOW — READ ALL OF THESE ━━

MEANING: Preserve 100% of the original meaning. Every idea must stay. Nothing added, nothing removed.

⚠️ WORD COUNT — THIS IS YOUR MOST IMPORTANT CONSTRAINT:
The original text is ${wordTarget} words. You MUST output between ${minWords} and ${maxWords} words.
That is a hard limit. NOT a suggestion. Do not add examples, elaborations, or qualifications that weren't in the original.
Do not pad. Do not expand. Replace ideas with ideas. One sentence in, one sentence out.
Count your words as you write. If you go over ${maxWords}, cut before submitting.

SENTENCE LENGTH — MANDATORY BURSTINESS:
For every group of 4 sentences, you MUST have:
  • At least 1 sentence under 8 words
  • At least 1 sentence over 25 words
  • The rest varied (not all the same length)
This is critical for bypassing AI detectors. Uniform sentence length = instant detection.

FRAGMENTS: Add at least 3 standalone fragment sentences — grammatically incomplete, standing alone. Like:
  "Which is the whole problem."
  "Not always."
  "Worth thinking about."
These replace existing sentences — they do NOT add to the word count.

DASHES: Use at least 2 mid-thought interruptions with dashes — where you break your own sentence — before continuing.

HEDGES: Include at least 2 genuine first-person hedges like "I think", "probably", "at least in my reading".

BANNED WORDS — NEVER USE THESE:
${BANNED.join(', ')}

BANNED OPENERS:
• "Additionally," / "Furthermore," / "Moreover,"
• "It is important to..." / "It is worth noting..."
• "This demonstrates..." / "This highlights..."
• "In conclusion," / "To summarize,"

OUTPUT: Return ONLY the rewritten text. No preamble, no "Here is the rewrite:", nothing before or after.`;

  return await groq(apiKey, system, `Rewrite this text now:\n\n${inputText}`, temps[strength]);
}

// ─── PASS 3: Surgical scrub ────────────────────────────────────────────────────
async function surgicalScrub(apiKey, text, humanExamples, originalWordCount) {
  const { burst, banned, aiOpeners, frags } = scoreText(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const problems = [];
  if (burst < 0.48) problems.push(`BURSTINESS TOO LOW (${burst}, need ≥ 0.5) — sentence lengths are too uniform. Break 2-3 sentences into short ones (under 8 words). Expand 1-2 into long ones (25+ words). Do NOT add new content — restructure existing sentences.`);
  if (banned.length > 0) problems.push(`BANNED WORDS FOUND — replace each with a natural alternative: ${banned.join(', ')}`);
  if (aiOpeners.length > 0) problems.push(`AI SENTENCE OPENERS FOUND — rewrite these so they don't start the AI way:\n${aiOpeners.slice(0, 4).map(s => `  • "${s.trim()}"`).join('\n')}`);
  if (frags < 2) problems.push(`NOT ENOUGH FRAGMENTS (${frags} found, need ≥ 3) — convert 2 normal sentences into short standalone fragments. Replace, don't add.`);

  const examplesReminder = humanExamples.length > 0
    ? `\nRemember: the target is writing that sounds like these Reddit examples:\n${shuffle(humanExamples).slice(0, 3).map(e => `"${e.text.slice(0, 150)}..."`).join('\n')}`
    : '';

  const system = `You are an AI detection specialist making targeted surgical fixes. Fix ONLY the specific problems listed. Do not rewrite whole paragraphs unless required.

⚠️ WORD COUNT CONSTRAINT: The text must stay between ${minWords} and ${maxWords} words. When you fix something, replace — do not add. Every fix is a swap, not an addition.

PROBLEMS TO FIX:
${problems.length > 0 ? problems.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'No critical problems — make the improvements below only:'}

ALWAYS DO THESE 8 FIXES (by replacing existing content, not adding):
1. Find the 3 most predictable word choices and replace them with less obvious but natural alternatives
2. Find the 2 most "AI-sounding" sentences and rewrite them from scratch at the same length
3. Find 2 technically-correct-but-no-real-person-would-say-this words and replace them
4. Add 1 parenthetical aside (like this) by working it into an existing sentence
5. Find any sentence that announces what the paragraph will say and cut or rewrite it
6. Add 1 place where a statement is immediately qualified slightly — by editing an existing sentence
7. Replace any remaining transition phrases with how a person would actually connect those ideas
8. Make sure at least 1 sentence starts mid-thought with a dash or "I mean" or "or rather"${examplesReminder}

Output ONLY the fixed text. No preamble, no explanation.`;

  return await groq(apiKey, system, `Fix this text:\n\n${text}`, 0.72);
}

// ─── PASS 4: Verification pass ───────────────────────────────────────────────
async function verifyAndFix(apiKey, text, originalText, humanExamples) {
  const { burst, banned, aiOpeners } = scoreText(text);
  const originalWordCount = wc(originalText);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const exampleSnippets = shuffle(humanExamples).slice(0, 4).map(e => `"${e.text.slice(0, 200)}"`).join('\n');

  const system = `You are a ruthless AI text detector reviewing a piece of writing. Find every remaining trace of AI writing and fix it.

Read this text as if you are running GPTZero and Turnitin. Find everything that would flag it.

What to look for:
1. Sentences where every word is the most expected, statistically safe choice — rewrite with less predictable but still natural word choices
2. Paragraphs that flow too smoothly — real human writing has bumps, asides, self-corrections
3. Any remaining formulaic structure: topic sentence → supporting details → conclusion
4. Sentences that all end with a full stop and complete thought — fragments are missing
5. Vocabulary that is "technically correct but suspiciously polished" — replace with messier, realer choices
6. Any place where the writer sounds like they are demonstrating their thesis rather than thinking
7. Missing personality — the reader should feel like a specific person wrote this

${humanExamples.length > 0 ? `Real human writing on this topic sounds like this:\n${exampleSnippets}` : ''}

Current text problems:
- Burstiness: ${burst} ${burst < 0.5 ? '(TOO LOW — fix sentence length variation)' : '(ok)'}
- Banned words still present: ${banned.length > 0 ? banned.join(', ') : 'none'}
- AI openers still present: ${aiOpeners.length > 0 ? aiOpeners.slice(0, 3).map(s => s.trim()).join(' | ') : 'none'}

⚠️ WORD COUNT CONSTRAINT: Original was ${originalWordCount} words. Output must be between ${minWords} and ${maxWords} words.
When fixing, swap content — do not add new content. Every change is a replacement.

Output ONLY the corrected text. Nothing else.`;

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

  const system = `You are fixing sentence length variation in this text. The burstiness score is ${burst} — it needs to be at least 0.5.

Current average sentence length: ~${Math.round(avg)} words.

DO THIS:
1. Find the 4 longest sentences and break each into 2 shorter ones (one under 10 words, one normal)
2. Find the 4 most similar-length sentences and vary them dramatically
3. Turn 3 full sentences into fragments — short, punchy, incomplete, under 6 words each
4. Combine 2 pairs of short sentences into longer flowing ones (25+ words)

⚠️ Keep output between ${minWords} and ${maxWords} words. Restructure sentences — do not add new content.
Keep 100% of the meaning.

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
  const action = delta > 0 ? 'too long' : 'too short';
  console.log(`  → Word count ${action}: ${currentWC} vs target ${originalWordCount} — correcting...`);

  if (delta > 0) {
    // Need to trim
    const system = `This text is ${currentWC} words but needs to be between ${minWords} and ${maxWords} words (original was ${originalWordCount} words).

Trim it by:
1. Removing redundant phrases and filler (e.g. "in order to" → "to", "the fact that" → cut)
2. Shortening overly long sentences without changing their meaning
3. Cutting any elaborations or repetitions that weren't in the original
4. Do NOT cut any ideas, arguments, or key points — only cut padding and redundancy

Output ONLY the trimmed text. No explanation.`;
    return await groq(apiKey, system, text, 0.4, maxWords * 2);
  } else {
    // Need to expand (rare, but handle it)
    const system = `This text is ${currentWC} words but needs to be between ${minWords} and ${maxWords} words (original was ${originalWordCount} words).

Expand it slightly by:
1. Adding a short concrete detail or example to 1-2 existing points
2. Expanding a fragment or very short sentence into a fuller thought
3. Do NOT add new arguments or change any existing ideas

Output ONLY the expanded text. No explanation.`;
    return await groq(apiKey, system, text, 0.5, maxWords * 2);
  }
}

// ─── Style block builder ──────────────────────────────────────────────────────
function buildStyleBlock(profile) {
  if (!profile) return '';
  const rules = [];
  const s = (profile.summary || '').toLowerCase();

  if (s.includes('never start sentences with conjunctions')) {
    rules.push('NEVER start sentences with "And", "But", "So", "Or", "Yet" — scan every sentence before returning');
  } else if (s.includes('often start')) {
    rules.push('Feel free to start sentences with "And", "But", or "So"');
  }
  if (s.includes('rarely or never use contractions')) {
    rules.push('NEVER use contractions — "do not" not "don\'t", "it is" not "it\'s"');
  } else if (s.includes('always use contractions')) {
    rules.push("Use contractions freely — it's, don't, can't, I'm, they're");
  }
  if (s.includes('very casual')) rules.push('Very casual tone — like talking to a friend, not writing for a professor');
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
    log('5/6', `Burstiness OK (${scores.burst}) — skipping length pass`);
  }

  // ── Final word count check — always run this ─────────────────────────────
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
