// pipeline.js — Humanizer pipeline
// Core problem: AI writes dramatically and journalistically.
// Humans write plainly and personally.
// The fix: every pass enforces plain personal writing, not dramatic writing.

import fetch from 'node-fetch';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

// Aiden's real answers — the gold standard for what we want to produce
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

// This is a REAL example of 86% human output on a finance/AI topic.
// The pipeline produced this on an earlier run. Study it carefully —
// this is exactly the style we need to produce every time.
const PROVEN_HUMAN_EXAMPLE = {
  input: `Finance, startups, and AI are kind of colliding right now in a way that feels real, not just hype. In finance, AI helps with things like predicting markets, spotting fraud, managing risk, and analyzing huge amounts of data way faster than any human could. But honestly, the bigger story is how startups are using AI to build smarter financial tools from scratch. A small team can now create a trading model, a budgeting app, or a risk engine that used to require a giant bank with hundreds of employees. That changes everything. It means speed and creativity matter more than size.`,
  output: `Finance, startups, and AI are all coming together right now. In finance, AI can help predict markets and analyze lots of data a lot faster than any human ever could. Even more, startups are using AI to build financial tools all by themselves. Someone can now just create a trading model, or a budgeting app, or a risk engine that used to require a giant bank that used to take hundreds of people. That changes everything and now speed and creativity from one person mean so much more than hundreds of people used to. Although, AI does not do this on its own. It still needs the human to push it and manage it. When someone with real financial knowledge gets a hold of these new AI tools. They can be unstoppable, stronger than hundreds of employees just a few months ago. This is not about getting rid of people, but about giving ambitious startup founders the ability to build.`,
  gptzero_score: "86% human"
};

const AI_EXAMPLES = [
  {
    label: "ChatGPT — 100% AI detected",
    sample: `Artificial intelligence is basically compressing time and lowering barriers. That's the core shift. In finance especially, where speed, information, and risk modeling decide who wins, AI lets small teams compete with institutions that used to need hundreds of analysts and massive infrastructure. First, analysis is getting automated at scale. Second, prediction quality is becoming the edge. Third, personalization is becoming scalable.`
  },
  {
    label: "Over-humanized AI — ALSO 100% AI detected (dramatic journalist style)",
    sample: `Not long ago, only hedge funds with armies of quants and access to supercomputers like IBM's Watson could move markets with precision. Now? Numerai's crowd-sourced models, built by data scientists from over 100 countries, leave them in the dust—AI in finance isn't just a buzzword; it actually works. It calls the shots on trades, flags fraudulent transactions in milliseconds, and hedges risk before the coffee in your mug even gets cold.`
  }
];

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
  /^(First|Second|Third|Fourth|Fifth),?\s/i,
  /^(Here'?s? (what|why|the|how))/i,
  /^(It is (clear|evident|apparent) that)\s/i,
];

// ─── Mistral ──────────────────────────────────────────────────────────────────
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
  if (!res.ok) throw new Error(`Mistral API error: ${data.message || data.error?.message || JSON.stringify(data).slice(0,200)}`);
  if (!data.choices?.[0]) throw new Error(`Unexpected response: ${JSON.stringify(data).slice(0,200)}`);
  return data.choices[0].message.content.trim();
}

// ─── HuggingFace loader ───────────────────────────────────────────────────────
let cachedHFSentences = null;
async function loadHFSentences() {
  if (cachedHFSentences) return cachedHFSentences;
  try {
    const offset = Math.floor(Math.random() * 7000);
    const url = `https://datasets-server.huggingface.co/rows?dataset=gsingh1-py%2Ftrain&config=default&split=train&offset=${offset}&length=80`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HF ${res.status}`);
    const data = await res.json();
    const sentences = (data.rows || [])
      .map(r => r.row?.Human_story || '')
      .filter(s => s.length > 50)
      .flatMap(story => (story.match(/[^.!?]+[.!?]+/g) || []))
      .map(s => s.trim())
      .filter(s => {
        const w = s.split(/\s+/).length;
        return w >= 5 && w <= 18; // SHORT sentences only
      })
      .filter(s => !BANNED.some(b => s.toLowerCase().includes(b)) && !AI_OPENERS.some(p => p.test(s)));
    cachedHFSentences = sentences;
    console.log(`  → Loaded ${sentences.length} human sentences from HuggingFace`);
    return sentences;
  } catch (e) {
    console.log(`  → HF failed: ${e.message}`);
    return [];
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
const wc = t => t?.trim() ? t.trim().split(/\s+/).length : 0;
const getSentences = t => (t.match(/[^.!?]+[.!?]+/g) || [t]).map(s => s.trim()).filter(Boolean);
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);

function calcBurstiness(text) {
  const lens = getSentences(text).map(s => s.split(/\s+/).length).filter(l => l > 0);
  if (lens.length < 2) return 0;
  const avg = lens.reduce((a,b) => a+b, 0) / lens.length;
  const variance = lens.reduce((a,b) => a + Math.pow(b-avg, 2), 0) / lens.length;
  return parseFloat((Math.sqrt(variance) / avg).toFixed(3));
}

const countBannedWords = text => BANNED.filter(w => text.toLowerCase().includes(w.toLowerCase()));
const countAIOpeners = text => getSentences(text).filter(s => AI_OPENERS.some(p => p.test(s)));
const countFragments = text => getSentences(text).filter(s => s.split(/\s+/).length <= 6).length;
const scoreText = text => ({ burst: calcBurstiness(text), banned: countBannedWords(text), aiOpeners: countAIOpeners(text), frags: countFragments(text) });

function sentenceBreakdown(text) {
  return getSentences(text).map((s,i) => `  S${i+1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n');
}

function detectInputType(text) {
  const lower = text.toLowerCase();
  const analysisScore = (lower.match(/\b(research|study|studies|data|evidence|according|analysis|found|shows|results|percent|million|billion|report|survey)\b/g) || []).length;
  const opinionScore = (lower.match(/\b(should|must|I |we |our |believe|think|wrong|right|bad|good)\b/g) || []).length;
  return analysisScore > opinionScore + 2 ? 'analysis' : 'opinion';
}

function findClosestAidenExample(question) {
  const q = question.toLowerCase();
  const qWords = q.split(/\s+/).filter(w => w.length > 3);
  const scored = AIDEN_EXAMPLES.map((ex, i) => {
    const exWords = ex.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return { i, score: qWords.filter(w => exWords.includes(w)).length * 2 + qWords.filter(w => exWords.some(ew => ew.includes(w) || w.includes(ew))).length };
  });
  scored.sort((a,b) => b.score !== a.score ? b.score - a.score : [4,1,2,3,0,5].indexOf(a.i) - [4,1,2,3,0,5].indexOf(b.i));
  return AIDEN_EXAMPLES[scored[0].i];
}

function findClosestByLength(inputText) {
  const n = getSentences(inputText).length;
  return AIDEN_EXAMPLES.reduce((best, ex) =>
    Math.abs(getSentences(ex.answer).length - n) < Math.abs(getSentences(best.answer).length - n) ? ex : best
  );
}

async function hardTrim(apiKey, text, targetWC) {
  if (!text?.trim()) throw new Error('Empty text in hardTrim');
  const current = wc(text);
  if (current <= Math.ceil(targetWC * 1.12)) return text;
  return await mistral(apiKey,
    `Trim from ${current} to ~${targetWC} words. Remove filler sentences. Keep all arguments. Output ONLY the trimmed text.`,
    text, 0.3, targetWC * 3);
}

function buildUserStyleBlock(profile) {
  if (!profile) return '';
  const rules = [];
  const s = (profile.summary || '').toLowerCase();
  if (s.includes('rarely or never use contractions')) rules.push('Avoid contractions');
  else if (s.includes('always use contractions')) rules.push('Use contractions freely');
  if (profile.examples?.length) return `\n━━ USER'S OWN WRITING ━━\n${profile.examples.map((s,i) => `${i+1}. ${s}`).join('\n')}\n${rules.map(r=>`• ${r}`).join('\n')}`;
  return rules.length ? `\n━━ STYLE NOTES ━━\n${rules.map(r=>`• ${r}`).join('\n')}` : '';
}

// ═══════════════════════════════════════════════════════════════════
//  THE CORE REWRITE SYSTEM PROMPT
//  This is the most important prompt. Every word matters.
// ═══════════════════════════════════════════════════════════════════
function buildCoreSystemPrompt(allAidenText, wordTarget, minWords, maxWords, extraGuidance, userStyleBlock) {
  return `You are rewriting text to pass AI detection. Your output must look like it was typed by a real student, not generated by AI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROOF THAT THIS APPROACH WORKS — 86% HUMAN ON GPTZERO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This INPUT (AI-written) → this OUTPUT (86% human) is a REAL result.
Study it. Your output must look like this OUTPUT, not the INPUT.

INPUT (AI):
"${PROVEN_HUMAN_EXAMPLE.input}"

OUTPUT that scored 86% HUMAN:
"${PROVEN_HUMAN_EXAMPLE.output}"

WHY THE OUTPUT PASSES:
• Short plain sentences: "Finance, startups, and AI are all coming together right now."
• Casual filler: "lots of", "a lot faster", "all by themselves", "just", "even more"
• Slight imperfection: "a giant bank that used to take hundreds of people" (slightly off grammar)
• Repetition for emphasis: "stronger than hundreds of employees just a few months ago"
• Personal framing: "Although, AI does not do this on its own. It still needs the human."
• No em dashes, no colon lists, no dramatic phrases, no "the real play is..."

WHY AI WRITING FAILS EVEN WHEN "HUMANIZED":
"Not long ago, only hedge funds with armies of quants and access to supercomputers like IBM's Watson could move markets with precision. Now? Numerai's crowd-sourced models...leave them in the dust—AI in finance isn't just a buzzword; it actually works. It calls the shots on trades, flags fraudulent transactions in milliseconds, and hedges risk before the coffee in your mug even gets cold."
THIS IS 100% AI DETECTED. Why? Long complex sentences. Dramatic phrases. Em dashes. Journalist-style colons. "The coffee in your mug" = AI trying too hard.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MORE REAL HUMAN EXAMPLES TO COPY THE VOICE FROM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${allAidenText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES — BREAKING ANY OF THESE = AI DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULE 1 — NO LONG SENTENCES
Every sentence must be under 18 words. Count them. If a sentence has 19+ words, split it.

RULE 2 — NO EM DASHES
Never use —. Not once. Not for any reason.

RULE 3 — NO COLON LISTS
Never use : to introduce a list. "trading bots that...budgeting apps that...risk engines that..." = AI.

RULE 4 — NO DRAMATIC PHRASES
No "the real play is", no "hedges risk before the coffee gets cold", no "leave them in the dust",
no "it actually works", no "Now?", no rhetorical one-word sentences.

RULE 5 — NO JOURNALISTIC STYLE
Do not write like a magazine article or news story. Write like a real person talking.

RULE 6 — USE PLAIN CASUAL WORDS
"lots of" not "numerous". "way faster" not "significantly faster". "can't" not "cannot".
"a lot" not "substantially". "used to" not "historically". "now" not "currently".

RULE 7 — WORD COUNT
Input: ${wordTarget} words. Output MUST be ${minWords}–${maxWords} words.

${extraGuidance}

${userStyleBlock}

OUTPUT: Return ONLY the rewritten text. Nothing else.`;
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 1: Analyze
// ═══════════════════════════════════════════════════════════════════
async function pass1_analyze(apiKey, text) {
  try {
    const raw = await mistral(apiKey,
      `Analyze this text. Return JSON only:
{"topic":"2-4 word topic","type":"opinion or analysis"}`,
      text.slice(0, 400), 0.1, 80);
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return { topic: 'general topic', type: detectInputType(text) };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 3: Core rewrite
// ═══════════════════════════════════════════════════════════════════
async function pass3_rewrite(apiKey, inputText, inputType, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);
  const temps = { aggressive: 0.92, standard: 0.82, subtle: 0.70 };

  const allAidenText = AIDEN_EXAMPLES.map((e,i) => `[HUMAN EXAMPLE ${i+1}]\n"${e.answer}"`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const extraGuidance = inputType === 'analysis'
    ? `EXTRA FOR ANALYSIS TEXT:
This text explains things. You need to reframe explanations as personal reactions.
"AI reduces barriers" → "Anyone can do this now. The barriers are gone."
"Studies show 40% gains" → "The productivity numbers are real. We're talking 40% gains."
Every sentence should sound like someone telling you something they find interesting.`
    : `EXTRA FOR OPINION TEXT:
Take a clear side. State it at the start. Repeat it at the end.
Use "I" and "we" naturally. Say what you actually think, directly.`;

  const systemPrompt = buildCoreSystemPrompt(allAidenText, wordTarget, minWords, maxWords, extraGuidance, userStyleBlock);

  const result = await mistral(apiKey, systemPrompt,
    `Rewrite this text following ALL rules above:\n\n${inputText}`,
    temps[strength], 3000);

  return await hardTrim(apiKey, result, wordTarget);
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 4: Spot-fix long sentences and dramatic phrases
// ═══════════════════════════════════════════════════════════════════
// This pass specifically hunts for the patterns that cause AI detection
// even after rewriting: long sentences, em dashes, dramatic phrases.
async function pass4_fixDramatic(apiKey, text, originalWordCount) {
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const sentences = getSentences(text);
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 17);
  const hasEmDash = text.includes('—');
  const dramaticPhrases = [
    'the real play', 'leave them in the dust', 'before the coffee',
    'gets cold', 'Now?', 'it actually works', 'the game has changed',
    'isn\'t just a', 'isn\'t just about', 'it\'s about giving',
    'outrun the big guys', 'levels the playing field', 'ruthless',
    'unprecedented scale', 'eerie precision', 'in the dust'
  ];
  const foundDramatic = dramaticPhrases.filter(p => text.toLowerCase().includes(p.toLowerCase()));

  const problems = [];
  if (longSentences.length > 0) problems.push(`LONG SENTENCES (over 17 words — split each into 2 shorter ones):\n${longSentences.map(s => `  • "${s}"`).join('\n')}`);
  if (hasEmDash) problems.push(`EM DASHES found — replace every — with a period or comma`);
  if (foundDramatic.length > 0) problems.push(`DRAMATIC PHRASES — replace with plain casual language:\n${foundDramatic.map(p => `  • "${p}"`).join('\n')}`);

  if (problems.length === 0) return text; // nothing to fix

  const result = await mistral(apiKey,
    `Fix ONLY the specific problems listed below. Do not change anything else.
Word count must stay ${minWords}–${maxWords} words (currently ${wc(text)}).

PROBLEMS TO FIX:
${problems.join('\n\n')}

HOW TO FIX:
• Long sentence: split into 2 short ones. Each under 15 words.
• Em dash: replace with period. Start new sentence.
• Dramatic phrase: replace with plain casual equivalent.
  "leave them in the dust" → "beat them"
  "eerie precision" → "really good accuracy"
  "unprecedented scale" → "a huge scale"
  "levels the playing field" → "lets anyone compete"

Output ONLY the fixed text.`,
    text, 0.45, 3000);

  return await hardTrim(apiKey, result, originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 5: Scrub banned words and AI openers
// ═══════════════════════════════════════════════════════════════════
async function pass5_scrub(apiKey, text, originalWordCount) {
  const { banned, aiOpeners } = scoreText(text);
  if (banned.length === 0 && aiOpeners.length === 0) return text;

  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const result = await mistral(apiKey,
    `Fix ONLY these specific problems. Do not change anything else.
Word count must stay ${minWords}–${maxWords} words.

${banned.length > 0 ? `BANNED WORDS — replace with plain casual words:\n${banned.map(w => `  • "${w}"`).join('\n')}` : ''}
${aiOpeners.length > 0 ? `AI SENTENCE OPENERS — rewrite these sentence openings:\n${aiOpeners.slice(0,4).map(s => `  • "${s.trim().slice(0,60)}..."`).join('\n')}` : ''}

Output ONLY the fixed text.`,
    text, 0.5, 3000);

  return await hardTrim(apiKey, result, originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 6: Final verification
// ═══════════════════════════════════════════════════════════════════
async function pass6_verify(apiKey, text, originalWordCount) {
  const { banned, aiOpeners, burst } = scoreText(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const allAidenText = AIDEN_EXAMPLES.slice(0,3).map((e,i) => `[HUMAN ${i+1}]\n"${e.answer}"`).join('\n\n');

  const result = await mistral(apiKey,
    `Final check before submission. Compare against these proven human examples and fix the last AI patterns.

REAL HUMAN EXAMPLES:
${allAidenText}

PROVEN HUMAN OUTPUT (86% score):
"${PROVEN_HUMAN_EXAMPLE.output}"

WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)}).

CHECK FOR:
1. Any sentence over 17 words — split it
2. Any em dash — replace with period
3. Any dramatic journalist phrase — replace with plain language
4. Any banned word still present: ${banned.length > 0 ? banned.join(', ') : 'none'}
5. Any AI opener: ${aiOpeners.length > 0 ? aiOpeners.slice(0,2).map(s=>s.trim().slice(0,40)).join(' | ') : 'none'}
6. Burstiness is ${burst}${burst < 0.35 ? ' — TOO UNIFORM. Add 2-3 very short sentences (4-6 words) to break the rhythm.' : ' — ok'}

Output ONLY the corrected text.`,
    text, 0.65, 3000);

  return await hardTrim(apiKey, result, originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 7: Word count
// ═══════════════════════════════════════════════════════════════════
async function pass7_wordCount(apiKey, text, originalWordCount) {
  const current = wc(text);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  if (current >= min && current <= max) return text;
  if (current > max) {
    return await mistral(apiKey, `Trim from ${current} to between ${min} and ${max} words. Cut whole sentences that are least essential. Keep all main arguments. Output ONLY the result.`, text, 0.3, max * 3);
  } else {
    return await mistral(apiKey, `Expand from ${current} to between ${min} and ${max} words. Add one short plain sentence to an existing point. Output ONLY the result.`, text, 0.5, max * 3);
  }
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

  log('1/7', `Analyzing input... (${originalWordCount} words)`);
  let analysis;
  try {
    analysis = await pass1_analyze(apiKey, inputText);
    log('1/7', `Topic: "${analysis.topic}" | Type: ${analysis.type}`);
  } catch (e) {
    log('1/7', `Analysis failed — using defaults`);
    analysis = { topic: 'general', type: detectInputType(inputText) };
  }

  log('2/7', 'Loading human writing examples...');
  let hfSentences = [];
  try {
    hfSentences = await loadHFSentences();
    log('2/7', `Loaded ${hfSentences.length} human sentences`);
  } catch (e) {
    log('2/7', `HF load failed — continuing`);
  }

  log('3/7', `Rewriting in plain personal style (${analysis.type} mode)...`);
  let result;
  try {
    result = await pass3_rewrite(apiKey, inputText, analysis.type, strength || 'aggressive', styleProfile);
    const s = scoreText(result);
    log('3/7', `After rewrite: ${wc(result)} words | burst=${s.burst} | banned=${s.banned.length} | ai-openers=${s.aiOpeners.length}`);
  } catch (e) {
    throw new Error(`Pass 3 failed: ${e.message}`);
  }

  log('4/7', 'Fixing long sentences and dramatic phrases...');
  try {
    result = await pass4_fixDramatic(apiKey, result, originalWordCount);
    const s = scoreText(result);
    log('4/7', `After fix: ${wc(result)} words | burst=${s.burst}`);
  } catch (e) {
    log('4/7', `Fix failed (${e.message}) — continuing`);
  }

  log('5/7', 'Scrubbing banned words and AI openers...');
  try {
    result = await pass5_scrub(apiKey, result, originalWordCount);
    const s = scoreText(result);
    log('5/7', `After scrub: ${wc(result)} words | banned=${s.banned.length} | ai-openers=${s.aiOpeners.length}`);
  } catch (e) {
    log('5/7', `Scrub failed (${e.message}) — continuing`);
  }

  log('6/7', 'Verification pass...');
  try {
    result = await pass6_verify(apiKey, result, inputText);
    const s = scoreText(result);
    log('6/7', `After verify: ${wc(result)} words | burst=${s.burst} | banned=${s.banned.length}`);
  } catch (e) {
    log('6/7', `Verify failed (${e.message}) — continuing`);
  }

  const currentWC = wc(result);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  if (currentWC < min || currentWC > max) {
    log('7/7', `Word count fix (${currentWC} → target ${originalWordCount})...`);
    try {
      result = await pass7_wordCount(apiKey, result, originalWordCount);
      log('7/7', `Final: ${wc(result)} words`);
    } catch (e) {
      log('7/7', `Word count fix failed`);
    }
  } else {
    log('7/7', `Word count OK: ${currentWC}`);
  }

  console.log(`=== HUMANIZE DONE === ${wc(result)} words ===\n`);
  const scores = scoreText(result);
  return {
    text: result,
    scores: {
      burstiness: scores.burst,
      bannedWordsFound: scores.banned,
      aiOpenersFound: scores.aiOpeners.length,
      fragments: scores.frags,
      examplesUsed: hfSentences.length,
      originalWordCount,
      outputWordCount: wc(result),
      wordCountDelta: Math.round((wc(result) - originalWordCount) / originalWordCount * 100) + '%',
      humanExampleSources: ['Aiden dataset', hfSentences.length > 0 ? 'HuggingFace human stories' : null].filter(Boolean)
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
//  ANSWER AS ME EXPORT
// ═══════════════════════════════════════════════════════════════════
export async function answerAsAiden(apiKey, question, styleProfile, onProgress) {
  const log = (step, msg) => {
    console.log(`  [${step}] ${msg}`);
    if (onProgress) onProgress({ step, msg });
  };

  if (!apiKey) throw new Error('No API key provided');
  if (!question?.trim()) throw new Error('No question provided');

  log('1/3', 'Finding closest human example...');
  const closest = findClosestAidenExample(question);
  log('1/3', `Using "${closest.question}" as structural template`);

  const humanSentences = getSentences(closest.answer);
  const allAidenText = AIDEN_EXAMPLES.map((e,i) => `[HUMAN ${i+1} — Q: "${e.question}"]\n"${e.answer}"`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  log('1/3', 'Writing answer using sentence structure...');
  const draft = await mistral(apiKey,
    `Answer a question in the exact voice and structure of these real human examples.

${allAidenText}

STRUCTURAL TEMPLATE — match this sentence by sentence:
${sentenceBreakdown(closest.answer)}

RULES (same as above — breaking these causes AI detection):
• Every sentence under 18 words
• No em dashes ever
• No colon lists
• No dramatic phrases
• Plain casual words: "lots of", "way more", "can't", "used to"
• Use "I" and "we" naturally
• State your position clearly at the start
• Repeat the main point at the end

${userStyleBlock}

OUTPUT: Return ONLY the answer.`,
    `Question: "${question}"\n\nWrite the answer matching the sentence-by-sentence structure of the template above.`,
    0.88, 800);

  log('2/3', 'Comparing draft to human answer sentence by sentence...');
  const draftSentences = getSentences(draft);
  const final = await mistral(apiKey,
    `Compare this draft to the human answer and fix sentences that diverged.

HUMAN ANSWER:
${humanSentences.map((s,i) => `H${i+1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

DRAFT:
${draftSentences.map((s,i) => `D${i+1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

Fix:
1. Any draft sentence over 18 words — split it
2. Any em dash — remove it
3. Any sentence much longer than its human counterpart — shorten
4. Any overly dramatic or journalistic phrasing — make plain

Output ONLY the corrected answer.`,
    draft, 0.4, 800);

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
