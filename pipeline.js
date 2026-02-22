// ═══════════════════════════════════════════════════════════════════
//  pipeline.js — multi-pass humanization using Mistral AI
//  Core approach: sentence-structure imitation from real human examples.
//  Not rules about how to write — literal structural copying.
// ═══════════════════════════════════════════════════════════════════

import fetch from 'node-fetch';
import { gatherHumanExamples } from './scraper.js';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

const EXAMPLE_COUNT_REWRITE  = 10;
const EXAMPLE_COUNT_SPLICE   = 20;
const EXAMPLE_COUNT_SCRUB    = 5;
const EXAMPLE_MAX_CHARS      = 400;
const EXAMPLE_MAX_CHARS_FAST = 200;

// ─── Real dataset: Aiden's actual answers ────────────────────────────────────
// These are used as structural templates — the model imitates sentence by sentence,
// not just extracts rules. This is why they must stay as full verbatim answers.

const AIDEN_EXAMPLES = [
  {
    question: "How is AI changing the way startups compete in finance?",
    answer: `Artificial intelligence allows anyone to start a startup. It used to be that only a select few would have the opportunity to start a startup. You would need to be in very tight circles and have lots of funding. Now artificial intelligence allows anyone to make a startup. You used to need multiple employees and contractors which cost a lot of money. Now you just need a few macbook minis and clawdbots. When I start my startup I will have my own personal clawdbot, but then a clawdbot acting as the CFO, a clawbot acting as the COO, and a clawdboth acting as the CTO, all working together. In the end, artificial intelligence has made it so anyone and everyone can make their own startup.`
  },
  {
    question: "Will AI create more jobs than it replaces over the next 20 years?",
    answer: `Artificial intelligence can definitely create more jobs than it replaces over the next 20 years. There is a lot of historical evidence for this too. When we have a breakthrough technology jobs can go away but new ones are created because the market shifts. When the computer came out everyone thought people would lose their jobs, but it just shifted their jobs. Someone actually doing the work now will shift to managing AI doing the work. There will also be so many endless possibilities so we will have even brand new sectors. AI won't just create more jobs than it replaces, AI will make the jobs better.`
  },
  {
    question: "Should governments regulate advanced AI models like nuclear technology?",
    answer: `No, the government should definitely not regulate advanced AI models the way they regulate nuclear technology. The US is currently way behind on nuclear energy, and we are left trying to catch up. We are way behind because post WW2 we regulated it to death. Some different countries invested in nuclear energy, like we could and should have, and are prospering with clean, safe energy. Even now the overregulation of nuclear energy makes it take way too long to build and cost way more than it should. If we follow the path of regulating nuclear energy to advanced AI models, we will be stuck playing catch up.`
  },
  {
    question: "Does technological dominance equal political dominance?",
    answer: `Yes, technological dominance does equal political dominance across the world. Think about it, to have political dominance you must have something that the countries can't afford to pass up. That thing they won't be able to pass up is technological dominance. That thing in the future they won't be able to pass up, is the data centers, nuclear fusion, advanced AI, and quantum computers. If we build these out in America, then countries around the world cannot pass us up, they need us. Building out technological dominance will give us political dominance too.`
  },
  {
    question: "Should the US focus more on domestic strength than foreign intervention?",
    answer: `Yes, the US should first focus on domestic strength more than foreign intervention. Not to say absolutely no foreign intervention, but domestic should be the priority by far. How are we bailing out or bombing another country when we have homeless veterans on the street. That is the whole premise of America First, and that premise is widely supported in America, especially by the youth. America First just follows the premise of, why are other people getting help when I am struggling. It is the same thing with when illegal immigrants got free food, healthcare, and housing, when legal American citizens couldn't get anything. That is the whole reason Donald Trump got elected in the first place. The US should focus on domestic strength before it goes on focusing on foreign intervention.`
  },
  {
    question: "Will AI determine global superpower status?",
    answer: `AI will determine global superpower status. Global superpower status will be determined by who is leading in advancements. Whoever is leading in advancements, everyone else will need them. Whoever has what everyone needs will be a superpower. To remain the world's only super power, America must focus on being on the front lines advancing AI and do everything we can so no one comes close. Whoever leads in AI will gain global superpower status.`
  }
];

// ─── AI examples — shown so model knows exactly what NOT to produce ───────────
const AI_EXAMPLES = [
  {
    label: "ChatGPT — DO NOT write like this",
    sample: `Artificial intelligence is basically compressing time and lowering barriers. That's the core shift. In finance especially, where speed, information, and risk modeling decide who wins, AI lets small teams compete with institutions that used to need hundreds of analysts and massive infrastructure. First, analysis is getting automated at scale. Second, prediction quality is becoming the edge. Third, personalization is becoming scalable.`
  },
  {
    label: "Claude — DO NOT write like this",
    sample: `AI is reshaping startup competition in financial services in some pretty fundamental ways. Here's what's driving the shift: Leveling the playing field on data — Traditionally, incumbents had a massive moat in the form of decades of customer transaction data. The honest caveat is that AI also introduces new risks — model bias in lending, explainability challenges for regulators, and systemic fragility if many institutions rely on similar underlying models.`
  }
];

// ─── What GPTZero actually flags — these are the specific patterns ────────────
// This list comes from reverse-engineering what GPTZero 4.2b flags as AI.
// The key insight: GPTZero flags PREDICTABILITY, not just vocabulary.
// A sentence is flagged when every word is the most likely next word.
// Aiden's writing is unpredictable because he states things bluntly,
// repeats phrases unexpectedly, and doesn't follow essay structure.

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
  'plays a pivotal role','plays a crucial role','a wide range of','a variety of',
  'incumbent','trajectory','paradigm','framework','ecosystem'
];

const AI_OPENERS = [
  /^(Additionally|Furthermore|Moreover|In addition),?\s/i,
  /^(However|Nevertheless|Nonetheless),?\s/i,
  /^(In conclusion|To summarize|In summary|Overall|Ultimately),?\s/i,
  /^It is (important|crucial|essential|worth noting) (to|that)\s/i,
  /^This (shows|demonstrates|highlights|suggests|indicates|underscores)\s/i,
  /^(As such|As a result|As previously mentioned),?\s/i,
  /^(In light of this|With this in mind),?\s/i,
  /^(First|Second|Third|Fourth|Fifth),?\s/i,
  /^(Here'?s? (what|why|the|how))/i,
  /^(It is (clear|evident|apparent) that)\s/i,
];

// ─── Mistral API ──────────────────────────────────────────────────────────────
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
      temperature: Math.min(temp, 1.0),
      max_tokens: maxTokens
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error?.message || 'Mistral API error');
  return data.choices[0].message.content.trim();
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function wc(text) { return text.trim().split(/\s+/).length; }

function getSentences(text) {
  return (text.match(/[^.!?]+[.!?]+/g) || [text]).map(s => s.trim());
}

function calcBurstiness(text) {
  const lens = getSentences(text).map(s => s.split(/\s+/).length).filter(l => l > 0);
  if (lens.length < 2) return 0;
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lens.length;
  return parseFloat((Math.sqrt(variance) / avg).toFixed(3));
}

function countBannedWords(text) {
  return BANNED.filter(w => text.toLowerCase().includes(w.toLowerCase()));
}

function countAIOpeners(text) {
  return getSentences(text).filter(s => AI_OPENERS.some(p => p.test(s)));
}

function countFragments(text) {
  return getSentences(text).filter(s => s.split(/\s+/).length <= 6).length;
}

function scoreText(text) {
  return {
    burst: calcBurstiness(text),
    banned: countBannedWords(text),
    aiOpeners: countAIOpeners(text),
    frags: countFragments(text)
  };
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function pickExamples(examples, n, maxChars) {
  return shuffle(examples).slice(0, n).map(e => ({ ...e, text: e.text.slice(0, maxChars) }));
}

// ─── Hard trim — prevents any pass from snowballing ──────────────────────────
async function hardTrim(apiKey, text, targetWC) {
  const current = wc(text);
  if (current <= Math.ceil(targetWC * 1.15)) return text;
  const system = `Trim this text from ${current} words to approximately ${targetWC} words.
Remove repeated ideas, filler phrases, redundant clauses.
Do NOT remove any unique ideas or arguments.
Output ONLY the trimmed text. Nothing else.`;
  return await mistral(apiKey, system, text, 0.3, targetWC * 3);
}

// ─── Find the Aiden example most similar to a question (for Answer tab) ───────
// For out-of-dataset questions, fall back to the most structurally versatile examples
function findClosestAidenExample(question) {
  const q = question.toLowerCase();
  const qWords = q.split(/\s+/).filter(w => w.length > 3);

  const scored = AIDEN_EXAMPLES.map((ex, i) => {
    const exWords = ex.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    // Score both word overlap AND semantic overlap (partial matches)
    const exact = qWords.filter(w => exWords.includes(w)).length;
    const partial = qWords.filter(w => exWords.some(ew => ew.includes(w) || w.includes(ew))).length;
    return { i, score: exact * 2 + partial };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: prefer examples 4 (domestic) or 1 (jobs) — most versatile argument structures
    const prefer = [4, 1, 2, 3, 0, 5];
    return prefer.indexOf(a.i) - prefer.indexOf(b.i);
  });

  return AIDEN_EXAMPLES[scored[0].i];
}

// ─── Find Aiden example closest in sentence count to input (for Humanize) ─────
function findClosestByLength(inputText) {
  const inputCount = getSentences(inputText).length;
  return AIDEN_EXAMPLES.reduce((best, ex) => {
    const exCount = getSentences(ex.answer).length;
    const bestCount = getSentences(best.answer).length;
    return Math.abs(exCount - inputCount) < Math.abs(bestCount - inputCount) ? ex : best;
  });
}

// ─── Build the sentence-by-sentence breakdown of an example ───────────────────
function sentenceBreakdown(text) {
  return getSentences(text)
    .map((s, i) => `  S${i + 1}: "${s}"`)
    .join('\n');
}

// ─── PASS 1: Extract topic + keywords ────────────────────────────────────────
async function extractTopic(apiKey, text) {
  const system = `Extract the core topic and a short Reddit search phrase from this text.
Return JSON only, no other text:
{"topic":"short topic name","keywords":"3 to 5 words total for Reddit search","genre":"essay|argument|analysis|personal|technical"}
Keywords must be 3-5 words total. One phrase only. Not a list.`;
  const raw = await mistral(apiKey, system, text.slice(0, 600), 0.1, 150);
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.keywords && parsed.keywords.split(/\s+/).length > 6) {
      parsed.keywords = parsed.keywords.split(/\s+/).slice(0, 5).join(' ');
    }
    return parsed;
  } catch {
    return { topic: 'general topic', keywords: 'college essay writing', genre: 'essay' };
  }
}

// ─── PASS 3: Rewrite using sentence-structure imitation ──────────────────────
async function rewriteHuman(apiKey, inputText, humanExamples, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);
  const temps = { aggressive: 0.95, standard: 0.85, subtle: 0.72 };

  // Find the Aiden example closest in length — this is the structural template
  const template = findClosestByLength(inputText);
  const templateBreakdown = sentenceBreakdown(template.answer);

  const allAidenText = AIDEN_EXAMPLES.map((e, i) =>
    `[HUMAN EXAMPLE ${i + 1}]\n${e.answer}`
  ).join('\n\n');

  const allAIText = AI_EXAMPLES.map(e =>
    `[${e.label}]\n${e.sample}`
  ).join('\n\n');

  const redditBlock = humanExamples.length > 0
    ? '\n━━━ REAL HUMAN WRITING ON THIS TOPIC (Reddit) ━━━\n' +
      pickExamples(humanExamples, EXAMPLE_COUNT_REWRITE, EXAMPLE_MAX_CHARS)
        .map((e, i) => `[${i + 1}] "${e.text}"`)
        .join('\n')
    : '';

  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const system = `You are rewriting text. Your goal is to make the output match the sentence structure of the human examples below, not the AI examples.

━━━ HUMAN WRITING — IMITATE THIS ━━━
${allAidenText}
${redditBlock}

━━━ AI WRITING — DO NOT SOUND LIKE THIS ━━━
${allAIText}

━━━ YOUR STRUCTURAL TEMPLATE ━━━
This is how a real human wrote a similar-length piece. Match this sentence-by-sentence rhythm:
${templateBreakdown}

For each sentence in the input:
1. Express the same idea
2. Use roughly the same word count as the corresponding template sentence
3. Write it the way a real person would say it — direct, plain, confident
4. NOT the way an AI would explain it — no qualifiers, no hedges, no academic words

━━━ WORD COUNT — STRICT ━━━
Input: ${wordTarget} words. Output MUST be ${minWords}–${maxWords} words.
Every idea in the input stays. No new ideas added.

━━━ NEVER DO ━━━
• Comma-lists of concepts: "X, Y, and Z"
• Em dashes for effect: "Look around—" / "Here's the thing—"
• "Here's what..." or "Here's why..." setups
• Hedging: arguably, it could be said, one might argue
• Acknowledging the other side
• Numbered structure: First... Second... Third...
• Long sentences over 20 words
• Any of these words: ${BANNED.slice(0, 30).join(', ')}

${userStyleBlock}

OUTPUT: Return ONLY the rewritten text. No explanation, no preamble.`;

  const result = await mistral(apiKey, system, `Rewrite this text:\n\n${inputText}`, temps[strength], 3000);
  return await hardTrim(apiKey, result, wordTarget);
}

// ─── PASS 4: Splice real human sentences ─────────────────────────────────────
async function spliceHumanSentences(apiKey, text, humanExamples, originalWordCount) {
  if (humanExamples.length === 0) return text;

  const humanSentences = humanExamples
    .flatMap(e => (e.text.match(/[^.!?]+[.!?]+/g) || []))
    .map(s => s.trim())
    .filter(s => {
      const words = s.split(/\s+/).length;
      return words >= 8 && words <= 30;
    })
    .filter(s => {
      const lower = s.toLowerCase();
      return !lower.includes('subreddit') && !lower.includes('upvote') &&
             !lower.includes('downvote') && !lower.includes(' op ') &&
             !lower.includes('edit:') && !lower.match(/^(lol|lmao|omg|wtf)/i);
    });

  if (humanSentences.length < 5) return text;

  const selected = shuffle(humanSentences).slice(0, EXAMPLE_COUNT_SPLICE);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const system = `Replace the 3 most AI-sounding sentences in this text with real human-written sentences from the list below.

Real human sentences to use:
${selected.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Rules:
1. Find the 3 smoothest, most predictable, most AI-sounding sentences in the text
2. Replace each with a sentence from the list above that fits contextually
3. You may lightly adapt (change a noun, adjust tense) — keep 75%+ of the original wording
4. Do not change any other sentences
5. Keep output between ${minWords} and ${maxWords} words

Output ONLY the edited text.`;

  const result = await mistral(apiKey, system, `Edit this text:\n\n${text}`, 0.45, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 5: Scrub ────────────────────────────────────────────────────────────
async function surgicalScrub(apiKey, text, humanExamples, originalWordCount) {
  const { banned, aiOpeners } = scoreText(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const problems = [];
  if (banned.length > 0) problems.push(`Replace these banned words with casual alternatives: ${banned.join(', ')}`);
  if (aiOpeners.length > 0) problems.push(`Rewrite these AI sentence openers:\n${aiOpeners.slice(0, 4).map(s => `  • "${s}"`).join('\n')}`);

  const redditReminder = humanExamples.length > 0
    ? '\nReal human writing on this topic:\n' +
      pickExamples(humanExamples, EXAMPLE_COUNT_SCRUB, EXAMPLE_MAX_CHARS_FAST)
        .map((e, i) => `[${i + 1}] "${e.text}"`).join('\n')
    : '';

  const system = `Make targeted fixes to this text. Every fix is a swap — never add new content.

⚠️ WORD COUNT: text is ${wc(text)} words. Must stay ${minWords}–${maxWords} words.

PROBLEMS TO FIX:
${problems.length > 0 ? problems.join('\n') : 'No critical problems — apply the improvements below.'}

ALWAYS FIX:
1. Find 3 sentences where every word is the obvious expected choice — replace 2-3 words in each with less predictable but natural alternatives
2. Find 2 sentences that explain something — rewrite them to state it instead
3. Find any sentence that hedges or maps perspectives — make it take a clear side
4. Find any list of 3+ things separated by commas — restructure into separate sentences
${redditReminder}

Output ONLY the fixed text.`;

  const result = await mistral(apiKey, system, `Fix this text:\n\n${text}`, 0.68, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 6: Verify ───────────────────────────────────────────────────────────
async function verifyAndFix(apiKey, text, originalText, humanExamples) {
  const { banned, aiOpeners, burst } = scoreText(text);
  const originalWordCount = wc(originalText);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  // Use closest Aiden example as the comparison point
  const template = findClosestByLength(text);
  const templateBreakdown = sentenceBreakdown(template.answer);

  const system = `Compare this text against real human writing and fix anything still AI-sounding.

REAL HUMAN WRITING FOR COMPARISON (sentence by sentence):
${templateBreakdown}

TEXT TO CHECK:
${sentenceBreakdown(text)}

⚠️ WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)}). Swap only, never add.

For each sentence in the text, compare it to the corresponding human sentence:
- Is it roughly the same length?
- Is it as direct and confident?
- Does it state rather than explain?
- Does it use plain words, not academic vocabulary?

Fix any sentence that differs significantly from how the human writes.

Also fix:
- Banned words still present: ${banned.length > 0 ? banned.join(', ') : 'none — check anyway'}
- AI openers: ${aiOpeners.length > 0 ? aiOpeners.slice(0,3).map(s=>s.trim()).join(' | ') : 'none — check anyway'}
- Burstiness is ${burst} ${burst < 0.45 ? '— too uniform, vary sentence lengths more' : '— ok'}

Output ONLY the corrected text.`;

  const result = await mistral(apiKey, system, text, 0.72, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 7: Word count ───────────────────────────────────────────────────────
async function enforceWordCount(apiKey, text, originalWordCount) {
  const current = wc(text);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  if (current >= min && current <= max) return text;

  if (current > max) {
    const system = `Trim this text from ${current} to between ${min} and ${max} words.
Cut filler, shorten long sentences, remove repeated ideas. Keep all unique arguments.
Output ONLY the trimmed text.`;
    return await mistral(apiKey, system, text, 0.3, max * 3);
  } else {
    const system = `Expand this text from ${current} to between ${min} and ${max} words.
Add a concrete detail to 1-2 existing points. Do not add new arguments.
Output ONLY the expanded text.`;
    return await mistral(apiKey, system, text, 0.5, max * 3);
  }
}

// ─── User style block ─────────────────────────────────────────────────────────
function buildUserStyleBlock(profile) {
  if (!profile) return '';
  const rules = [];
  const s = (profile.summary || '').toLowerCase();
  if (s.includes('rarely or never use contractions')) rules.push('Avoid contractions');
  else if (s.includes('always use contractions')) rules.push("Use contractions freely");
  if (s.includes('very casual')) rules.push('Very casual tone');
  if (s.includes('formal')) rules.push('More formal tone');
  if (profile.examples?.length) {
    return `\n━━ THIS USER'S OWN WRITING STYLE ━━\n${profile.examples.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n${rules.map(r => `• ${r}`).join('\n')}`;
  }
  return rules.length ? `\n━━ STYLE NOTES ━━\n${rules.map(r => `• ${r}`).join('\n')}` : '';
}

// ─── Answer as Aiden ──────────────────────────────────────────────────────────
export async function answerAsAiden(apiKey, question, styleProfile, onProgress) {
  const log = (step, msg) => {
    console.log(`  [${step}] ${msg}`);
    if (onProgress) onProgress({ step, msg });
  };

  log('1/3', 'Finding closest human example...');

  const closest = findClosestAidenExample(question);
  const closestBreakdown = sentenceBreakdown(closest.answer);
  const allAidenText = AIDEN_EXAMPLES.map((e, i) =>
    `[HUMAN EXAMPLE ${i + 1} — Q: "${e.question}"]\n${e.answer}`
  ).join('\n\n');
  const allAIText = AI_EXAMPLES.map(e => `[${e.label}]\n${e.sample}`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  log('1/3', `Using "${closest.question}" as structural template`);

  // THE KEY APPROACH:
  // Don't ask the model to "write like a human" — that produces humanizer output.
  // Instead: show the exact sentence-by-sentence structure of a real human answer,
  // and ask it to substitute new content into each slot.
  // This produces structurally identical output to the real human answer.

  const system = `You are going to answer a question by substituting new content into the exact sentence structure of a real human answer.

━━━ THE HUMAN ANSWER TO COPY STRUCTURALLY ━━━
Real person's answer to a similar question: "${closest.question}"

Their answer broken into sentences:
${closestBreakdown}

━━━ YOUR JOB ━━━
Answer the new question using the SAME sentence structure — same number of sentences, same sentence lengths, same sentence types (declarative, question, analogy, restatement).

For each sentence slot:
- Keep the same LENGTH (±3 words)
- Keep the same TYPE (if it's a short declarative, write a short declarative; if it's a rhetorical question, write a rhetorical question)
- Keep the same FUNCTION (opener = state conclusion; middle = explain/give example; closer = restate)
- Put in new content relevant to the new question

━━━ ALL HUMAN EXAMPLES FOR VOCABULARY REFERENCE ━━━
${allAidenText}

━━━ AI WRITING — DO NOT PRODUCE THIS ━━━
${allAIText}

━━━ HARD RULES ━━━
• Never write a sentence longer than 20 words
• Never use: however, moreover, furthermore, nuanced, leverage, complex, multifaceted, arguably, incumbent
• Never list things: "X, Y, and Z" as multi-concept lists
• Never end with a caveat or "the answer depends"
• Never acknowledge the other side has valid points
• Never use em dashes dramatically

${userStyleBlock}

OUTPUT: Return ONLY the answer. No preamble, no labels, no explanation.`;

  const draft = await mistral(apiKey, system,
    `New question: "${question}"\n\nWrite the answer now, matching the sentence structure of the human example above.`,
    0.88, 800);

  log('2/3', 'Comparing draft to human answer sentence by sentence...');

  // Pass 2: Explicit sentence-by-sentence comparison
  // This catches any drift from the human structure in the draft
  const draftSentences = getSentences(draft);
  const humanSentences = getSentences(closest.answer);

  const compareSystem = `Compare the draft answer to the human answer sentence by sentence and fix any sentences that diverged from the human's structure.

HUMAN ANSWER (sentence by sentence):
${humanSentences.map((s, i) => `H${i + 1} [${s.split(/\s+/).length} words]: "${s}"`).join('\n')}

DRAFT ANSWER (sentence by sentence):
${draftSentences.map((s, i) => `D${i + 1} [${s.split(/\s+/).length} words]: "${s}"`).join('\n')}

For each draft sentence, check:
1. Is it within 3 words of the human sentence's length? If not — shorten or expand.
2. Is it as direct and confident as the human sentence? If not — remove hedges and qualifiers.
3. Does it use plain vocabulary like the human? If not — replace academic words with plain ones.
4. Does it STATE things (like the human) rather than EXPLAIN them (like AI)? Fix if needed.

Make only the fixes needed. Keep the content and argument.
Output ONLY the corrected full answer.`;

  const final = await mistral(apiKey, compareSystem, draft, 0.45, 800);

  log('3/3', 'Done');

  return {
    text: final,
    scores: {
      bannedWordsFound: countBannedWords(final),
      aiOpenersFound: countAIOpeners(final).length,
      burstiness: calcBurstiness(final),
      wordCount: wc(final)
    }
  };
}

// ─── MAIN PIPELINE ────────────────────────────────────────────────────────────
export async function humanize(apiKey, inputText, strength, styleProfile, onProgress) {

  const log = (step, msg) => {
    console.log(`  [${step}] ${msg}`);
    if (onProgress) onProgress({ step, msg });
  };

  const originalWordCount = wc(inputText);

  log('1/7', `Analyzing topic... (original: ${originalWordCount} words)`);
  const topicData = await extractTopic(apiKey, inputText);
  log('1/7', `Topic: "${topicData.topic}" | Keywords: "${topicData.keywords}"`);

  log('2/7', `Scraping Reddit for: "${topicData.keywords}"...`);
  let humanExamples = [];
  try {
    const scraped = await gatherHumanExamples(topicData.keywords, inputText);
    humanExamples = scraped.human || [];
    log('2/7', `Found ${humanExamples.length} real human examples`);
  } catch (e) {
    log('2/7', `Scraping failed (${e.message}) — continuing`);
  }

  log('3/7', 'Rewriting using human sentence structure...');
  let result = await rewriteHuman(apiKey, inputText, humanExamples, strength, styleProfile);
  let scores = scoreText(result);
  let currentWC = wc(result);
  log('3/7', `After rewrite: ${currentWC} words (target: ${originalWordCount}) | burstiness=${scores.burst} | banned=${scores.banned.length} | ai-openers=${scores.aiOpeners.length}`);

  log('4/7', 'Splicing real human sentences...');
  result = await spliceHumanSentences(apiKey, result, humanExamples, originalWordCount);
  scores = scoreText(result);
  currentWC = wc(result);
  log('4/7', `After splice: ${currentWC} words | burstiness=${scores.burst} | banned=${scores.banned.length}`);

  log('5/7', 'Scrubbing remaining AI patterns...');
  result = await surgicalScrub(apiKey, result, humanExamples, originalWordCount);
  scores = scoreText(result);
  currentWC = wc(result);
  log('5/7', `After scrub: ${currentWC} words | burstiness=${scores.burst} | banned=${scores.banned.length} | ai-openers=${scores.aiOpeners.length}`);

  log('6/7', 'Verification pass...');
  result = await verifyAndFix(apiKey, result, inputText, humanExamples);
  scores = scoreText(result);
  currentWC = wc(result);
  log('6/7', `After verify: ${currentWC} words | burstiness=${scores.burst} | banned=${scores.banned.length}`);

  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  currentWC = wc(result);

  if (currentWC < min || currentWC > max) {
    log('7/7', `Word count fixing (${currentWC} → target ${originalWordCount})...`);
    result = await enforceWordCount(apiKey, result, originalWordCount);
    log('7/7', `Final: ${wc(result)} words`);
  } else {
    log('7/7', `Word count OK: ${currentWC}`);
  }

  scores = scoreText(result);

  return {
    text: result,
    scores: {
      burstiness: scores.burst,
      bannedWordsFound: scores.banned,
      aiOpenersFound: scores.aiOpeners.length,
      fragments: scores.frags,
      examplesUsed: humanExamples.length,
      originalWordCount,
      outputWordCount: wc(result),
      wordCountDelta: Math.round((wc(result) - originalWordCount) / originalWordCount * 100) + '%',
      humanExampleSources: [...new Set(humanExamples.map(e => e.source))].slice(0, 8)
    }
  };
}
