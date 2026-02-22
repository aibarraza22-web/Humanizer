// ═══════════════════════════════════════════════════════════════════
//  pipeline.js — Humanizer pipeline using Mistral AI
//
//  Core insight: GPTZero detects AI because writing lacks a person
//  behind it. AI explains things. Humans react to things.
//  The transformation: turn every explanatory sentence into a
//  reaction or observation from someone with a real point of view.
//
//  Datasets:
//  - Aiden's 6 answers: voice model + structural templates
//  - HuggingFace human stories: real specific details that anchor
//    text in reality (names, numbers, places, moments)
// ═══════════════════════════════════════════════════════════════════

import fetch from 'node-fetch';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

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
    label: "ChatGPT — DO NOT write like this",
    sample: `Artificial intelligence is basically compressing time and lowering barriers. That's the core shift. In finance especially, where speed, information, and risk modeling decide who wins, AI lets small teams compete with institutions that used to need hundreds of analysts and massive infrastructure. First, analysis is getting automated at scale. Second, prediction quality is becoming the edge. Third, personalization is becoming scalable.`
  },
  {
    label: "Claude — DO NOT write like this",
    sample: `AI is reshaping startup competition in financial services in some pretty fundamental ways. Here's what's driving the shift: Leveling the playing field on data — Traditionally, incumbents had a massive moat in the form of decades of customer transaction data. The honest caveat is that AI also introduces new risks — model bias in lending, explainability challenges for regulators, and systemic fragility if many institutions rely on similar underlying models.`
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
  if (!data.choices?.[0]) throw new Error(`Unexpected Mistral response: ${JSON.stringify(data).slice(0,200)}`);
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
        if (w < 6 || w > 30) return false;
        // Keep only sentences with real specific details
        return /\b\d+\b/.test(s) ||
               /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(s) ||
               /\b(I |my |we |our )/i.test(s) ||
               /\b(said|told|found|saw|heard|felt|knew|watched|learned)\b/i.test(s);
      })
      .filter(s => !BANNED.some(b => s.toLowerCase().includes(b)) && !AI_OPENERS.some(p => p.test(s)));

    cachedHFSentences = sentences;
    console.log(`  → Loaded ${sentences.length} specific human sentences from HuggingFace`);
    return sentences;
  } catch (e) {
    console.log(`  → HF failed: ${e.message}`);
    return [];
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
const wc = t => t?.trim() ? t.trim().split(/\s+/).length : 0;
const getSentences = t => (t.match(/[^.!?]+[.!?]+/g) || [t]).map(s => s.trim()).filter(Boolean);

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
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const sentenceBreakdown = text => getSentences(text).map((s,i) => `  S${i+1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n');

function detectInputType(text) {
  const lower = text.toLowerCase();
  const analysisScore = (lower.match(/\b(research|study|studies|data|evidence|according|analysis|found|shows|results|percent|million|billion|report|survey)\b/g) || []).length;
  const opinionScore = (lower.match(/\b(should|must|I |we |our |believe|think|argue|reason|wrong|right|bad|good)\b/g) || []).length;
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
  return AIDEN_EXAMPLES.reduce((best, ex) => Math.abs(getSentences(ex.answer).length - n) < Math.abs(getSentences(best.answer).length - n) ? ex : best);
}

async function hardTrim(apiKey, text, targetWC) {
  if (!text?.trim()) throw new Error('Empty text in hardTrim');
  const current = wc(text);
  if (current <= Math.ceil(targetWC * 1.15)) return text;
  return await mistral(apiKey, `Trim from ${current} to ~${targetWC} words. Remove filler, keep all arguments. Output ONLY the trimmed text.`, text, 0.3, targetWC * 3);
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
//  PASS 1: Analyze input
// ═══════════════════════════════════════════════════════════════════
async function pass1_analyze(apiKey, text) {
  try {
    const raw = await mistral(apiKey,
      `Analyze this text. Return JSON only, no other text:
{"topic":"2-4 word topic","type":"opinion or analysis","position":"the main claim in one sentence"}`,
      text.slice(0, 500), 0.1, 120);
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return { topic: 'general topic', type: detectInputType(text), position: 'makes a claim' };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 3: Rewrite — turn explanations into reactions
// ═══════════════════════════════════════════════════════════════════
async function pass3_rewrite(apiKey, inputText, inputType, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);
  const temps = { aggressive: 0.95, standard: 0.85, subtle: 0.72 };
  const template = findClosestByLength(inputText);
  const allAidenText = AIDEN_EXAMPLES.map((e,i) => `[HUMAN ${i+1}]\n${e.answer}`).join('\n\n');
  const allAIText = AI_EXAMPLES.map(e => `[${e.label}]\n${e.sample}`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const analysisGuidance = `━━━ THE CORE TRANSFORMATION FOR ANALYSIS TEXT ━━━
This input explains things analytically. You must rewrite it so a person with opinions is behind every sentence.

Transform each explanatory sentence into a reaction or observation:
BEFORE (AI/analysis): "AI reduces barriers by automating data analysis and lowering infrastructure costs."
AFTER (human reaction): "Anyone can do this now. You used to need a whole team just to analyze the data."

BEFORE: "Studies show productivity increases of 40% when AI tools are integrated into workflows."
AFTER: "The productivity numbers are insane. We're talking 40% gains just from plugging in the right tools."

BEFORE: "This technology enables smaller teams to compete with larger institutions."
AFTER: "A three-person startup can now compete with Goldman Sachs. That's not an exaggeration."

The idea stays. The framing changes from reporting a fact to REACTING to a fact.
Every sentence needs a person behind it — someone who finds this interesting, alarming, or obvious.`;

  const opinionGuidance = `━━━ STRUCTURAL TEMPLATE ━━━
Match this sentence-by-sentence rhythm from a real human:
${sentenceBreakdown(template.answer)}`;

  const result = await mistral(apiKey,
    `You are rewriting AI text to sound like it was written by a real person with opinions and a point of view.

━━━ REAL HUMAN WRITING — THIS IS YOUR TARGET ━━━
${allAidenText}

━━━ AI WRITING — THIS IS WHAT YOU ARE FIXING ━━━
${allAIText}

━━━ WHAT MAKES WRITING FEEL HUMAN ━━━
Human writing has a person behind it. The writer is not explaining — they are reacting.
They have opinions. They find things obvious, alarming, interesting, or wrong.
They use "I" and "we" naturally. They repeat things for emphasis. They make it personal.

AI writing is smooth and complete. It explains mechanisms, maps perspectives, hedges.
Nobody is behind AI writing. That's what GPTZero detects.

${inputType === 'analysis' ? analysisGuidance : opinionGuidance}

━━━ WORD COUNT — STRICT ━━━
Input: ${wordTarget} words. Output MUST be ${minWords}–${maxWords} words.
Keep every idea from the input. Do not add new ideas. Reframe existing ones.

━━━ NEVER DO ━━━
• Numbered structure: First... Second... Third...
• "Here's what..." or "Here's why..." setups
• Hedging: arguably, it could be said, one might argue
• Acknowledging the other side has valid points
• Sentences over 20 words
• These words: ${BANNED.slice(0,25).join(', ')}
• Em dashes for dramatic effect

${userStyleBlock}

OUTPUT: Return ONLY the rewritten text.`,
    `Rewrite this text:\n\n${inputText}`,
    temps[strength], 3000);

  return await hardTrim(apiKey, result, wordTarget);
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 4: Inject real specific examples that make text feel alive
// ═══════════════════════════════════════════════════════════════════
// Adds 1-2 real world specific examples (companies, people, events)
// that support the argument already being made.
// Word count is controlled: for every sentence added, shorten something
// else. Net change must be zero.
// Framing must be Aiden-style — casual and direct, not journalistic.
async function pass4_injectLife(apiKey, text, hfSentences, originalWordCount) {
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  // Use HF sentences only as a signal for what real specifics exist —
  // not as content to copy. The model should use its own knowledge
  // of real companies/events relevant to the topic.
  const hfSignal = hfSentences.length > 0
    ? `\nFor reference, here are real human sentences with specific details (style only — do not copy content):\n` +
      shuffle(hfSentences).slice(0, 8).map((s,i) => `${i+1}. "${s}"`).join('\n')
    : '';

  const result = await mistral(apiKey,
    `You are adding 1-2 real specific examples to make this text feel grounded and alive.

WHAT TO DO:
1. Read the argument the text is making
2. Find 1-2 places where a real specific example would strengthen the point
3. Add a brief real-world example — a real company, a real person, a real event that actually supports what's being said
4. Frame it the way Aiden would: casual, direct, first-person reaction — NOT like a journalist reporting facts

AIDEN'S STYLE FOR EXAMPLES:
• "Take Renaissance Technologies — their AI fund has been making insane returns for decades."
• "Look at what JPMorgan did with their AI trading desk. They basically replaced analysts with algorithms."
• NOT: "Renaissance Technologies, founded in 1982, employs quantitative models to..."

STRICT WORD COUNT RULE:
Current: ${wc(text)} words. Target: ${minWords}–${maxWords} words.
For every new sentence you add, you MUST shorten or cut something elsewhere.
The total output must be within the target range. This is non-negotiable.

ONLY add examples that:
• Are genuinely real and accurate (real companies, real events)
• Directly support the specific point being made
• Can be stated in 1-2 short sentences max
• You are confident are true — if unsure, skip it
${hfSignal}

Output ONLY the updated text.`,
    text, 0.75, 3000);

  return await hardTrim(apiKey, result, originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 5: Scrub — kill anything written for completeness
// ═══════════════════════════════════════════════════════════════════
// AI writes for completeness: it includes a sentence because the
// paragraph "needs" a transition, a conclusion, a caveat.
// Humans write for conviction: every sentence exists because they
// actually think that thing, not because the structure demands it.
async function pass5_scrub(apiKey, text, originalWordCount) {
  const { banned, aiOpeners } = scoreText(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const result = await mistral(apiKey,
    `Fix AI patterns in this text. Every change is a swap — never add content.

WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)}).

FIND AND FIX:
1. Banned words still present: ${banned.length > 0 ? banned.join(', ') : 'check anyway'} — replace with plain casual words
2. AI sentence openers: ${aiOpeners.length > 0 ? aiOpeners.slice(0,3).map(s=>'"'+s.trim()+'"').join(', ') : 'check anyway'} — rewrite to start differently
3. Any sentence written for "completeness" not conviction — sentences that exist to transition or round out the paragraph rather than because the writer actually thinks that. Cut or replace them.
4. Any sentence that explains HOW something works — rewrite as a reaction to THAT something works
5. Any sentence that hedges or maps multiple perspectives — make it take a side

Output ONLY the fixed text.`,
    text, 0.68, 3000);

  return await hardTrim(apiKey, result, originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  PASS 6: Verify — sentence-by-sentence check
// ═══════════════════════════════════════════════════════════════════
async function pass6_verify(apiKey, text, originalText) {
  const { banned, aiOpeners, burst } = scoreText(text);
  const originalWordCount = wc(originalText);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  const template = findClosestByLength(text);

  const result = await mistral(apiKey,
    `Final check: compare this text against real human writing and fix the last remaining AI patterns.

REAL HUMAN WRITING FOR COMPARISON:
${sentenceBreakdown(template.answer)}

WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)}).

CHECK EACH SENTENCE:
- Does it have a person behind it? Or does it just report/explain something?
- Is it short and direct? (under 20 words)
- Does it use plain words a real person would say?
- Does it STATE things rather than EXPLAIN them?

Also fix:
- Banned words: ${banned.length > 0 ? banned.join(', ') : 'none found'}
- AI openers: ${aiOpeners.length > 0 ? aiOpeners.slice(0,3).map(s=>s.trim()).join(' | ') : 'none found'}
- Burstiness: ${burst}${burst < 0.4 ? ' — TOO UNIFORM, vary sentence lengths (mix very short 4-6w with medium 10-15w)' : ' — ok'}

Output ONLY the corrected text.`,
    text, 0.72, 3000);

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
    return await mistral(apiKey, `Trim from ${current} to between ${min} and ${max} words. Cut filler, keep all arguments. Output ONLY the trimmed text.`, text, 0.3, max * 3);
  } else {
    return await mistral(apiKey, `Expand from ${current} to between ${min} and ${max} words. Add one concrete detail to an existing point. Output ONLY the expanded text.`, text, 0.5, max * 3);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN HUMANIZE EXPORT
// ═══════════════════════════════════════════════════════════════════
export async function humanize(apiKey, inputText, strength, styleProfile, onProgress) {
  const log = (step, msg) => {
    const full = `[${step}] ${msg}`;
    console.log('  ' + full);
    if (onProgress) onProgress({ step, msg });
  };

  if (!apiKey) throw new Error('No API key provided');
  if (!inputText?.trim()) throw new Error('No input text provided');

  const originalWordCount = wc(inputText);
  console.log(`\n=== HUMANIZE START === ${originalWordCount} words ===`);

  // Pass 1
  log('1/7', `Analyzing input... (${originalWordCount} words)`);
  let analysis;
  try {
    analysis = await pass1_analyze(apiKey, inputText);
    log('1/7', `Topic: "${analysis.topic}" | Type: ${analysis.type}`);
  } catch (e) {
    log('1/7', `Analysis failed (${e.message}) — using defaults`);
    analysis = { topic: 'general', type: detectInputType(inputText), position: 'makes a claim' };
  }

  // Pass 2
  log('2/7', 'Loading human writing examples...');
  let hfSentences = [];
  try {
    hfSentences = await loadHFSentences();
    log('2/7', `Loaded ${hfSentences.length} specific human sentences`);
  } catch (e) {
    log('2/7', `HuggingFace load failed (${e.message}) — continuing`);
  }

  // Pass 3
  log('3/7', `Rewriting — converting explanations into reactions (${analysis.type} mode)...`);
  let result;
  try {
    result = await pass3_rewrite(apiKey, inputText, analysis.type, strength || 'aggressive', styleProfile);
    const s = scoreText(result);
    log('3/7', `After rewrite: ${wc(result)} words | burst=${s.burst} | banned=${s.banned.length} | ai-openers=${s.aiOpeners.length}`);
  } catch (e) {
    throw new Error(`Pass 3 failed: ${e.message}`);
  }

  // Pass 4
  log('4/7', 'Injecting specific real-world details...');
  try {
    result = await pass4_injectLife(apiKey, result, hfSentences, originalWordCount);
    const s = scoreText(result);
    log('4/7', `After inject: ${wc(result)} words | burst=${s.burst}`);
  } catch (e) {
    log('4/7', `Inject failed (${e.message}) — continuing`);
  }

  // Pass 5
  log('5/7', 'Scrubbing completeness sentences...');
  try {
    result = await pass5_scrub(apiKey, result, originalWordCount);
    const s = scoreText(result);
    log('5/7', `After scrub: ${wc(result)} words | burst=${s.burst} | banned=${s.banned.length} | ai-openers=${s.aiOpeners.length}`);
  } catch (e) {
    log('5/7', `Scrub failed (${e.message}) — continuing`);
  }

  // Pass 6
  log('6/7', 'Verification pass...');
  try {
    result = await pass6_verify(apiKey, result, inputText);
    const s = scoreText(result);
    log('6/7', `After verify: ${wc(result)} words | burst=${s.burst} | banned=${s.banned.length}`);
  } catch (e) {
    log('6/7', `Verify failed (${e.message}) — continuing`);
  }

  // Pass 7
  const currentWC = wc(result);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  if (currentWC < min || currentWC > max) {
    log('7/7', `Word count fix (${currentWC} → target ${originalWordCount})...`);
    try {
      result = await pass7_wordCount(apiKey, result, originalWordCount);
      log('7/7', `Final: ${wc(result)} words`);
    } catch (e) {
      log('7/7', `Word count fix failed (${e.message})`);
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
      humanExampleSources: hfSentences.length > 0 ? ['HuggingFace human stories dataset'] : ['Aiden dataset only']
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

  console.log(`\n=== ANSWER START === "${question}" ===`);

  log('1/3', 'Finding closest human example...');
  const closest = findClosestAidenExample(question);
  log('1/3', `Using "${closest.question}" as structural template`);

  const closestBreakdown = sentenceBreakdown(closest.answer);
  const humanSentences = getSentences(closest.answer);
  const allAidenText = AIDEN_EXAMPLES.map((e,i) => `[HUMAN ${i+1} — Q: "${e.question}"]\n${e.answer}`).join('\n\n');
  const allAIText = AI_EXAMPLES.map(e => `[${e.label}]\n${e.sample}`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  log('1/3', 'Writing answer using sentence structure...');
  const draft = await mistral(apiKey,
    `Answer a question by substituting new content into the exact sentence structure of a real human answer.

━━━ THE HUMAN ANSWER TO COPY STRUCTURALLY ━━━
Real person answered: "${closest.question}"
Their answer sentence by sentence:
${closestBreakdown}

━━━ YOUR JOB ━━━
Answer the NEW question using the SAME structure:
- Same number of sentences
- Each sentence same LENGTH (±3 words)
- Same TYPE (declarative→declarative, question→question)
- New content relevant to the new question

━━━ ALL HUMAN EXAMPLES ━━━
${allAidenText}

━━━ AI WRITING — NEVER PRODUCE THIS ━━━
${allAIText}

━━━ HARD RULES ━━━
• Never over 20 words per sentence
• Never: however, moreover, furthermore, nuanced, leverage, arguably
• Never list concepts with commas
• Never end with a caveat or "it depends"
• Never acknowledge the other side has valid points
• Use "I" and "we" naturally like Aiden does

${userStyleBlock}

OUTPUT: Return ONLY the answer.`,
    `New question: "${question}"\n\nWrite the answer matching the sentence-by-sentence structure of the human example above.`,
    0.88, 800);

  log('2/3', 'Comparing draft to human answer sentence by sentence...');
  const draftSentences = getSentences(draft);
  const final = await mistral(apiKey,
    `Compare the draft to the human answer sentence by sentence. Fix sentences that diverged.

HUMAN ANSWER:
${humanSentences.map((s,i) => `H${i+1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

DRAFT:
${draftSentences.map((s,i) => `D${i+1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

For each draft sentence:
1. Within 3 words of human length? Fix if not.
2. As direct and confident as human? Remove hedges if not.
3. Plain vocabulary? Replace academic words.
4. States rather than explains? Fix if explaining.

Output ONLY the corrected full answer.`,
    draft, 0.45, 800);

  log('3/3', 'Done');
  console.log(`=== ANSWER DONE ===\n`);

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
