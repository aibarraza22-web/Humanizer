// pipeline.js — Humanizer v14
// Key addition: hardScrub() — regex-based post-processing that catches
// AI-trying-to-sound-casual patterns before output leaves the pipeline.
// These patterns (rhetorical questions, one-word sentences, "here's the twist" etc.)
// are NOT caught by the LLM passes because the LLM invents them itself.

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

// ─── Proven human examples ────────────────────────────────────────────────────
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

const DRAMATIC_PHRASES = [
  'transformative ways','reshaping industries','revolutionizing','revolutionize',
  'remarkable accuracy','fast-paced markets','innovative tools','innovative approach',
  'large corporations with extensive teams','democratizes','democratize',
  'drives innovation','harness this synergy','the future belongs to',
  'unlocks potential','silver bullet','leave them in the dust',
  'unprecedented scale','eerie precision','the real play',
  'levels the playing field','game changer','game-changer',
  'blending in transformative','creating new opportunities',
  'in transformative ways','redefining','cutting-edge','state-of-the-art',
  'superpowers','outrun the big'
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

// ═══════════════════════════════════════════════════════════════════
//  HARD SCRUB — regex-based, runs on every pass output
//  Catches patterns the LLM invents when trying to sound casual.
//  These are NOT caught by the LLM passes because the model generates them.
//  No API call — pure string manipulation.
// ═══════════════════════════════════════════════════════════════════
function hardScrub(text) {
  let t = text;

  // ── Em dashes ──────────────────────────────────────────────────
  // Replace — with period + capitalize next word
  t = t.replace(/\s*—\s*/g, '. ');

  // ── "Here's the X:" setup phrases ─────────────────────────────
  // "Here's the real twist:" / "Here's the thing:" / "Here's the deal:"
  t = t.replace(/here's the (real |)?(twist|thing|deal|catch|key|truth|problem|issue|point)[:\s]/gi, 'The thing is, ');
  t = t.replace(/but here's (the |)(real |)?(twist|thing|deal|catch|key|truth)[:\s]/gi, 'But the thing is, ');

  // ── Rhetorical questions followed by answer ────────────────────
  // "The old barriers? Yeah, they're gone." → "The old barriers are pretty much gone."
  // "Size? Doesn't matter." → "Size doesn't really matter."
  t = t.replace(/([A-Z][^.!?]{2,30})\?\s+(Yeah,?\s+)?(they're|it's|that's|he's|she's|we're|they are|it is)/gi,
    (match, subject, yeah, verb) => `${subject} ${verb}`);
  t = t.replace(/([A-Z][^.!?]{2,30})\?\s+(Yeah,?\s+)?/gi, (match, subject) => `${subject}. `);

  // ── One-word or two-word dramatic sentences ────────────────────
  // "Unstoppable." / "Remarkable." / "Game-changing." / "Period."
  const dramaticOneWordSentences = [
    'Unstoppable', 'Remarkable', 'Extraordinary', 'Revolutionary', 'Transformative',
    'Unprecedented', 'Incredible', 'Unbelievable', 'Fascinating', 'Stunning',
    'Period', 'Full stop', 'Simple as that', 'End of story', 'Case closed',
    'Mind-blowing', 'Mind blowing', 'Game-changing', 'Game changing',
    'That simple', 'That easy', 'That big'
  ];
  for (const word of dramaticOneWordSentences) {
    // Match as standalone sentence (preceded by period/newline, followed by period/newline)
    const pattern = new RegExp(`(\\.|\\n|^)\\s*${word}\\.\\s*`, 'gi');
    t = t.replace(pattern, (match, pre) => `${pre} `);
  }

  // ── "Now?" / "Why?" / rhetorical one-word questions ───────────
  t = t.replace(/\b(Now|Why|How|What|When|Where)\?\s+/g, '');

  // ── Colon setups ───────────────────────────────────────────────
  // "But here's what's changed: startups..." → "But startups..."
  t = t.replace(/[Bb]ut here's what('s| has) changed:\s*/g, 'But ');
  t = t.replace(/[Tt]he real (reason|answer|point|difference|advantage) (is|here) is:\s*/g, 'The real point is ');
  t = t.replace(/[Hh]ere's why:\s*/g, 'Because ');
  t = t.replace(/[Hh]ere's how:\s*/g, '');
  t = t.replace(/[Tt]he (bottom line|key takeaway|main point):\s*/g, 'The main point is ');

  // ── "Not X. Y." dramatic contrast sentences ───────────────────
  // "Not replacing people. Empowering them." → "It's not about replacing people, it's about empowering them."
  t = t.replace(/\bNot (replacing|removing|eliminating|cutting|reducing)\s+([^.]+)\.\s+([A-Z][^.]+ing)\s+them\./g,
    "It's not about $1 $2. It's about $3 them.");

  // ── Trailing dramatic closers ──────────────────────────────────
  t = t.replace(/\b(The barriers are gone|The old barriers\?[^.]*)\./gi, 'The barriers are a lot lower now.');
  t = t.replace(/\bThe (old |)(rules|game|world|landscape) (has |have |)(changed|shifted)\./gi, 'Things have changed a lot.');

  // ── Clean up double spaces and double periods from replacements ─
  t = t.replace(/\.\.+/g, '.');
  t = t.replace(/\s{2,}/g, ' ');
  t = t.replace(/\.\s*\./g, '.');

  // ── Capitalize first letter after period if lowercased ─────────
  t = t.replace(/\.\s+([a-z])/g, (m, c) => `. ${c.toUpperCase()}`);

  return t.trim();
}

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

function detectProblems(text) {
  const sentences = getSentences(text);
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 17);
  const hasEmDash = text.includes('—');
  const dramatic = DRAMATIC_PHRASES.filter(p => text.toLowerCase().includes(p.toLowerCase()));
  const banned = countBanned(text);
  const aiOpeners = countAIOpeners(text);
  const burst = calcBurstiness(text);
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
    longSentences.length * 4 + dramatic.length * 5 + banned.length * 3 +
    aiOpeners.length * 3 + (hasEmDash ? 6 : 0) + (burst < 0.35 ? 8 : 0) +
    structuredParas * 4 + (paragraphs.length >= 5 ? 5 : 0);

  return { longSentences, dramatic, banned, aiOpeners, hasEmDash, burst, structuredParas, paragraphs, score };
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
TWO REAL OUTPUTS THAT PASSED GPTZERO — WRITE EXACTLY LIKE THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 1 — scored 86% human:
"${HUMAN_EXAMPLE_86}"

EXAMPLE 2 — scored 72% human:
"${HUMAN_EXAMPLE_72}"

WHY THESE PASS:
• Short sentences — most are 8–14 words
• Casual imperfect phrases: "lots of", "all by themselves", "tons of", "way faster", "by just using"
• Slightly off grammar is fine — real people write this way
• Flows as one stream of thought — NOT organized paragraphs with topic sentences
• Short punchy statements mixed in: "That changes everything." / "Anyone can do this now."

WHAT STILL GETS DETECTED EVEN WHEN "CASUAL" — DO NOT WRITE LIKE THIS:
"But here's the real twist: startups are using it..." → DETECTED. "Here's the X:" is an AI setup phrase.
"Unstoppable." as a standalone sentence → DETECTED. One-word dramatic sentences = AI.
"The old barriers? Yeah, they're pretty much gone." → DETECTED. Rhetorical question + yeah = AI.
"It's not about replacing people. Empowering them." → DETECTED. Dramatic two-part contrast = AI.
"Size doesn't matter as much anymore—speed and creativity matter way more" → DETECTED. Em dash mid-sentence = AI.
"That's why startups can outrun the big, slow companies." → DETECTED. "outrun" = dramatic.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MORE REAL HUMAN VOICE EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${allAidenText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES — BREAK ANY = AI DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NO SENTENCE OVER 18 WORDS.
2. NO EM DASHES (—). Never. Replace with a period.
3. NO COLON SETUPS. Never use "here's the thing:", "here's the twist:", "the real point:", etc.
4. NO RHETORICAL QUESTIONS. Never write "The old barriers? Yeah..." or "Now?" or "Why?"
5. NO ONE-WORD DRAMATIC SENTENCES. Never write "Unstoppable." or "Period." or "Remarkable." alone.
6. NO DRAMATIC CONTRASTS. Never write "Not replacing people. Empowering them." style sentences.
7. NO DRAMATIC PHRASES: "transformative" → "big", "revolutionizing" → "changing", "outrun" → "beat", "superpowers" → "a big advantage", "unprecedented" → "huge"
8. NO STRUCTURED ESSAY PARAGRAPHS. Write as one flowing stream of thought.
9. PLAIN CASUAL WORDS: "lots of" not "numerous", "way faster" not "significantly faster", "can't" not "cannot"
10. WORD COUNT: output must be ${minWords}–${maxWords} words.

${extraGuidance}
${userStyleBlock}

OUTPUT: Return ONLY the rewritten text. No intro, no explanation.`;

  const raw = await mistral(apiKey, system,
    `Rewrite this text:\n\n${inputText}`,
    temps[strength || 'aggressive'], 3000);

  const scrubbed = hardScrub(raw);
  return await enforceWordCount(apiKey, scrubbed, wordTarget);
}

// ═══════════════════════════════════════════════════════════════════
//  ROUND 1: Fix detectable problems
// ═══════════════════════════════════════════════════════════════════
async function round1_fixProblems(apiKey, text, originalWordCount) {
  const problems = detectProblems(text);
  if (problems.score <= 2) return { text, skipped: true };

  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  const fixList = [];

  if (problems.hasEmDash) fixList.push(`EM DASHES: Replace every — with a period. Start a new sentence.`);

  if (problems.longSentences.length > 0) {
    fixList.push(`LONG SENTENCES — split each into 2 shorter sentences (each under 14 words):\n${problems.longSentences.slice(0, 5).map(s => `  • "${s}"`).join('\n')}`);
  }

  if (problems.dramatic.length > 0) {
    const rep = {
      'transformative ways':'big ways','reshaping industries':'changing industries',
      'revolutionizing':'changing','revolutionize':'change',
      'remarkable accuracy':'really good accuracy','fast-paced markets':'fast markets',
      'innovative tools':'new tools','innovative approach':'new approach',
      'large corporations with extensive teams':'big companies with lots of employees',
      'democratizes':'opens up for everyone','democratize':'open up for everyone',
      'drives innovation':'helps people build new things',
      'harness this synergy':'use these tools together',
      'the future belongs to':'whoever does this will win',
      'unlocks potential':'helps people do more','silver bullet':'magic fix',
      'leave them in the dust':'beat them','unprecedented scale':'a huge scale',
      'eerie precision':'really good accuracy','levels the playing field':'lets anyone compete',
      'game changer':'a big deal','game-changer':'a big deal',
      'redefining':'changing','cutting-edge':'new','state-of-the-art':'the best',
      'superpowers':'a big advantage','outrun the big':'beat the big',
    };
    fixList.push(`DRAMATIC PHRASES — replace each:\n${problems.dramatic.slice(0, 6).map(p => `  • "${p}" → "${rep[p.toLowerCase()] || 'a plain casual phrase'}"`).join('\n')}`);
  }

  if (problems.banned.length > 0) {
    fixList.push(`BANNED WORDS — replace with plain casual words:\n${problems.banned.slice(0, 6).map(w => `  • "${w}"`).join('\n')}`);
  }

  if (problems.aiOpeners.length > 0) {
    fixList.push(`AI OPENERS — rewrite these sentence starts:\n${problems.aiOpeners.slice(0, 4).map(s => `  • "${s.trim().slice(0, 80)}"`).join('\n')}`);
  }

  if (fixList.length === 0) return { text, skipped: true };

  const raw = await mistral(apiKey,
    `Fix ONLY the specific problems listed. Do not rewrite everything else.
WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)}).
━━ FIX THESE ━━\n${fixList.join('\n\n')}\nOutput ONLY the corrected text.`,
    text, 0.55, 3000);

  const scrubbed = hardScrub(raw);
  return { text: await enforceWordCount(apiKey, scrubbed, originalWordCount), skipped: false };
}

// ═══════════════════════════════════════════════════════════════════
//  ROUND 2: Break up essay structure — ALWAYS RUNS
// ═══════════════════════════════════════════════════════════════════
async function round2_breakStructure(apiKey, text, originalWordCount) {
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paraOpenings = paragraphs.map((p, i) => {
    const first = (getSentences(p)[0] || '').trim();
    return `  Para ${i + 1}: "${first.slice(0, 90)}"`;
  }).join('\n');

  const raw = await mistral(apiKey,
    `The text below is still being detected as AI by GPTZero. The main problem is it reads like an organized essay.

REFERENCE — this is what passing (86% human) looks like. One flowing stream, not sections:
"${HUMAN_EXAMPLE_86}"

RULES FOR THIS PASS:
• Do NOT use "here's the thing:", "here's the twist:", or any colon setups
• Do NOT use em dashes (—)
• Do NOT write rhetorical questions like "The barriers? Gone."
• Do NOT write one-word dramatic sentences like "Unstoppable."

YOUR JOB:
1. Merge 2–3 paragraphs together so it flows as one stream of thought
2. Rewrite formal topic sentence openers to be more casual
3. Add connecting words: "also", "and", "but", "so", "now", "plus", "and also"
4. Keep all the same information
5. Word count must stay ${minWords}–${maxWords} words (currently ${wc(text)})

Current paragraph openers:
${paraOpenings}

Output ONLY the result.`,
    text, 0.65, 3000);

  const scrubbed = hardScrub(raw);
  return await enforceWordCount(apiKey, scrubbed, originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  ROUND 3: Add burstiness and casual language — ALWAYS RUNS
// ═══════════════════════════════════════════════════════════════════
async function round3_addBurstiness(apiKey, text, originalWordCount) {
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  const burst = calcBurstiness(text);

  const raw = await mistral(apiKey,
    `Final polish. This text needs to sound more like a real person talking.

REFERENCE — these examples passed GPTZero:
"${HUMAN_EXAMPLE_86}"

RULES FOR THIS PASS:
• Do NOT use "here's the thing:", "here's the twist:", colons as setups
• Do NOT use em dashes (—)
• Do NOT write rhetorical questions
• Do NOT write one-word dramatic sentences
• Do NOT write dramatic contrasts like "Not replacing people. Empowering them."

YOUR JOB:
1. Add 2–3 SHORT plain sentences (4–7 words) to break rhythm.
   Good examples: "That changes everything." / "No one could do this before." / "Anyone can do this now." / "That is the whole point." / "It just makes sense."
   BAD examples (too dramatic): "Unstoppable." / "Game over." / "Period."
2. Find 2–3 smooth polished sentences and make them slightly more casual
3. Replace formal words: "however" → "but", "obtain" → "get", "currently" → "now", "significant" → "big"
4. Word count must stay ${minWords}–${maxWords} words (currently ${wc(text)})
   Current burstiness: ${burst} (target: above 0.45)

Output ONLY the result.`,
    text, 0.70, 3000);

  const scrubbed = hardScrub(raw);
  return await enforceWordCount(apiKey, scrubbed, originalWordCount);
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

  // Step 3: Initial rewrite + hard scrub
  log('3/7', `Rewriting in human voice (${analysis.type} mode)...`);
  let result;
  try {
    result = await initialRewrite(apiKey, inputText, analysis.type, strength || 'aggressive', styleProfile);
    const p = detectProblems(result);
    log('3/7', `Rewrite done: ${wc(result)} words | score=${p.score} | burst=${p.burst}`);
  } catch (e) {
    throw new Error(`Rewrite failed: ${e.message}`);
  }

  // Step 4: Round 1 — fix detectable problems (score-gated)
  {
    const p = detectProblems(result);
    if (p.score <= 2) {
      log('4/7', `Round 1: Score clean (${p.score}) — skipping`);
    } else {
      const summary = [
        p.longSentences.length > 0 ? `long=${p.longSentences.length}` : null,
        p.dramatic.length > 0 ? `dramatic=${p.dramatic.length}` : null,
        p.banned.length > 0 ? `banned=${p.banned.length}` : null,
        p.hasEmDash ? 'em-dash' : null,
      ].filter(Boolean).join(' | ');
      log('4/7', `Round 1: Fix problems (score=${p.score} | ${summary || 'misc'})...`);
      try {
        const fix = await round1_fixProblems(apiKey, result, originalWordCount);
        result = fix.text;
        log('4/7', `After round 1: ${wc(result)} words | score=${detectProblems(result).score} | burst=${calcBurstiness(result)}`);
      } catch (e) {
        log('4/7', `Round 1 failed (${e.message}) — continuing`);
      }
    }
  }

  // Step 5: Round 2 — break essay structure (ALWAYS RUNS)
  log('5/7', 'Round 2: Breaking up essay structure and improving flow...');
  try {
    result = await round2_breakStructure(apiKey, result, originalWordCount);
    log('5/7', `After round 2: ${wc(result)} words | burst=${calcBurstiness(result)}`);
  } catch (e) {
    log('5/7', `Round 2 failed (${e.message}) — continuing`);
  }

  // Step 6: Round 3 — burstiness and casual language (ALWAYS RUNS)
  log('6/7', 'Round 3: Adding burstiness and casual language...');
  try {
    result = await round3_addBurstiness(apiKey, result, originalWordCount);
    log('6/7', `After round 3: ${wc(result)} words | burst=${calcBurstiness(result)}`);
  } catch (e) {
    log('6/7', `Round 3 failed (${e.message}) — continuing`);
  }

  // Final hard scrub before output
  result = hardScrub(result);

  // Step 7: Word count fix
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
• No em dashes (—) ever
• No colon setups like "here's the thing:"
• No rhetorical questions like "Why? Because..."
• No one-word dramatic sentences like "Unstoppable."
• No dramatic contrasts like "Not replacing people. Empowering them."
• Plain casual words: "lots of", "way more", "can't", "used to", "tons of"
• Use "I" and "we" naturally
• State your position at the start, repeat at the end
• Write as one flowing stream, not organized essay paragraphs

${userStyleBlock}

OUTPUT: Return ONLY the answer.`,
    `Question: "${question}"\n\nWrite the answer matching the sentence-by-sentence structure of the template.`,
    0.88, 800);

  const scrubbed = hardScrub(draft);

  log('2/3', 'Checking for remaining AI patterns...');
  const draftSentences = getSentences(scrubbed);
  const finalRaw = await mistral(apiKey,
    `Compare this draft to the human answer and fix anything that diverged.

HUMAN ANSWER:
${humanSentences.map((s, i) => `H${i + 1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

DRAFT:
${draftSentences.map((s, i) => `D${i + 1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

Fix:
1. Any sentence over 18 words — split it
2. Any em dash — replace with period
3. Any dramatically longer sentence than its counterpart — shorten
4. Any journalistic or dramatic phrasing — make plain

Output ONLY the corrected answer.`,
    scrubbed, 0.4, 800);

  const final = hardScrub(finalRaw);
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
