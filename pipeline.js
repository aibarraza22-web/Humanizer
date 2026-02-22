// ═══════════════════════════════════════════════════════════════════
//  pipeline.js — multi-pass humanization using Groq Mixtral
//  Mixtral (mixtral-8x7b-32768) has 32k context vs LLaMA's 12k free tier
//  This lets us use more Reddit examples with longer excerpts.
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

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Mixtral has 32k context window on Groq free tier — much more headroom than LLaMA
const MODEL_MAIN   = 'mixtral-8x7b-32768';  // for rewrite + splice (quality matters most)
const MODEL_FAST   = 'mixtral-8x7b-32768';  // same model — can swap to llama-3.1-8b-instant if rate limited

// Token budget (32k context = lots of room):
// ~4k  system prompt scaffolding + rules
// ~3k  input text (up to ~2000 words)
// ~6k  Reddit examples (12 examples x 500 chars = ~2k tokens with overhead)
// ~4k  output
// = ~17k — well under 32k limit
const EXAMPLE_COUNT_REWRITE  = 12;   // examples for the main rewrite pass
const EXAMPLE_COUNT_SPLICE   = 25;   // individual sentences to offer for splicing
const EXAMPLE_COUNT_SCRUB    = 6;    // examples for scrub pass reminder
const EXAMPLE_COUNT_VERIFY   = 5;    // examples for verification pass
const EXAMPLE_MAX_CHARS      = 500;  // max chars per example (rewrite pass)
const EXAMPLE_MAX_CHARS_FAST = 250;  // max chars per example (scrub/verify passes)

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
async function groq(apiKey, system, user, temp = 0.85, maxTokens = 2048, model = MODEL_MAIN) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
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
  const raw = await groq(apiKey, system, text.slice(0, 600), 0.1, 200);
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

  const temps = { aggressive: 1.1, standard: 0.98, subtle: 0.80 };

  const examples = pickExamples(humanExamples, EXAMPLE_COUNT_REWRITE, EXAMPLE_MAX_CHARS);

  const examplesBlock = examples.length > 0
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REAL HUMAN WRITING — SCRAPED FROM REDDIT ON THIS EXACT TOPIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
These are real Reddit posts and comments by real people. Not AI. Not edited.
Study every detail of how they write:

WHAT TO ABSORB FROM THESE EXAMPLES:
• How they open sentences — never "Furthermore", never "It is important to"
• Their vocabulary — ordinary, direct words, not academic jargon
• Their sentence rhythm — wildly varied length, not metronomic
• Their imperfections — fragments, asides, hedges, self-corrections, tangents
• How they express opinions — "I think", "honestly", "the thing is", "I mean"
• Where they put emphasis — not at the end of a clean thesis, but mid-thought
• What they DON'T do — they don't summarize, they don't transition formally, they don't conclude

${examples.map((e, i) =>
  `[EXAMPLE ${i + 1} — ${e.source}]\n"${e.text}"`
).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR REWRITE MUST READ LIKE THESE PEOPLE WROTE IT.
Not like an essay assistant. Like a real, specific person who thinks and writes messily.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : `(No Reddit examples available — write from pure human voice intuition)`;

  const styleBlock = styleProfile ? buildStyleBlock(styleProfile) : '';

  const system = `${personas[strength]}

${examplesBlock}
${styleBlock}

━━ RULES — ALL MANDATORY ━━

MEANING: Preserve 100% of the original meaning. Every idea stays. Nothing added, nothing removed.

WORD COUNT — HARD LIMIT:
Original is ${wordTarget} words. Output MUST be between ${minWords} and ${maxWords} words.
Replace ideas with ideas. One sentence in, one sentence out.
Do not add examples, elaborations, or qualifications that weren't already there.

PERPLEXITY — THE CORE OF HOW GPTZero DETECTS AI:
GPTZero measures whether each word is the most statistically expected next token.
LLMs always default to the safest, most predictable word.
You must fight this at the word level: for every 3 sentences, find one word that is
completely correct but slightly unexpected — the word a thoughtful human would reach for
rather than the word a model would default to.
Bad (AI): "This shows the importance of regulation."
Good (human): "That's basically the whole case for oversight right there."
Bad (AI): "Furthermore, this demonstrates a need for change."
Good (human): "And honestly, that alone should be enough to make the argument."

SENTENCE VARIATION — BURSTINESS:
GPTZero also detects uniform sentence length.
Every 4 sentences must contain:
  • At least 1 sentence under 8 words
  • At least 1 sentence over 25 words  
  • The rest genuinely varied — not all 15-20 words

FRAGMENTS (MANDATORY):
Replace 3 existing sentences with short standalone grammatical fragments:
"Which is the whole point." / "Not always, though." / "Worth remembering." / "Hard to argue with."
These are replacements — they do NOT add to word count.

DASHES:
Use at least 2 mid-thought interruptions — like this — before continuing the sentence.

HEDGES:
Include at least 2 first-person hedges: "I think", "probably", "at least in my reading", "sort of".

BANNED WORDS — NEVER USE ANY OF THESE:
${BANNED.join(', ')}

BANNED SENTENCE OPENERS — NEVER START A SENTENCE WITH:
"Additionally," / "Furthermore," / "Moreover," / "In addition,"
"It is important to..." / "It is worth noting..." / "It should be noted..."
"This demonstrates..." / "This highlights..." / "This suggests..."
"In conclusion," / "To summarize," / "In summary,"
"As such," / "With this in mind," / "In light of this,"
"Building on this..." / "When considering..." / "By examining..."

OUTPUT: Return ONLY the rewritten text. Absolutely nothing before or after it.`;

  return await groq(apiKey, system, `Rewrite this text now:\n\n${inputText}`, temps[strength], 3000);
}

// ─── PASS 3: Splice real human sentences directly into the text ───────────────
// This is the key pass for beating GPTZero — we replace the most AI-sounding
// sentences with real human sentences from Reddit. GPTZero literally cannot
// flag genuinely human-written text as AI because its perplexity score
// will be naturally high (humans are unpredictable).
async function spliceHumanSentences(apiKey, text, humanExamples, originalWordCount) {
  if (humanExamples.length === 0) return text;

  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  // Pull individual sentences from all examples — prefer medium-length ones
  // that are likely to fit naturally into an essay context
  const humanSentences = humanExamples
    .flatMap(e => (e.text.match(/[^.!?]+[.!?]+/g) || []))
    .map(s => s.trim())
    .filter(s => {
      const words = s.split(/\s+/).length;
      return words >= 8 && words <= 35;
    })
    .filter(s => {
      // Filter out sentences that are too Reddit-specific to work in an essay
      const lower = s.toLowerCase();
      return !lower.includes('subreddit') &&
             !lower.includes('upvote') &&
             !lower.includes('downvote') &&
             !lower.includes('op ') &&
             !lower.includes('edit:') &&
             !lower.match(/^(lol|lmao|omg|wtf|smh)/i);
    });

  if (humanSentences.length < 5) return text; // not enough to splice

  const selected = shuffle(humanSentences).slice(0, EXAMPLE_COUNT_SPLICE);

  const system = `You are a text editor replacing AI-written sentences with real human-written ones.

Here are real sentences written by humans on Reddit about this topic:
${selected.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

YOUR TASK:
1. Read the text carefully and identify the 4 sentences that sound most AI-written
   (the ones that are smoothest, most formulaic, most predictable)
2. For each of those 4 sentences, find a sentence from the numbered list above
   that conveys a SIMILAR or COMPATIBLE meaning, or that could plausibly belong
   in the same spot in the paragraph
3. Replace each AI sentence with the human sentence from the list
4. You may lightly adapt the human sentence to fit context:
   — Change a specific noun to match the topic (e.g. "the market" → "the industry")
   — Adjust verb tense to match surrounding text
   — Change "my" to "the" if needed for academic context
   — But keep at least 75% of the original human wording intact
5. Do not change any other sentences in the text
6. Make sure the paragraph still makes sense and the meaning is preserved

WORD COUNT: Keep output between ${minWords} and ${maxWords} words.

Output ONLY the edited text. No explanation, no preamble.`;

  return await groq(apiKey, system, `Edit this text:\n\n${text}`, 0.45, 3000);
}

// ─── PASS 4: Surgical scrub ────────────────────────────────────────────────────
async function surgicalScrub(apiKey, text, humanExamples, originalWordCount) {
  const { burst, banned, aiOpeners, frags } = scoreText(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const problems = [];
  if (burst < 0.48) problems.push(`BURSTINESS TOO LOW (${burst}, need >= 0.5) — break 2-3 sentences into short ones (under 8 words), expand 1-2 into long ones (25+ words). Restructure existing sentences, do NOT add content.`);
  if (banned.length > 0) problems.push(`BANNED WORDS — replace each with a natural alternative: ${banned.join(', ')}`);
  if (aiOpeners.length > 0) problems.push(`AI OPENERS — rewrite these sentences so they don't start this way:\n${aiOpeners.slice(0, 5).map(s => `  • "${s.trim()}"`).join('\n')}`);
  if (frags < 2) problems.push(`NOT ENOUGH FRAGMENTS (${frags}, need >= 3) — convert 2 sentences into short standalone fragments. Replace, don't add.`);

  const examples = pickExamples(humanExamples, EXAMPLE_COUNT_SCRUB, EXAMPLE_MAX_CHARS_FAST);
  const examplesReminder = examples.length > 0
    ? `\nTarget voice — real Reddit writing on this topic:\n${examples.map((e, i) => `[${i + 1}] "${e.text}"`).join('\n')}`
    : '';

  const system = `You are an AI detection specialist making targeted surgical fixes. Fix ONLY the specific problems listed below.

WORD COUNT: Stay between ${minWords} and ${maxWords} words. Every fix is a swap, not an addition.

PERPLEXITY RULE: For every 3 sentences, find one predictable word and swap it for a
slightly unexpected but completely natural alternative. This is the single most effective
thing you can do to lower GPTZero scores.

PROBLEMS TO FIX:
${problems.length > 0 ? problems.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'No critical structural problems — apply the improvements below:'}

ALWAYS DO ALL OF THESE (swap existing content — do not add):
1. Find the 3 most predictable word choices and replace with less obvious but natural alternatives
2. Rewrite the 2 most AI-sounding sentences from scratch at the same approximate length
3. Find 2 words that are technically correct but no real person would actually say — replace them
4. Work 1 parenthetical aside (like this one) into an existing sentence naturally
5. Find any sentence that just announces what the paragraph will say — cut or rewrite it
6. Edit 1 sentence so a strong claim is immediately softened or qualified slightly
7. Replace all remaining formal transition phrases with how a person would actually connect those ideas in speech
8. Make at least 1 sentence start mid-thought using a dash, "I mean,", or "or rather,"${examplesReminder}

Output ONLY the fixed text. No preamble, no explanation.`;

  return await groq(apiKey, system, `Fix this text:\n\n${text}`, 0.72, 3000, MODEL_FAST);
}

// ─── PASS 5: Verification pass ───────────────────────────────────────────────
async function verifyAndFix(apiKey, text, originalText, humanExamples) {
  const { burst, banned, aiOpeners } = scoreText(text);
  const originalWordCount = wc(originalText);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const examples = pickExamples(humanExamples, EXAMPLE_COUNT_VERIFY, EXAMPLE_MAX_CHARS_FAST);
  const exampleSnippets = examples.map((e, i) => `[${i + 1}] "${e.text}"`).join('\n');

  const system = `You are a ruthless AI text detector reviewing a piece of writing before submission.
Imagine you ARE GPTZero. Find every remaining trace of AI writing and fix it.

WHAT GPTZero AND TURNITIN ACTUALLY LOOK FOR:
1. Low perplexity — every word being the statistically safest next token
2. Low burstiness — all sentences being roughly the same length
3. Overly smooth paragraph flow — no bumps, no asides, no self-corrections
4. Clean formal transitions — "However," "Moreover," "Furthermore,"
5. Thesis-demonstration structure — claim → evidence → conclusion, every time
6. Zero personality markers — no hedges, no fragments, no first-person voice
7. Suspiciously correct vocabulary — polished but no one actually talks like this
8. Commercial humanizer fingerprints — they're trained on humanizer output too

${examples.length > 0 ? `Real human writing on this topic for comparison:\n${exampleSnippets}` : ''}

CURRENT SCORE:
- Burstiness: ${burst} ${burst < 0.5 ? '(STILL TOO LOW — prioritize fixing this)' : '(ok)'}
- Banned words remaining: ${banned.length > 0 ? banned.join(', ') : 'none'}
- AI openers remaining: ${aiOpeners.length > 0 ? aiOpeners.slice(0, 4).map(s => s.trim()).join(' | ') : 'none'}

WHAT TO FIX:
1. Find every sentence where every word is the most expected choice — rewrite with less predictable but natural words
2. Find any paragraph that flows too perfectly — break it with an aside or a self-correction
3. Find any remaining formulaic structure and disrupt it
4. Add any missing fragments — short punchy incomplete thoughts
5. Replace any remaining polished vocabulary with what a real person would actually say
6. Find any place that reads like someone proving a thesis rather than thinking out loud — rewrite it

WORD COUNT: Original was ${originalWordCount} words. Stay between ${minWords} and ${maxWords}. Swap — do not add.

Output ONLY the corrected text. Nothing else.`;

  return await groq(apiKey, system, `Review and fix this text:\n\n${text}`, 0.78, 3000, MODEL_FAST);
}

// ─── PASS 6: Final burstiness enforcement ────────────────────────────────────
async function enforceBurstiness(apiKey, text, originalWordCount) {
  const burst = calcBurstiness(text);
  if (burst >= 0.5) return text;

  const sents = text.match(/[^.!?]+[.!?]+/g) || [];
  const avg = sents.map(s => s.trim().split(/\s+/).length).reduce((a, b) => a + b, 0) / sents.length;
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const system = `Fix sentence length variation in this text. Current burstiness: ${burst} — needs to be at least 0.5.
Current average sentence length: ~${Math.round(avg)} words.

DO ALL OF THIS:
1. Find the 4 longest sentences and break each into 2 (one under 10 words, one normal length)
2. Find the 4 sentences closest to average length and vary them dramatically
3. Turn 3 full sentences into fragments — short, punchy, incomplete, under 6 words
4. Combine 2 pairs of very short sentences into longer flowing ones (25+ words each)

Keep output between ${minWords} and ${maxWords} words.
Restructure existing sentences — do not add new content.
Keep 100% of the meaning.
Output ONLY the fixed text.`;

  return await groq(apiKey, system, text, 0.65, 3000, MODEL_FAST);
}

// ─── PASS 7: Word count enforcement ──────────────────────────────────────────
async function enforceWordCount(apiKey, text, originalWordCount) {
  const currentWC = wc(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  if (currentWC >= minWords && currentWC <= maxWords) return text;

  const delta = currentWC - originalWordCount;

  if (delta > 0) {
    const system = `This text is ${currentWC} words. Trim it to between ${minWords} and ${maxWords} words (original was ${originalWordCount} words).

Trim by:
1. Removing filler phrases ("in order to" → "to", "due to the fact that" → "because")
2. Shortening overly long sentences without changing their meaning
3. Cutting elaborations or repetitions not in the original
Do NOT cut any ideas, arguments, or key points.

Output ONLY the trimmed text. No explanation.`;
    return await groq(apiKey, system, text, 0.3, maxWords * 2, MODEL_FAST);
  } else {
    const system = `This text is ${currentWC} words. Expand it to between ${minWords} and ${maxWords} words (original was ${originalWordCount} words).

Expand by:
1. Adding a short concrete detail or specific example to 1-2 existing points
2. Expanding a fragment or overly short sentence into a fuller thought
Do NOT add new arguments or change any existing ideas.

Output ONLY the expanded text. No explanation.`;
    return await groq(apiKey, system, text, 0.5, maxWords * 2, MODEL_FAST);
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
  log('1/7', `Analyzing topic and keywords... (original: ${originalWordCount} words)`);
  const topicData = await extractTopic(apiKey, inputText);
  log('1/7', `Topic: "${topicData.topic}" | Keywords: "${topicData.keywords}"`);

  log('2/7', `Scraping Reddit for real human writing on "${topicData.keywords}"...`);
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
    log('7/7', `Word count out of range (${currentWC}, need ${minWords}-${maxWords}) — correcting...`);
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
