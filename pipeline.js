// pipeline.js — Humanizer v12
// Architecture: load examples → analyze → initial rewrite → iterative fix loop (3 rounds) → word count fix
// Each fix round detects specific AI problems still present and fixes only those

import fetch from 'node-fetch';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

// ─── Aiden's real answers — gold standard voice ───────────────────────────────
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

// ─── Proven human examples — concrete targets ────────────────────────────────
const HUMAN_EXAMPLE_86 = `Finance, startups, and AI are all coming together right now. In finance, AI can help predict markets and analyze lots of data a lot faster than any human ever could. Even more, startups are using AI to build financial tools all by themselves. Someone can now just create a trading model, or a budgeting app, or a risk engine that used to require a giant bank that used to take hundreds of people. That changes everything and now speed and creativity from one person mean so much more than hundreds of people used to. Although, AI does not do this on its own. It still needs the human to push it and manage it. When someone with real financial knowledge gets a hold of these new AI tools. They can be unstoppable, stronger than hundreds of employees just a few months ago. This is not about getting rid of people, but about giving ambitious startup founders the ability to build.`;

const HUMAN_EXAMPLE_72 = `Currently, finance, startups, and AI are all coming together. This will reshape whole industries and create new opportunities for everyone. They are merging and being able to connect with each other. AI is changing finance because it can predict market trends all by itself. Also, it can see fraud in real-time, handle risk assessment, and go through lots of data faster than any human possibly could. Startups are using AI to build things that were once only possible for large corporations with tons of employees. Now, just one human can make advanced trading models and budgeting apps all by themselves by just using the help of AI. Speed and creativity are starting the matter more that just employees and company size. This allows startups to be able to adapt and outmaneuver larger and slower competitors. However, AI cannot do all this alone. You need a human, knowledgeable in finance, to properly manage the AI. This isn't about replacing anyone but about making all humans be able to build big things themselves. With the help of AI, the future can help us build whatever we want.`;

// ─── Banned words ─────────────────────────────────────────────────────────────
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

// Dramatic phrases that signal AI even after rewriting
const DRAMATIC_PHRASES = [
  'transformative ways','reshaping industries','revolutionizing','revolutionize',
  'remarkable accuracy','fast-paced markets','innovative tools','innovative approach',
  'large corporations with extensive teams','democratizes','democratize',
  'drives innovation','harness this synergy','the future belongs to',
  'unlocks potential','silver bullet','leave them in the dust',
  'unprecedented scale','eerie precision','the real play',
  'levels the playing field','game changer','game-changer',
  'blending in transformative','creating new opportunities',
  'in transformative ways','redefining','cutting-edge','state-of-the-art'
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

// ─── HuggingFace dataset ──────────────────────────────────────────────────────
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
        return w >= 5 && w <= 18;
      })
      .filter(s => !BANNED.some(b => s.toLowerCase().includes(b)) && !AI_OPENERS.some(p => p.test(s)));
    cachedHFSentences = sentences;
    return sentences;
  } catch (e) {
    console.log(`  HF load failed: ${e.message}`);
    return [];
  }
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

// Detect specific AI problems — returns object + weighted score
function detectProblems(text) {
  const sentences = getSentences(text);
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 17);
  const hasEmDash = text.includes('—');
  const dramatic = DRAMATIC_PHRASES.filter(p => text.toLowerCase().includes(p.toLowerCase()));
  const banned = countBanned(text);
  const aiOpeners = countAIOpeners(text);
  const burst = calcBurstiness(text);

  // Essay structure detection
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const structuredParaPatterns = [
    /^(AI is|Finance is|Startups are|The future|This shift|This democratizes|This allows|This enables)/i,
    /^[A-Z][^.!?]+(revolutionizing|reshaping|transforming|enabling|empowering)/i,
    /^(In this|In today's|In the current|In recent)/i,
  ];
  const structuredParas = paragraphs.filter(p => {
    const first = (getSentences(p)[0] || '').trim();
    return structuredParaPatterns.some(pat => pat.test(first));
  }).length;

  const score =
    longSentences.length * 4 +
    dramatic.length * 5 +
    banned.length * 3 +
    aiOpeners.length * 3 +
    (hasEmDash ? 6 : 0) +
    (burst < 0.35 ? 8 : 0) +
    structuredParas * 4 +
    (paragraphs.length >= 5 ? 5 : 0);

  return { longSentences, dramatic, banned, aiOpeners, hasEmDash, burst, structuredParas, paragraphCount: paragraphs.length, paragraphTexts: paragraphs, score };
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

// ═══════════════════════════════════════════════════════════════════
//  STEP 3: Initial rewrite
// ═══════════════════════════════════════════════════════════════════
async function initialRewrite(apiKey, inputText, inputType, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);
  const temps = { aggressive: 0.92, standard: 0.82, subtle: 0.70 };

  const allAidenText = AIDEN_EXAMPLES.map((e, i) => `[HUMAN EXAMPLE ${i + 1}]\n"${e.answer}"`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const extraGuidance = inputType === 'analysis'
    ? `EXTRA FOR ANALYSIS TEXT:
Reframe explanations as personal reactions. Sound like someone telling you something they find interesting.
"AI reduces barriers" → "Anyone can do this now. The barriers are gone."
"Studies show 40% gains" → "The productivity numbers are real. We're talking 40% gains."`
    : `EXTRA FOR OPINION TEXT:
Take a clear side. State it at the start. Repeat it at the end.
Use "I" and "we" naturally. Say what you actually think, directly.`;

  const system = `You are rewriting text to pass GPTZero AI detection. Your output must look like it was typed by a real student.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TWO REAL OUTPUTS THAT PASSED GPTZERO — WRITE LIKE THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 1 — scored 86% human:
"${HUMAN_EXAMPLE_86}"

EXAMPLE 2 — scored 72% human:
"${HUMAN_EXAMPLE_72}"

WHY THESE PASS:
• Short sentences — most are 8–14 words
• Casual imperfect phrases: "lots of", "all by themselves", "tons of", "way faster", "by just using"
• Slightly off grammar is fine — real people write this way
• Flows as one stream of thought — NOT 4 clean organized paragraphs with topic sentences
• Short punchy sentences mixed in: "That changes everything." / "Anyone can do this now."
• No dramatic closings about "the future"

WHAT 100% AI DETECTION LOOKS LIKE — NEVER WRITE LIKE THIS:
"Finance, startups, and AI are blending in transformative ways. This fusion is reshaping industries."
→ FAILS: "transformative ways" "reshaping industries" = journalist phrases. Clean topic sentence = essay.

"AI is revolutionizing finance by predicting market trends with remarkable accuracy."
→ FAILS: Structured topic sentence. "revolutionizing" "remarkable accuracy" = AI vocabulary.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MORE REAL HUMAN VOICE EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${allAidenText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES — BREAK ANY = AI DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NO SENTENCE OVER 18 WORDS. Count every sentence. Split anything longer.
2. NO EM DASHES (—). Never. Not once.
3. NO COLON LISTS. Never use : to introduce items.
4. NO DRAMATIC PHRASES. Replace: "transformative" → "big", "revolutionizing" → "changing", "remarkable accuracy" → "really good accuracy", "reshaping" → "changing", "unprecedented" → "huge", "innovative" → "new", "cutting-edge" → "new"
5. NO STRUCTURED ESSAY PARAGRAPHS. Do not write 4 clean sections each starting with a topic sentence. Write like one flowing stream of thought.
6. PLAIN CASUAL WORDS: "lots of" not "numerous", "way faster" not "significantly faster", "can't" not "cannot", "tons of" not "extensive", "now" not "currently", "used to" not "historically"
7. WORD COUNT: output must be ${minWords}–${maxWords} words.

${extraGuidance}
${userStyleBlock}

OUTPUT: Return ONLY the rewritten text. No intro, no explanation.`;

  const result = await mistral(apiKey, system,
    `Rewrite this text:\n\n${inputText}`,
    temps[strength || 'aggressive'], 3000);

  return await enforceWordCount(apiKey, result, wordTarget);
}

// ═══════════════════════════════════════════════════════════════════
//  STEPS 4–6: Iterative fix rounds
//  Each round: detect what's still AI → fix only those things
// ═══════════════════════════════════════════════════════════════════
async function fixRound(apiKey, text, originalWordCount, roundNum) {
  const problems = detectProblems(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const fixList = [];

  if (problems.hasEmDash) {
    fixList.push(`EM DASHES: Replace every — with a period. Start a new sentence.`);
  }

  if (problems.longSentences.length > 0) {
    fixList.push(`LONG SENTENCES — split each into 2 shorter sentences (each under 14 words):
${problems.longSentences.slice(0, 5).map(s => `  • "${s}"`).join('\n')}`);
  }

  if (problems.dramatic.length > 0) {
    const replacements = {
      'transformative ways': 'big ways',
      'reshaping industries': 'changing industries',
      'revolutionizing': 'changing',
      'revolutionize': 'change',
      'remarkable accuracy': 'really good accuracy',
      'fast-paced markets': 'fast markets',
      'innovative tools': 'new tools',
      'innovative approach': 'new approach',
      'large corporations with extensive teams': 'big companies with lots of employees',
      'democratizes': 'opens up for everyone',
      'democratize': 'open up for everyone',
      'drives innovation': 'helps people build new things',
      'harness this synergy': 'use these tools together',
      'the future belongs to': 'whoever does this will win',
      'unlocks potential': 'helps people do more',
      'silver bullet': 'magic fix',
      'leave them in the dust': 'beat them',
      'unprecedented scale': 'a huge scale',
      'eerie precision': 'really good accuracy',
      'levels the playing field': 'lets anyone compete',
      'game changer': 'a big deal',
      'game-changer': 'a big deal',
      'redefining': 'changing',
      'cutting-edge': 'new',
      'state-of-the-art': 'the best',
    };
    const lines = problems.dramatic.slice(0, 6).map(p => {
      const fix = replacements[p.toLowerCase()] || 'a plain casual phrase';
      return `  • "${p}" → "${fix}"`;
    }).join('\n');
    fixList.push(`DRAMATIC PHRASES — replace each:\n${lines}`);
  }

  if (problems.banned.length > 0) {
    fixList.push(`BANNED AI WORDS — replace with plain casual words:
${problems.banned.slice(0, 6).map(w => `  • "${w}"`).join('\n')}`);
  }

  if (problems.aiOpeners.length > 0) {
    fixList.push(`AI SENTENCE OPENERS — rewrite these to not start with AI filler:
${problems.aiOpeners.slice(0, 4).map(s => `  • "${s.trim().slice(0, 80)}"`).join('\n')}`);
  }

  if (problems.structuredParas > 1 || problems.paragraphCount >= 5) {
    const paraOpenings = problems.paragraphTexts.slice(0, 5).map((p, i) => {
      const first = (getSentences(p)[0] || '').trim();
      return `  Para ${i + 1}: "${first.slice(0, 80)}"`;
    }).join('\n');
    fixList.push(`ESSAY STRUCTURE: Too many organized paragraphs with clean topic sentences. Merge some paragraphs. Make it flow like one stream of thought, not an essay.
Current para openers:
${paraOpenings}`);
  }

  if (problems.burst < 0.35) {
    fixList.push(`UNIFORM RHYTHM: All sentences are about the same length — AI pattern. Add 2–3 very short punchy sentences (4–7 words) scattered through the text.
Examples: "That changes everything." / "Anyone can do this now." / "It just works." / "That is the whole point."`);
  }

  if (fixList.length === 0) {
    return { text, changed: false, score: problems.score };
  }

  const result = await mistral(apiKey,
    `Making targeted fixes to text still detected as AI. Fix ONLY the specific problems listed. Do not rewrite everything.

REFERENCE — write more like this proven human example:
"${HUMAN_EXAMPLE_86}"

WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)} words).

━━ FIX THESE SPECIFIC PROBLEMS ━━
${fixList.join('\n\n')}

Output ONLY the corrected text.`,
    text, 0.55, 3000);

  const fixed = await enforceWordCount(apiKey, result, originalWordCount);
  const newProblems = detectProblems(fixed);
  return { text: fixed, changed: true, score: newProblems.score, prevScore: problems.score };
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

  // Step 1: Load HuggingFace examples
  log('1/7', 'Loading human writing examples from dataset...');
  let hfSentences = [];
  try {
    hfSentences = await loadHFSentences();
    log('1/7', `Loaded ${hfSentences.length} human sentences`);
  } catch (e) {
    log('1/7', 'Dataset load failed — continuing with built-in examples');
  }

  // Step 2: Analyze input
  log('2/7', 'Analyzing input...');
  let analysis = { topic: 'general', type: detectInputType(inputText) };
  try {
    const raw = await mistral(apiKey,
      `Analyze this text. Return JSON only: {"topic":"2-4 word topic","type":"opinion or analysis"}`,
      inputText.slice(0, 400), 0.1, 80);
    analysis = JSON.parse(raw.replace(/```json|```/g, '').trim());
    log('2/7', `Topic: "${analysis.topic}" | Type: ${analysis.type}`);
  } catch {
    log('2/7', `Analysis defaulting to: ${analysis.type}`);
  }

  // Step 3: Initial rewrite
  log('3/7', `Rewriting in human voice (${analysis.type} mode)...`);
  let result;
  try {
    result = await initialRewrite(apiKey, inputText, analysis.type, strength || 'aggressive', styleProfile);
    const p = detectProblems(result);
    log('3/7', `Rewrite done: ${wc(result)} words | problem score=${p.score} | burst=${p.burst}`);
  } catch (e) {
    throw new Error(`Rewrite failed: ${e.message}`);
  }

  // Steps 4–6: Iterative fix loop (up to 3 rounds)
  const stepLabels = ['4/7', '5/7', '6/7'];

  for (let round = 0; round < 3; round++) {
    const stepLabel = stepLabels[round];
    const currentProblems = detectProblems(result);

    if (currentProblems.score <= 2) {
      log(stepLabel, `Score clean (${currentProblems.score}) — no fixes needed`);
      continue;
    }

    const summary = [
      currentProblems.longSentences.length > 0 ? `long=${currentProblems.longSentences.length}` : null,
      currentProblems.dramatic.length > 0 ? `dramatic=${currentProblems.dramatic.length}` : null,
      currentProblems.banned.length > 0 ? `banned=${currentProblems.banned.length}` : null,
      currentProblems.hasEmDash ? 'em-dash' : null,
      currentProblems.burst < 0.35 ? 'low-burst' : null,
      currentProblems.structuredParas > 1 ? `structured-paras=${currentProblems.structuredParas}` : null,
    ].filter(Boolean).join(' | ');

    log(stepLabel, `Fix round ${round + 1}/3 (score=${currentProblems.score} | ${summary})...`);

    try {
      const fix = await fixRound(apiKey, result, originalWordCount, round + 1);
      result = fix.text;
      const newScore = detectProblems(result).score;
      log(stepLabel, `After round ${round + 1}: ${wc(result)} words | score=${newScore} | burst=${calcBurstiness(result)}`);
    } catch (e) {
      log(stepLabel, `Round ${round + 1} failed (${e.message}) — continuing`);
    }
  }

  // Step 7: Final word count
  const currentWC = wc(result);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);

  if (currentWC < min || currentWC > max) {
    log('7/7', `Word count fix (${currentWC} → target ${originalWordCount})...`);
    try {
      result = await enforceWordCount(apiKey, result, originalWordCount);
      log('7/7', `Final: ${wc(result)} words`);
    } catch (e) {
      log('7/7', 'Word count fix failed — keeping as is');
    }
  } else {
    log('7/7', `Word count OK: ${currentWC} words`);
  }

  console.log(`=== HUMANIZE DONE === ${wc(result)} words ===\n`);

  return {
    text: result,
    scores: {
      burstiness: calcBurstiness(result),
      bannedWordsFound: countBanned(result),
      aiOpenersFound: countAIOpeners(result).length,
      fragments: countFragments(result),
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

  log('1/3', 'Finding closest human example...');
  const closest = findClosestAidenExample(question);
  log('1/3', `Using "${closest.question}" as template`);

  const humanSentences = getSentences(closest.answer);
  const allAidenText = AIDEN_EXAMPLES.map((e, i) => `[HUMAN ${i + 1} — Q: "${e.question}"]\n"${e.answer}"`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';
  const sentenceBreakdown = humanSentences.map((s, i) => `  S${i + 1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n');

  log('1/3', 'Writing answer...');
  const draft = await mistral(apiKey,
    `Answer a question in the exact voice and structure of these real human examples.

${allAidenText}

STRUCTURAL TEMPLATE — match this sentence by sentence:
${sentenceBreakdown}

RULES:
• Every sentence under 18 words
• No em dashes ever
• No colon lists
• No dramatic phrases — no "transformative", "revolutionizing", "reshaping", "remarkable"
• Plain casual words: "lots of", "way more", "can't", "used to", "tons of"
• Use "I" and "we" naturally
• State your position at the start
• Repeat the main point at the end
• Write as one flowing stream — NOT organized paragraphs with topic sentences

${userStyleBlock}

OUTPUT: Return ONLY the answer.`,
    `Question: "${question}"\n\nWrite the answer matching the sentence-by-sentence structure of the template.`,
    0.88, 800);

  log('2/3', 'Checking for remaining AI patterns...');
  const draftSentences = getSentences(draft);
  const final = await mistral(apiKey,
    `Compare this draft to the human answer and fix anything that diverged.

HUMAN ANSWER:
${humanSentences.map((s, i) => `H${i + 1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

DRAFT:
${draftSentences.map((s, i) => `D${i + 1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

Fix:
1. Any sentence over 18 words — split it
2. Any em dash — replace with period + new sentence
3. Any dramatically longer sentence than its counterpart — shorten
4. Any journalistic or dramatic phrasing — make plain

Output ONLY the corrected answer.`,
    draft, 0.4, 800);

  log('3/3', 'Done');

  return {
    text: final,
    scores: {
      bannedWordsFound: countBanned(final),
      aiOpenersFound: countAIOpeners(final).length,
      burstiness: calcBurstiness(final),
      wordCount: wc(final)
    }
  };
}
