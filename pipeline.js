// ═══════════════════════════════════════════════════════════════════
//  pipeline.js — multi-pass humanization using Mistral AI
//  Rebuilt around real human writing patterns from dataset analysis.
//
//  Pass 1: extract topic + keywords
//  Pass 2: scrape Reddit for real human examples
//  Pass 3: rewrite in human voice
//  Pass 4: splice real human sentences
//  Pass 5: scrub remaining AI patterns
//  Pass 6: verify
//  Pass 7: word count fix
// ═══════════════════════════════════════════════════════════════════

import fetch from 'node-fetch';
import { gatherHumanExamples } from './scraper.js';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

const EXAMPLE_COUNT_REWRITE  = 10;
const EXAMPLE_COUNT_SPLICE   = 20;
const EXAMPLE_COUNT_SCRUB    = 5;
const EXAMPLE_COUNT_VERIFY   = 4;
const EXAMPLE_MAX_CHARS      = 400;
const EXAMPLE_MAX_CHARS_FAST = 200;

// ─── The real dataset: Aiden's actual writing vs AI writing ──────────────────
// This is used in every prompt so the model can see exactly what to aim for
// and exactly what to avoid. Not averaged — all examples kept so the model
// sees the full range of Aiden's voice including his quirks and variety.

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

const AI_EXAMPLES = [
  {
    label: "ChatGPT (AI1) — avoid this style",
    sample: `Artificial intelligence is basically compressing time and lowering barriers. That's the core shift. In finance especially, where speed, information, and risk modeling decide who wins, AI lets small teams compete with institutions that used to need hundreds of analysts and massive infrastructure. First, analysis is getting automated at scale. Startups can now process earnings calls, SEC filings, alternative data, satellite imagery, transaction flows, and macro signals in real time using machine learning. Second, prediction quality is becoming the edge. Third, personalization is becoming scalable.`
  },
  {
    label: "Claude (AI2) — avoid this style",
    sample: `AI is reshaping startup competition in financial services in some pretty fundamental ways. Here's what's driving the shift: Leveling the playing field on data — Traditionally, incumbents had a massive moat in the form of decades of customer transaction data. AI lets startups extract far more signals from smaller datasets, and alternative data sources give challengers fresh angles that legacy banks can't easily replicate. The honest caveat is that AI also introduces new risks — model bias in lending, explainability challenges for regulators, and systemic fragility if many institutions rely on similar underlying models.`
  }
];

// ─── What makes Aiden's writing different from AI writing ────────────────────
// This analysis is included in every prompt so the model understands the WHY
// behind the patterns, not just the surface features.

const STYLE_ANALYSIS = `
━━━ ANALYSIS: WHAT SEPARATES AIDEN'S WRITING FROM AI WRITING ━━━

AIDEN'S CORE PATTERNS (what you must replicate):

1. TAKES A CLEAR SIDE IMMEDIATELY
   Aiden opens with his conclusion. He doesn't build to it.
   "Yes, technological dominance does equal political dominance."
   "No, the government should definitely not regulate advanced AI models the way they regulate nuclear technology."
   AI writing delays the conclusion, maps perspectives first, then hedges. Aiden never hedges.

2. SHORT, DECLARATIVE SENTENCES
   Aiden writes in short punchy sentences. Period. Move on.
   "Whoever leads in AI will gain global superpower status."
   "AI won't just create more jobs than it replaces, AI will make the jobs better."
   AI writing uses long compound sentences with semicolons, em dashes, and nested clauses.

3. REPEATS KEY PHRASES ON PURPOSE
   Aiden hammers a point by repeating the exact phrase.
   "technological dominance... political dominance... technological dominance... political dominance"
   "Whoever is leading... Whoever has what everyone needs... Whoever leads..."
   AI writing varies vocabulary to avoid repetition. Aiden repeats to emphasize.

4. GROUNDS IN CONCRETE REAL-WORLD EXAMPLES
   Aiden always reaches for a specific, real thing.
   "homeless veterans on the street" / "MacBook minis and clawdbots" / "Donald Trump got elected"
   AI writing uses vague abstractions: "legacy institutions", "historical precedent", "incumbent players"

5. PERSONAL AND DIRECT — USES "I" AND "WE"
   "When I start my startup I will have my own personal clawdbot"
   "we regulated it to death" / "we have homeless veterans on the street"
   AI writing is impersonal. It says "one might argue" or "it could be said."

6. NO LISTS, NO NUMBERED POINTS, NO BULLET STRUCTURE
   Aiden writes in paragraphs. No "First... Second... Third..."
   No bullet points. No headers. Just connected prose.
   AI writing constantly breaks into lists and structured sections.

7. CONFIDENT, NOT CAREFUL
   Aiden states things as facts, not possibilities.
   "AI will determine global superpower status." (Not "AI will likely play a major role in...")
   AI writing hedges everything: "probably", "arguably", "it could be the case that"

8. CASUAL VOCABULARY, NOT ACADEMIC
   "regulated it to death" / "way behind" / "cost a lot of money"
   Never: "nuanced", "incumbent", "leverage", "multifaceted", "paradigm", "trajectory"

9. LOGIC BY ANALOGY AND COMMON SENSE
   Aiden makes his argument feel obvious by analogy.
   "America First just follows the premise of, why are other people getting help when I am struggling."
   "When the computer came out everyone thought people would lose their jobs, but it just shifted their jobs."
   AI writing cites frameworks, research, and institutional examples.

10. ENDS WITH A STRONG RESTATEMENT
    Aiden closes by restating his main point, not summarizing or nuancing.
    "The US should focus on domestic strength before it goes on focusing on foreign intervention."
    "Building out technological dominance will give us political dominance too."
    AI writing ends with balance: "So the answer depends on..." or "The truth lies somewhere in the middle."

━━━ WHAT AI WRITING DOES THAT AIDEN NEVER DOES ━━━
• Maps multiple perspectives instead of taking one side
• Uses "The honest caveat is..." or "The nuance here is..."
• Numbered lists (First... Second... Third...)
• Bullet points or headers
• Long sentences with semicolons and em dashes
• Academic hedging: "arguably", "it could be said", "one might argue"
• Ends by acknowledging the other side has valid points
• Uses: furthermore, moreover, notably, pivotal, nuanced, leverage, incumbent, trajectory, paradigm

━━━ IMPORTANT: DO NOT AVERAGE AIDEN'S RESPONSES ━━━
Each of Aiden's answers has its own rhythm and quirks.
Sometimes he repeats a phrase 4 times in a row. Sometimes he uses "Think about it,".
Sometimes he builds an analogy that goes on longer than expected.
Sometimes his sentences are very clipped. Sometimes one runs longer.
Do not smooth these out into one "average" Aiden voice.
Capture the full range including the quirks.
`;

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
  'incumbent','trajectory','paradigm','framework','landscape','ecosystem'
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
  /^(First|Second|Third|Fourth|Fifth),?\s/i,
  /^(Here'?s? (what|why|the|how))/i,
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
      temperature: Math.min(temp, 1.0),
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

// ─── Hard trim guard ─────────────────────────────────────────────────────────
async function hardTrim(apiKey, text, targetWC) {
  const current = wc(text);
  const max = Math.ceil(targetWC * 1.15);
  if (current <= max) return text;

  console.log(`  → Hard trim: ${current} words → targeting ~${targetWC}`);
  const system = `Trim this text to approximately ${targetWC} words (currently ${current} words).
Remove repeated ideas, filler, redundant clauses. Do NOT remove any unique ideas.
Output ONLY the trimmed text.`;
  return await mistral(apiKey, system, text, 0.3, targetWC * 3);
}

// ─── Build the full style block with examples for any prompt ─────────────────
function buildAidenStyleBlock(redditExamples = [], maxReddit = 0, maxChars = 300) {
  const aidenBlock = AIDEN_EXAMPLES.map((e, i) =>
    `[AIDEN EXAMPLE ${i + 1} — "${e.question}"]\n${e.answer}`
  ).join('\n\n');

  const aiBlock = AI_EXAMPLES.map(e =>
    `[${e.label}]\n${e.sample}`
  ).join('\n\n');

  const redditBlock = redditExamples.length > 0
    ? `\n━━━ ADDITIONAL REAL HUMAN WRITING FROM REDDIT (on this specific topic) ━━━\n` +
      pickExamples(redditExamples, maxReddit, maxChars)
        .map((e, i) => `[REDDIT EXAMPLE ${i + 1} — ${e.source}]\n"${e.text}"`)
        .join('\n\n')
    : '';

  return `${STYLE_ANALYSIS}

━━━ AIDEN'S ACTUAL WRITING — LEARN FROM ALL OF THESE ━━━
Study every single example. Notice the variety between them. Do not average them.
Each one has its own rhythm, length, and quirks. That variety IS the human voice.

${aidenBlock}

━━━ AI WRITING — THIS IS WHAT YOU MUST NOT SOUND LIKE ━━━
${aiBlock}
${redditBlock}`;
}

// ─── PASS 1: Extract topic and keywords ──────────────────────────────────────
async function extractTopic(apiKey, text) {
  const system = `Extract the core topic and a SHORT search phrase from this text.
Return JSON only:
{"topic":"short topic name","keywords":"3 to 5 words for Reddit search","genre":"essay|argument|analysis|personal|technical"}
Keywords must be 3-5 words total. One short phrase. No lists.
No other text.`;
  const raw = await mistral(apiKey, system, text.slice(0, 600), 0.1, 200);
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

// ─── PASS 2 (done outside): Reddit scraping ──────────────────────────────────
// (handled in main pipeline below)

// ─── PASS 3: Rewrite in human voice ──────────────────────────────────────────
async function rewriteHuman(apiKey, inputText, humanExamples, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);

  const styleBlock = buildAidenStyleBlock(humanExamples, EXAMPLE_COUNT_REWRITE, EXAMPLE_MAX_CHARS);
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const temps = { aggressive: 0.95, standard: 0.85, subtle: 0.72 };

  const system = `You are rewriting text to sound like it was written by a real human — specifically matching the voice in the AIDEN examples above, not the AI examples.

${styleBlock}
${userStyleBlock}

━━━ REWRITING RULES ━━━

WORD COUNT — NON-NEGOTIABLE:
Input is ${wordTarget} words. Output MUST be ${minWords}–${maxWords} words.
Do not add ideas, examples, or elaborations not in the original.
One idea in = one idea out.

MEANING: Keep 100% of the original meaning and arguments.

HOW TO WRITE LIKE AIDEN, NOT LIKE AI:

DO:
• Open with the conclusion or main point — don't build to it
• Write short, confident, declarative sentences
• Use "I" and "we" naturally
• Repeat key phrases when emphasizing a point
• Ground claims in specific real things, not vague abstractions
• Use casual vocabulary — words a real person would say out loud
• Write in connected paragraphs, not lists
• State things as facts, not possibilities
• End by restating your main point, not hedging or summarizing

DO NOT:
• Use numbered structure (First... Second... Third...)
• Use bullet points or headers
• Hedge with "arguably", "it could be said", "one might argue"
• Map multiple perspectives — pick one and defend it
• Use: furthermore, moreover, notably, nuanced, leverage, paradigm, incumbent, trajectory, ecosystem, robust, seamlessly, pivotal, crucial, multifaceted, comprehensive
• End by acknowledging the other side has valid points
• Write long compound sentences with semicolons
• Use "Here's what's driving the shift:" or "Here's the nuance:" type setups
• Use em dashes for theatrical effect

BANNED WORDS — NEVER USE:
${BANNED.join(', ')}

OUTPUT: Return ONLY the rewritten text. Nothing before or after.`;

  const result = await mistral(apiKey, system, `Rewrite this text now:\n\n${inputText}`, temps[strength], 3000);
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

Real human sentences:
${selected.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Rules:
1. Find the 3 smoothest, most formulaic, most AI-sounding sentences
2. Replace each with a sentence from the list that fits the same context
3. Lightly adapt if needed (change a noun, adjust tense) — keep 75%+ of the wording
4. Do not change any other sentences
5. Keep output between ${minWords} and ${maxWords} words — if a replacement is longer, shorten something nearby

Output ONLY the edited text.`;

  const result = await mistral(apiKey, system, `Edit this text:\n\n${text}`, 0.45, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 5: Scrub remaining AI patterns ─────────────────────────────────────
async function surgicalScrub(apiKey, text, humanExamples, originalWordCount) {
  const { burst, banned, aiOpeners } = scoreText(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const problems = [];
  if (banned.length > 0) problems.push(`BANNED WORDS — replace each with a casual natural alternative: ${banned.join(', ')}`);
  if (aiOpeners.length > 0) problems.push(`AI OPENERS — rewrite these sentence openings:\n${aiOpeners.slice(0, 4).map(s => `  • "${s.trim()}"`).join('\n')}`);

  const examples = pickExamples(humanExamples, EXAMPLE_COUNT_SCRUB, EXAMPLE_MAX_CHARS_FAST);
  const redditReminder = examples.length > 0
    ? `\nReal human writing on this topic for reference:\n${examples.map((e, i) => `[${i + 1}] "${e.text}"`).join('\n')}`
    : '';

  const system = `Fix specific AI patterns in this text. Every change is a swap — replace content, never add.

⚠️ WORD COUNT: Text is ${wc(text)} words. Must stay ${minWords}–${maxWords} words.

PROBLEMS TO FIX:
${problems.length > 0 ? problems.join('\n') : 'No critical problems — apply improvements below.'}

ALWAYS DO (swap only):
1. Find 3 sentences where the word choice is too polished or academic — replace those words with casual natural alternatives
2. Find 2 sentences that sound like an AI explaining something — rewrite them to sound like a person stating something
3. If any sentence maps "multiple perspectives" or hedges with "it depends" — rewrite it to take a clear side instead
4. Remove any sentence that exists just to acknowledge the other side has valid points
5. If there are any lists or numbered points — convert them to regular prose${redditReminder}

Output ONLY the fixed text.`;

  const result = await mistral(apiKey, system, `Fix this text:\n\n${text}`, 0.68, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 6: Verify ───────────────────────────────────────────────────────────
async function verifyAndFix(apiKey, text, originalText, humanExamples) {
  const { banned, aiOpeners } = scoreText(text);
  const originalWordCount = wc(originalText);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const styleBlock = buildAidenStyleBlock(humanExamples, EXAMPLE_COUNT_VERIFY, EXAMPLE_MAX_CHARS_FAST);

  const system = `You are checking whether this text sounds like Aiden or like an AI. Fix anything that still sounds like AI.

${styleBlock}

⚠️ WORD COUNT: ${wc(text)} words. Must stay ${minWords}–${maxWords}. Swap, never add.

CHECKLIST — fix anything that fails:
1. Does it open with a clear position? If not — rewrite the opening to lead with the conclusion.
2. Are there any long sentences with semicolons or nested clauses? Break them up.
3. Does it hedge or say "it depends"? Remove it — take a side.
4. Does it have numbered structure or bullet points? Convert to prose.
5. Does it end by acknowledging the other side? Cut that — end by restating the main point.
6. Are there any banned words left? ${banned.length > 0 ? banned.join(', ') : 'Check anyway.'}
7. Any AI openers? ${aiOpeners.length > 0 ? aiOpeners.slice(0,3).map(s=>s.trim()).join(' | ') : 'Check anyway.'}
8. Does it sound like a person talking, or like a report being written? If report — rewrite toward conversation.

Output ONLY the corrected text.`;

  const result = await mistral(apiKey, system, `Check and fix this text:\n\n${text}`, 0.72, 3000);
  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── PASS 7: Word count fix ───────────────────────────────────────────────────
async function enforceWordCount(apiKey, text, originalWordCount) {
  const currentWC = wc(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  if (currentWC >= minWords && currentWC <= maxWords) return text;

  if (currentWC > maxWords) {
    const system = `Trim this text from ${currentWC} words to between ${minWords} and ${maxWords} words.
Remove filler, shorten long sentences, cut repeated ideas. Do NOT cut any unique arguments.
Output ONLY the trimmed text.`;
    return await mistral(apiKey, system, text, 0.3, maxWords * 3);
  } else {
    const system = `Expand this text from ${currentWC} words to between ${minWords} and ${maxWords} words.
Add a concrete detail or short example to 1-2 existing points. Do NOT add new arguments.
Output ONLY the expanded text.`;
    return await mistral(apiKey, system, text, 0.5, maxWords * 3);
  }
}

// ─── Answer as Aiden (for the Answer tab) ────────────────────────────────────
export async function answerAsAiden(apiKey, question, styleProfile, onProgress) {
  const log = (step, msg) => {
    console.log(`  [${step}] ${msg}`);
    if (onProgress) onProgress({ step, msg });
  };

  log('1/3', 'Writing answer...');

  // Step 1: Pick the most similar Aiden example to use as a structural template
  // This forces the model to copy sentence structure, not just themes
  const templateExample = AIDEN_EXAMPLES[Math.floor(Math.random() * AIDEN_EXAMPLES.length)];

  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  // Show ALL of Aiden's answers plus BOTH AI answers so the model clearly
  // sees the contrast — especially the structural difference, not just vocabulary
  const allAidenAnswers = AIDEN_EXAMPLES.map((e, i) =>
    `[AIDEN ANSWER ${i + 1} — Question: "${e.question}"]\n${e.answer}`
  ).join('\n\n');

  const allAIAnswers = AI_EXAMPLES.map(e =>
    `[${e.label}]\n${e.sample}`
  ).join('\n\n');

  const system = `You are writing an answer to a question. Your answer must be written exactly like Aiden writes — not like an AI.

━━━ AIDEN'S ACTUAL ANSWERS — READ EVERY WORD ━━━
These are real answers written by a real person named Aiden. This is who you are writing as.

${allAidenAnswers}

━━━ AI WRITING — DO NOT WRITE LIKE THIS ━━━
These are AI answers. They are the opposite of what you should produce.

${allAIAnswers}

━━━ WHAT YOU MUST COPY FROM AIDEN ━━━

Look at how Aiden's sentences are literally built. Copy this:

SENTENCE 1 of any Aiden answer: States the conclusion directly. Short. "[Yes/No], [restate the question as a fact]."
Example: "Yes, the US should first focus on domestic strength more than foreign intervention."
Example: "AI will determine global superpower status."
Example: "No, the government should definitely not regulate advanced AI models the way they regulate nuclear technology."

THEN: He explains WHY in 1-2 short sentences. Plain. Direct. No hedging.
THEN: He gives a real-world comparison or historical example. Something specific, not abstract.
THEN: He applies that example to the current question in 1-2 sentences.
THEN: He ends by restating his opening point in slightly different words.

WHAT HE NEVER DOES:
- Never writes a sentence longer than ~20 words
- Never uses "however", "moreover", "furthermore", "it could be argued"
- Never acknowledges the other side has a point
- Never uses bullet points or numbered lists
- Never uses "nuanced", "complex", "multifaceted", "leverage", "incumbent"
- Never ends with "it depends" or "the answer is complicated"
- Never writes more than 4-5 sentences per paragraph

TEMPLATE TO FOLLOW — use this exact structure:
Based on: "${templateExample.question}"
Aiden wrote: "${templateExample.answer}"

Your answer should follow the SAME structural rhythm as that answer.
Not the same words. The same rhythm, sentence length pattern, and argumentative flow.

${userStyleBlock}

━━━ LENGTH ━━━
80-150 words. Aiden is punchy. He says what he means and stops.

OUTPUT: Return ONLY the answer. No preamble, no explanation, nothing else.`;

  const draft = await mistral(apiKey, system, `Answer this question as Aiden:\n\n"${question}"`, 0.92, 800);

  log('2/3', 'Checking against Aiden\'s voice...');

  // Step 2: Show the draft back to the model alongside Aiden's most similar answer
  // and ask it to identify anything that still sounds AI and fix it
  const checkSystem = `You are comparing a draft answer against real human writing and fixing anything that still sounds AI.

AIDEN'S REAL ANSWER ON A SIMILAR TOPIC:
"${templateExample.answer}"

THE DRAFT:
"${draft}"

WHAT TO CHECK:
1. Does the draft open with a direct conclusion like Aiden does? If not — rewrite the opening.
2. Are there any sentences over 20 words? Break them up.
3. Does it hedge or say "it depends" anywhere? Remove it — pick a side.
4. Does it use any of these words: furthermore, moreover, however, nuanced, leverage, complex, multifaceted, arguably, incumbent? Replace them.
5. Does it end by restating the main point? If it ends with a caveat or balance — replace the ending.
6. Does it sound like a person talking or like a report? If report — rewrite toward how a person actually speaks.
7. Does it use "I" naturally, like Aiden does? If not — add it where natural.

Make only necessary fixes. Keep the content and argument.
Output ONLY the corrected answer.`;

  let final = await mistral(apiKey, checkSystem, draft, 0.5, 800);

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

// ─── User style block builder ─────────────────────────────────────────────────
function buildUserStyleBlock(profile) {
  if (!profile) return '';
  const rules = [];
  const s = (profile.summary || '').toLowerCase();
  if (s.includes('rarely or never use contractions')) rules.push('Avoid contractions');
  else if (s.includes('always use contractions')) rules.push("Use contractions freely");
  if (s.includes('very casual')) rules.push('Very casual tone');
  if (s.includes('formal')) rules.push('More formal tone');
  if (profile.examples?.length) {
    return `\n━━ ADDITIONAL STYLE FROM THIS USER'S OWN WRITING ━━\n${profile.examples.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n${rules.length ? rules.map(r => `• ${r}`).join('\n') : ''}`;
  }
  return rules.length ? `\n━━ STYLE NOTES ━━\n${rules.map(r => `• ${r}`).join('\n')}` : '';
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

  log('3/7', 'Rewriting in human voice...');
  let result = await rewriteHuman(apiKey, inputText, humanExamples, strength, styleProfile);
  let scores = scoreText(result);
  let currentWC = wc(result);
  log('3/7', `After rewrite: ${currentWC} words | burstiness=${scores.burst} | banned=${scores.banned.length} | ai-openers=${scores.aiOpeners.length}`);

  log('4/7', 'Splicing real human sentences...');
  result = await spliceHumanSentences(apiKey, result, humanExamples, originalWordCount);
  scores = scoreText(result);
  currentWC = wc(result);
  log('4/7', `After splice: ${currentWC} words | burstiness=${scores.burst}`);

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

  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  currentWC = wc(result);

  if (currentWC < minWords || currentWC > maxWords) {
    log('7/7', `Word count fixing (${currentWC} → target ${originalWordCount})...`);
    result = await enforceWordCount(apiKey, result, originalWordCount);
    currentWC = wc(result);
    log('7/7', `Final: ${currentWC} words`);
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
