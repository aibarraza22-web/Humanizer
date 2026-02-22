// pipeline.js — Humanizer pipeline v12
// Architecture: initial rewrite → iterative fix loop (up to 4 rounds)
// Each round: score → identify specific AI problems → targeted fix → rescore
// Stops when score is good enough or max rounds hit

import fetch from 'node-fetch';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

// Aiden's real answers — gold standard voice
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

// PROVEN 86% human example — the concrete target
const PROVEN_HUMAN_EXAMPLE = {
  input: `Finance, startups, and AI are kind of colliding right now in a way that feels real, not just hype. In finance, AI helps with things like predicting markets, spotting fraud, managing risk, and analyzing huge amounts of data way faster than any human could.`,
  output: `Finance, startups, and AI are all coming together right now. In finance, AI can help predict markets and analyze lots of data a lot faster than any human ever could. Even more, startups are using AI to build financial tools all by themselves. Someone can now just create a trading model, or a budgeting app, or a risk engine that used to require a giant bank that used to take hundreds of people. That changes everything and now speed and creativity from one person mean so much more than hundreds of people used to. Although, AI does not do this on its own. It still needs the human to push it and manage it. When someone with real financial knowledge gets a hold of these new AI tools. They can be unstoppable, stronger than hundreds of employees just a few months ago. This is not about getting rid of people, but about giving ambitious startup founders the ability to build.`,
  gptzero_score: "86% human"
};

// What 72% human looks like (your manually edited version)
const SECONDARY_HUMAN_EXAMPLE = {
  output: `Currently, finance, startups, and AI are all coming together. This will reshape whole industries and create new opportunities for everyone. They are merging and being able to connect with each other. AI is changing finance because it can predict market trends all by itself. Also, it can see fraud in real-time, handle risk assessment, and go through lots of data faster than any human possibly could. Startups are using AI to build things that were once only possible for large corporations with tons of employees. Now, just one human can make advanced trading models and budgeting apps all by themselves by just using the help of AI. Speed and creativity are starting the matter more that just employees and company size. This allows startups to be able to adapt and outmaneuver larger and slower competitors. However, AI cannot do all this alone. You need a human, knowledgeable in finance, to properly manage the AI. This isn't about replacing anyone but about making all humans be able to build big things themselves. With the help of AI, the future can help us build whatever we want.`,
  gptzero_score: "72% human"
};

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

const DRAMATIC_PHRASES = [
  'the real play', 'leave them in the dust', 'before the coffee',
  'gets cold', 'it actually works', 'the game has changed',
  "isn't just a", "isn't just about", "it's about giving",
  'outrun the big guys', 'levels the playing field', 'ruthless',
  'unprecedented scale', 'eerie precision', 'in the dust',
  'transformative ways', 'reshaping industries', 'revolutionizing',
  'remarkable accuracy', 'fast-paced markets', 'innovative tools',
  'large corporations with extensive teams', 'democratizes',
  'this shift', 'drives innovation', 'harness this synergy',
  'the future belongs to', 'unlocks potential', 'silver bullet'
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
        return w >= 5 && w <= 18;
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

function getLongSentences(text) {
  return getSentences(text).filter(s => s.split(/\s+/).length > 17);
}

function getFoundDramatic(text) {
  return DRAMATIC_PHRASES.filter(p => text.toLowerCase().includes(p.toLowerCase()));
}

// Compute an "AI score" based on detectable problems — lower is better
// Returns a number 0-100 where 0 = looks clean, higher = more AI problems
function computeProblems(text) {
  const long = getLongSentences(text);
  const dramatic = getFoundDramatic(text);
  const banned = countBannedWords(text);
  const aiOpeners = countAIOpeners(text);
  const hasEmDash = text.includes('—');
  const burst = calcBurstiness(text);

  // Paragraph structure check: does it have 4+ clean structured paragraphs?
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const hasStructuredParas = paragraphs.length >= 4;

  // Topic sentence check: sentences starting each paragraph that are very clean/structured
  const topicSentencePatterns = [
    /^[A-Z][^.!?]{15,}(revolutionizing|reshaping|transforming|allowing|enabling|empowering)/i,
    /^(AI is|Finance is|Startups are|The future|This shift|This democratizes)/i,
  ];
  const structuredTopicSentences = paragraphs.filter(p => {
    const first = getSentences(p)[0] || '';
    return topicSentencePatterns.some(pat => pat.test(first.trim()));
  }).length;

  return {
    longSentences: long,
    dramaticPhrases: dramatic,
    bannedWords: banned,
    aiOpeners,
    hasEmDash,
    burst,
    hasStructuredParas,
    structuredTopicSentences,
    // Score: weighted sum of problems
    score: long.length * 3 + dramatic.length * 4 + banned.length * 2 +
           aiOpeners.length * 2 + (hasEmDash ? 5 : 0) +
           (burst < 0.35 ? 8 : 0) + (hasStructuredParas ? 6 : 0) +
           structuredTopicSentences * 3
  };
}

function detectInputType(text) {
  const lower = text.toLowerCase();
  const analysisScore = (lower.match(/\b(research|study|studies|data|evidence|according|analysis|found|shows|results|percent|million|billion|report|survey)\b/g) || []).length;
  const opinionScore = (lower.match(/\b(should|must|I |we |our |believe|think|wrong|right|bad|good)\b/g) || []).length;
  return analysisScore > opinionScore + 2 ? 'analysis' : 'opinion';
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

async function hardTrim(apiKey, text, targetWC) {
  if (!text?.trim()) throw new Error('Empty text in hardTrim');
  const current = wc(text);
  if (current <= Math.ceil(targetWC * 1.12)) return text;
  return await mistral(apiKey,
    `Trim from ${current} to ~${targetWC} words. Remove filler sentences. Keep all arguments. Output ONLY the trimmed text.`,
    text, 0.3, targetWC * 3);
}

// ═══════════════════════════════════════════════════════════════════
//  STEP 1: Initial rewrite
//  Goal: get close to human voice on first pass
// ═══════════════════════════════════════════════════════════════════
async function initialRewrite(apiKey, inputText, inputType, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);
  const temps = { aggressive: 0.92, standard: 0.82, subtle: 0.70 };

  const allAidenText = AIDEN_EXAMPLES.map((e,i) => `[HUMAN EXAMPLE ${i+1}]\n"${e.answer}"`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const extraGuidance = inputType === 'analysis'
    ? `EXTRA FOR ANALYSIS TEXT:
Reframe explanations as personal reactions.
"AI reduces barriers" → "Anyone can do this now. The barriers are gone."
"Studies show 40% gains" → "The productivity numbers are real. We're talking 40% gains."
Every sentence should sound like someone telling you something they find interesting.`
    : `EXTRA FOR OPINION TEXT:
Take a clear side. State it at the start. Repeat it at the end.
Use "I" and "we" naturally. Say what you actually think, directly.`;

  const systemPrompt = `You are rewriting text to pass AI detection. Your output must look like it was typed by a real student, not generated by AI.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROVEN EXAMPLES — STUDY THESE, WRITE LIKE THEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE THAT SCORED 86% HUMAN ON GPTZERO:
"${PROVEN_HUMAN_EXAMPLE.output}"

EXAMPLE THAT SCORED 72% HUMAN (also real, also good):
"${SECONDARY_HUMAN_EXAMPLE.output}"

WHY THESE PASS:
• Short plain sentences (under 15 words each)
• Casual imperfect phrases: "lots of", "way faster", "all by themselves", "tons of", "by just using"
• Slightly off grammar is OK: "being able to connect with each other" sounds real
• Almost no paragraph breaks — it flows as one stream of thought
• NO topic sentences starting each paragraph — real people don't write that way
• No dramatic closings — no "the future belongs to those who harness this synergy"

WHAT FAILS EVEN AFTER "HUMANIZING":
"Finance, startups, and AI are blending in transformative ways. This fusion is reshaping industries."
→ 100% AI. Why? "transformative ways" "reshaping industries" = journalist phrases.
"AI is revolutionizing finance by predicting market trends with remarkable accuracy."
→ 100% AI. Why? Structured topic sentence with colon-style explanation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MORE REAL HUMAN EXAMPLES TO COPY THE VOICE FROM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${allAidenText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NO SENTENCE OVER 18 WORDS. Count every sentence. Split anything longer.
2. NO EM DASHES (—) ever.
3. NO COLON LISTS.
4. NO DRAMATIC PHRASES: no "transformative", "revolutionizing", "reshaping", "remarkable", "unlocks potential", "the future belongs to", "drives innovation"
5. NO STRUCTURED PARAGRAPHS WITH TOPIC SENTENCES. Don't write 4 clean paragraphs each starting with a strong statement. Write like one flowing stream of thought.
6. PLAIN CASUAL WORDS: "lots of" not "numerous", "way faster" not "significantly faster", "can't" not "cannot", "tons of" not "extensive", "now" not "currently"
7. WORD COUNT: output must be ${minWords}–${maxWords} words.

${extraGuidance}

${userStyleBlock}

OUTPUT: Return ONLY the rewritten text. No intro, no explanation.`;

  const result = await mistral(apiKey, systemPrompt,
    `Rewrite this text:\n\n${inputText}`,
    temps[strength || 'aggressive'], 3000);

  return await hardTrim(apiKey, result, wordTarget);
}

// ═══════════════════════════════════════════════════════════════════
//  STEP 2: Targeted fix round
//  Analyzes SPECIFIC problems in the current text and fixes only those
// ═══════════════════════════════════════════════════════════════════
async function targetedFixRound(apiKey, text, originalWordCount, roundNum) {
  const problems = computeProblems(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  // Build a very specific list of what needs fixing THIS round
  const fixList = [];

  if (problems.hasEmDash) {
    fixList.push(`EM DASHES: Replace every — with a period. Start a new sentence.`);
  }

  if (problems.longSentences.length > 0) {
    fixList.push(`LONG SENTENCES — each of these must be split into 2 shorter sentences (each under 15 words):
${problems.longSentences.slice(0,5).map(s => `  • "${s}"`).join('\n')}`);
  }

  if (problems.dramaticPhrases.length > 0) {
    const fixes = {
      'transformative ways': 'big ways',
      'reshaping industries': 'changing industries',
      'revolutionizing': 'changing',
      'remarkable accuracy': 'really good accuracy',
      'fast-paced markets': 'fast markets',
      'innovative tools': 'new tools',
      'large corporations with extensive teams': 'big companies with lots of employees',
      'democratizes': 'opens up',
      'this shift': 'this change',
      'drives innovation': 'helps people build new things',
      'harness this synergy': 'use these tools together',
      'the future belongs to': 'whoever does this will win',
      'unlocks potential': 'helps people do more',
      'silver bullet': 'magic fix',
    };
    const fixLines = problems.dramaticPhrases.slice(0,6).map(p => {
      const fix = fixes[p.toLowerCase()] || 'a plain casual phrase';
      return `  • "${p}" → replace with "${fix}"`;
    }).join('\n');
    fixList.push(`DRAMATIC PHRASES — replace each with the plain version shown:\n${fixLines}`);
  }

  if (problems.bannedWords.length > 0) {
    fixList.push(`BANNED WORDS — replace with plain words:
${problems.bannedWords.slice(0,6).map(w => `  • "${w}"`).join('\n')}`);
  }

  if (problems.aiOpeners.length > 0) {
    fixList.push(`AI SENTENCE OPENERS — rewrite these to start differently:
${problems.aiOpeners.slice(0,4).map(s => `  • "${s.trim().slice(0,70)}"`).join('\n')}`);
  }

  if (problems.hasStructuredParas && problems.structuredTopicSentences > 1) {
    fixList.push(`STRUCTURED PARAGRAPHS: The text still reads like a formal essay with topic sentences. 
Merge some paragraphs together. Make it flow like one stream of thought, not 4 organized sections.
Specifically rewrite these over-structured opening sentences to be more casual:
${text.split(/\n\n+/).slice(0,4).map((p,i) => {
  const first = getSentences(p)[0] || '';
  return `  Para ${i+1} opener: "${first.trim().slice(0,80)}"`;
}).join('\n')}`);
  }

  if (problems.burst < 0.35) {
    fixList.push(`UNIFORM RHYTHM: All sentences are about the same length. Add 2-3 very short sentences (4-7 words) scattered through the text to break the rhythm. Example: "That changes everything." or "Anyone can do this now." or "It just works."`);
  }

  if (fixList.length === 0) return text; // nothing to fix

  console.log(`  [Fix Round ${roundNum}] Fixing ${fixList.length} problem types | score=${problems.score}`);

  const result = await mistral(apiKey,
    `You are making targeted fixes to text that is being detected as AI. Fix ONLY the specific problems listed. Do not rewrite the whole thing.

PROVEN HUMAN EXAMPLES for reference (write like these):
"${PROVEN_HUMAN_EXAMPLE.output}"

"${SECONDARY_HUMAN_EXAMPLE.output}"

WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)} words).

━━ SPECIFIC PROBLEMS TO FIX THIS ROUND ━━
${fixList.join('\n\n')}

IMPORTANT: Fix only what's listed. Keep everything else the same. Output ONLY the corrected text.`,
    text, 0.55, 3000);

  return await hardTrim(apiKey, result, originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  STEP 3: Word count fix
// ═══════════════════════════════════════════════════════════════════
async function fixWordCount(apiKey, text, originalWordCount) {
  const current = wc(text);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  if (current >= min && current <= max) return text;
  if (current > max) {
    return await mistral(apiKey,
      `Trim from ${current} to between ${min} and ${max} words. Cut whole sentences that are least essential. Keep all main arguments. Output ONLY the result.`,
      text, 0.3, max * 3);
  } else {
    return await mistral(apiKey,
      `Expand from ${current} to between ${min} and ${max} words. Add one short plain casual sentence to an existing point. Keep the same voice. Output ONLY the result.`,
      text, 0.5, max * 3);
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

  // Step 1: Load HuggingFace examples
  log('1/7', 'Loading human writing examples...');
  let hfSentences = [];
  try {
    hfSentences = await loadHFSentences();
    log('1/7', `Loaded ${hfSentences.length} human sentences`);
  } catch (e) {
    log('1/7', `HF load failed — continuing`);
  }

  // Step 2: Analyze input type
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
  log('3/7', `Initial rewrite (${analysis.type} mode)...`);
  let result;
  try {
    result = await initialRewrite(apiKey, inputText, analysis.type, strength || 'aggressive', styleProfile);
    const problems = computeProblems(result);
    log('3/7', `After rewrite: ${wc(result)} words | problem score=${problems.score} | burst=${problems.burst}`);
  } catch (e) {
    throw new Error(`Initial rewrite failed: ${e.message}`);
  }

  // Steps 4-6: Iterative fix loop (up to 3 rounds)
  // Each round looks at what's STILL wrong and fixes only those things
  const MAX_ROUNDS = 3;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const problems = computeProblems(result);

    // Stop early if clean enough
    if (problems.score <= 3 && problems.burst >= 0.35) {
      log(`${round + 3}/7`, `Score clean (${problems.score}) — skipping round ${round}`);
      // Still need to fill the step indicators
      if (round <= MAX_ROUNDS) {
        for (let r = round; r <= MAX_ROUNDS; r++) {
          log(`${r + 3}/7`, `No fixes needed`);
        }
      }
      break;
    }

    log(`${round + 3}/7`, `Fix round ${round}/3 (score=${problems.score} | long=${problems.longSentences.length} | dramatic=${problems.dramaticPhrases.length} | banned=${problems.bannedWords.length})...`);
    try {
      result = await targetedFixRound(apiKey, result, originalWordCount, round);
      const newProblems = computeProblems(result);
      log(`${round + 3}/7`, `After round ${round}: ${wc(result)} words | score=${newProblems.score} | burst=${newProblems.burst}`);
    } catch (e) {
      log(`${round + 3}/7`, `Round ${round} failed (${e.message}) — continuing`);
    }
  }

  // Step 7: Final word count fix
  const currentWC = wc(result);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  if (currentWC < min || currentWC > max) {
    log('7/7', `Word count fix (${currentWC} → target ${originalWordCount})...`);
    try {
      result = await fixWordCount(apiKey, result, originalWordCount);
      log('7/7', `Final: ${wc(result)} words`);
    } catch (e) {
      log('7/7', `Word count fix failed`);
    }
  } else {
    log('7/7', `Word count OK: ${currentWC}`);
  }

  console.log(`=== HUMANIZE DONE === ${wc(result)} words ===\n`);
  const finalProblems = computeProblems(result);
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

function getSentencesForBreakdown(text) {
  return getSentences(text).map((s,i) => `  S${i+1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n');
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
${getSentencesForBreakdown(closest.answer)}

RULES:
• Every sentence under 18 words
• No em dashes ever
• No colon lists
• No dramatic phrases
• Plain casual words: "lots of", "way more", "can't", "used to"
• Use "I" and "we" naturally
• State your position clearly at the start
• Repeat the main point at the end
• Write like one flowing stream — no structured paragraphs with topic sentences

${userStyleBlock}

OUTPUT: Return ONLY the answer.`,
    `Question: "${question}"\n\nWrite the answer matching the sentence-by-sentence structure of the template above.`,
    0.88, 800);

  log('2/3', 'Fixing any remaining AI patterns...');
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
