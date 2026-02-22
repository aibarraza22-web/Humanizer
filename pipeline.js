// pipeline.js — Humanizer v15
// Dataset: Human vs AI writing by Aiden vs ChatGPT vs Claude
// AIDEN_EXAMPLES = all Aiden answers — write LIKE these
// AI_COUNTER_EXAMPLES = ChatGPT + Claude answers — write NOTHING like these
// hardScrub() = regex post-processor catching AI casual patterns

import fetch from 'node-fetch';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

// ═══════════════════════════════════════════════════════════════════
//  AIDEN'S REAL ANSWERS — WRITE LIKE THESE
//  These are all 100% human. Direct, personal, opinionated, loose reasoning.
//  "Even when the reasoning is loose" — that's the key. Don't over-connect.
// ═══════════════════════════════════════════════════════════════════
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
  },
  {
    question: "What is AI?",
    answer: `AI stands for artificial intelligence. AI is a technology that allows computers, or anything artificial, to do things similar to human intelligence. AI has been used for a long time like using Machine Learning. For example, machine learning is just giving a computer 100 pictures of apples and 100 pictures of bananas and training it to figure out what the next picture is. What has become much more popular from AI is LLMs, or large language models, things like ChatGPT, Gemini, Claude. These use context to predict what its not letter, word, sentence, paragraph will be. They are trained on the whole internet and use the context of your prompt to decide what should come next in its answer. AI is an umbrella term for many things that are simulating human intelligence.`
  },
  {
    question: "Will AI take my job?",
    answer: `AI will not just take jobs. It make some tasks automated, much easier, or different. That does not mean they will just go away or that everyone will be unemployed. AI will definitely shift jobs though. It can actually make your job a lot better for you. You will shift to managing AI to do your job, directing it, and watching over it. We have seen many examples of this with technological advancements in history. For example, when the computer came, not all the mathmeticians got wiped out, there job just got shifted. In the end, AI will not take you job but shift your job.`
  },
  {
    question: "Can AI be conscious?",
    answer: `I think wether AI could be conscious entirely depends on your definitely of consciousness. Honestly, human brains seem like just complex computers with nuearl networks, and if we are replicating that in real life why cant they me just like us. They different I think is natural lived experience, but once complex robots with chatbots come in, there may be no difference. I think there is this human inclination to say no Ai can never be like us, or be conscious, but when you really think about it, how are they different then us. As long as they have complex neural networks, which we are making them just like the human brain, how are they different from us? Humans have a creator, AI has a creator. Humans evolve and grow, AI evolves and grows. Honestly, at a certain point I definitely think AI can be conscious. At a certain point of simulationg something artificially to be so similar to the human brain, there can be no difference. They don't have things like emotions, or the full human brain so they are not conscious. Thats just for now though.`
  }
];

// ═══════════════════════════════════════════════════════════════════
//  AI COUNTER-EXAMPLES — DO NOT WRITE LIKE THESE
//  These are ChatGPT and Claude answers from the same dataset.
//  Showing the model exactly what to avoid is as important as showing
//  it what to aim for.
// ═══════════════════════════════════════════════════════════════════
const AI_COUNTER_EXAMPLES = [
  {
    label: "ChatGPT — structured, numbered lists, balanced, no personality",
    sample: `First, analysis is getting automated at scale. Startups can now process earnings calls, SEC filings, alternative data, satellite imagery, transaction flows, and macro signals in real time using machine learning. Second, prediction quality is becoming the edge. AI allows startups to build forecasting engines for credit risk, fraud detection, underwriting, and trading strategies that adapt continuously. Third, personalization is becoming scalable. Fourth, automation is flattening operational costs. Fifth, data moats are shifting.`
  },
  {
    label: "ChatGPT — measured, hedged, no position taken",
    sample: `Over the next 20 years, artificial intelligence will likely both replace and create jobs, but most economists expect it to create new categories of work even as it automates existing tasks. Historically, major technologies like electricity and the internet displaced workers in the short term but expanded the overall economy and created more complex, higher-skilled work over time.`
  },
  {
    label: "ChatGPT — balanced both sides, never commits",
    sample: `The United States faces a constant balance between strengthening itself at home and projecting power abroad, and most serious policy debates are really about how to prioritize both, not choosing one exclusively. The most sustainable approach is strengthening domestic capacity while remaining strategically engaged internationally.`
  },
  {
    label: "Claude — long, nuanced, maps competing perspectives, qualifiers everywhere",
    sample: `This is one of the most contested questions in economics right now, and the truth is nobody knows with confidence. History offers some reassurance — past waves of automation ultimately created more jobs than they destroyed. The optimistic case holds that AI will follow the same pattern. The pessimistic case argues that this time is genuinely different. Most economists land somewhere in the middle.`
  },
  {
    label: "Claude — intellectually careful, lots of 'however' and 'but'",
    sample: `Not automatically, though the relationship is real and historically significant. Technological advantage has repeatedly translated into geopolitical power. But technological leadership doesn't mechanically convert into lasting political dominance for several reasons. First, technology diffuses. Second, political power depends on many things technology can't easily buy. Third, the nature of the technology matters.`
  },
  {
    label: "Claude — colon lists, headers, comprehensive",
    sample: `AI is reshaping startup competition in financial services in some pretty fundamental ways. Here's what's driving the shift: Leveling the playing field on data — Traditionally, incumbents had a massive moat. Credit and underwriting — This is probably where AI has had the sharpest impact. Cost structure compression — AI-driven automation lets fintech startups operate with dramatically leaner teams.`
  },
  {
    label: "ChatGPT — right now AI is not conscious, definitive but flat",
    sample: `Right now, AI is not conscious. It can process information, recognize patterns, and generate responses that sound thoughtful, but it does not have self-awareness, emotions, subjective experience, or an inner sense of being. Some researchers debate whether advanced systems could ever develop forms of machine consciousness in the future, but there is no scientific evidence that today's AI has genuine awareness rather than sophisticated pattern recognition.`
  },
  {
    label: "Claude — open question framing, philosophical hedging",
    sample: `Nobody knows, and the question is deeper and harder than it might first appear. Consciousness remains one of the least understood phenomena in science and philosophy. The hard problem is that there's no clear test for consciousness — you can't measure it from the outside the way you can measure temperature or speed. It's a genuinely open question, which is either exciting or unsettling depending on how you look at it.`
  }
];

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
//  HARD SCRUB — regex post-processor, runs on every LLM output
//  Catches AI-trying-to-sound-casual patterns the model generates itself
// ═══════════════════════════════════════════════════════════════════
function hardScrub(text) {
  let t = text;

  // Em dashes → period + new sentence
  t = t.replace(/\s*—\s*/g, '. ');

  // "Here's the X:" setup phrases
  t = t.replace(/here's the (real |)?(twist|thing|deal|catch|key|truth|problem|issue|point)[:\s]/gi, 'The thing is, ');
  t = t.replace(/but here's (the |)(real |)?(twist|thing|deal|catch|key|truth)[:\s]/gi, 'But the thing is, ');
  t = t.replace(/here's (what|why|how)[:\s]/gi, '');
  t = t.replace(/the (bottom line|key takeaway|main point|real answer)[:\s]/gi, 'The main point is ');

  // Rhetorical questions + answer pattern
  t = t.replace(/([A-Z][^.!?]{2,30})\?\s+(Yeah,?\s+)?(they're|it's|that's|he's|she's|we're|they are|it is)/gi,
    (match, subject, yeah, verb) => `${subject} ${verb}`);
  t = t.replace(/\b(Now|Why|How|What|When|Where)\?\s+/g, '');

  // One-word dramatic standalone sentences
  const dramaticOneWord = [
    'Unstoppable','Remarkable','Extraordinary','Revolutionary','Transformative',
    'Unprecedented','Incredible','Unbelievable','Fascinating','Stunning',
    'Period','Full stop','Simple as that','End of story','Case closed',
    'Mind-blowing','Game-changing','Game changing','That simple','That easy','That big'
  ];
  for (const word of dramaticOneWord) {
    const pattern = new RegExp(`(\\.|\\n|^)\\s*${word}\\.\\s*`, 'gi');
    t = t.replace(pattern, (match, pre) => `${pre} `);
  }

  // Colon list setups mid-sentence
  t = t.replace(/[Bb]ut here's what('s| has) changed:\s*/g, 'But ');
  t = t.replace(/[Hh]ere's why:\s*/g, 'Because ');
  t = t.replace(/[Hh]ere's how:\s*/g, '');

  // Dramatic contrast sentences "Not X. Y them."
  t = t.replace(/\bNot (replacing|removing|eliminating|cutting|reducing)\s+([^.]+)\.\s+([A-Z][^.]+ing)\s+them\./g,
    "It's not about $1 $2. It's about $3 them.");

  // Clean up
  t = t.replace(/\.\.+/g, '.');
  t = t.replace(/\s{2,}/g, ' ');
  t = t.replace(/\.\s*\./g, '.');
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
    /^(AI is|Finance is|Startups are|The future|This shift|This allows|This enables)/i,
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

// Build the full positive + negative example blocks for prompts
function buildExampleBlocks(numPositive = 4, numNegative = 3) {
  const positiveBlock = AIDEN_EXAMPLES.slice(0, numPositive)
    .map((e, i) => `[HUMAN EXAMPLE ${i + 1} — Q: "${e.question}"]\n"${e.answer}"`)
    .join('\n\n');

  const negativeBlock = AI_COUNTER_EXAMPLES.slice(0, numNegative)
    .map((e, i) => `[AI EXAMPLE ${i + 1} — ${e.label}]\n"${e.sample}"`)
    .join('\n\n');

  return { positiveBlock, negativeBlock };
}

// ═══════════════════════════════════════════════════════════════════
//  STEP 3: Initial rewrite
// ═══════════════════════════════════════════════════════════════════
async function initialRewrite(apiKey, inputText, inputType, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);
  const temps = { aggressive: 0.92, standard: 0.82, subtle: 0.70 };
  const { positiveBlock, negativeBlock } = buildExampleBlocks(4, 3);
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const extraGuidance = inputType === 'analysis'
    ? `EXTRA FOR ANALYSIS TEXT:
Reframe explanations as personal reactions. Sound like someone telling you something they find interesting.
"AI reduces barriers" → "Anyone can do this now. The barriers are gone."
"Studies show 40% gains" → "The productivity numbers are real. We're talking 40% gains."`
    : `EXTRA FOR OPINION TEXT:
Take a clear side. State it at the start. Repeat it at the end.
Use "I" and "we" naturally. Say what you actually think, directly.`;

  const system = `You are rewriting text to pass GPTZero AI detection. Your output must look like it was typed by a real student — specifically this student named Aiden.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AIDEN'S REAL WRITING — WRITE EXACTLY LIKE THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${positiveBlock}

WHY AIDEN'S WRITING PASSES GPTZERO:
• Short direct sentences — gets to the point immediately
• Takes a strong position and repeats it — no hedging, no "on the other hand"
• Personal references: "When I start my startup...", "I think..."
• Slightly loose reasoning — not every sentence perfectly connects to the next (this is KEY)
• Casual imperfect phrases: "lots of funding", "anyone and everyone", "way behind"
• Real specific examples from his own life or knowledge
• Writes the way people actually talk, not the way people write essays

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI WRITING — NEVER WRITE LIKE THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${negativeBlock}

WHY AI WRITING FAILS GPTZERO:
• Numbered lists: "First... Second... Third..." = instant AI detection
• Balanced both sides: "On one hand... on the other hand..." = AI trying to be fair
• Never takes a clear position — always hedges with "likely", "probably", "most economists"
• Perfect logical flow — every sentence connects to the next too cleanly
• Colon setups: "Here's what's driving the shift:" = AI
• Too comprehensive — covers every angle, leaves nothing out

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NO SENTENCE OVER 18 WORDS.
2. NO EM DASHES (—). Use a period instead.
3. NO COLON SETUPS. No "here's the thing:", "here's the twist:", "the real point:"
4. NO RHETORICAL QUESTIONS. No "Why? Because...", "The answer? Simple."
5. NO ONE-WORD DRAMATIC SENTENCES. No "Unstoppable." "Period." "Remarkable."
6. NO NUMBERED OR BULLETED LISTS. Never "First... Second... Third..."
7. NO HEDGING. Don't say "likely", "probably", "most experts think". Take a position.
8. NO BALANCED BOTH-SIDES. Don't present the counterargument unless Aiden would.
9. NO STRUCTURED ESSAY PARAGRAPHS. Write as one flowing stream of thought.
10. PLAIN CASUAL WORDS: "lots of" not "numerous", "way faster" not "significantly faster"
11. WORD COUNT: ${minWords}–${maxWords} words.

${extraGuidance}
${userStyleBlock}

OUTPUT: Return ONLY the rewritten text.`;

  const raw = await mistral(apiKey, system,
    `Rewrite this text in Aiden's voice:\n\n${inputText}`,
    temps[strength || 'aggressive'], 3000);

  return await enforceWordCount(apiKey, hardScrub(raw), wordTarget);
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
      'democratizes':'opens up for everyone','democratize':'open up for everyone',
      'drives innovation':'helps people build new things',
      'the future belongs to':'whoever does this will win',
      'unlocks potential':'helps people do more','silver bullet':'magic fix',
      'leave them in the dust':'beat them','unprecedented scale':'a huge scale',
      'levels the playing field':'lets anyone compete',
      'game changer':'a big deal','game-changer':'a big deal',
      'redefining':'changing','cutting-edge':'new','state-of-the-art':'the best',
      'superpowers':'a big advantage','outrun the big':'beat the big',
    };
    fixList.push(`DRAMATIC PHRASES — replace each:\n${problems.dramatic.slice(0, 6).map(p => `  • "${p}" → "${rep[p.toLowerCase()] || 'a plain casual phrase'}"`).join('\n')}`);
  }

  if (problems.banned.length > 0) {
    fixList.push(`BANNED WORDS:\n${problems.banned.slice(0, 6).map(w => `  • "${w}"`).join('\n')}`);
  }

  if (problems.aiOpeners.length > 0) {
    fixList.push(`AI OPENERS — rewrite these:\n${problems.aiOpeners.slice(0, 4).map(s => `  • "${s.trim().slice(0, 80)}"`).join('\n')}`);
  }

  if (fixList.length === 0) return { text, skipped: true };

  const raw = await mistral(apiKey,
    `Fix ONLY the specific problems listed. Do not rewrite everything else.
WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)}).
━━ FIX THESE ━━\n${fixList.join('\n\n')}\nOutput ONLY the corrected text.`,
    text, 0.55, 3000);

  return { text: await enforceWordCount(apiKey, hardScrub(raw), originalWordCount), skipped: false };
}

// ═══════════════════════════════════════════════════════════════════
//  ROUND 2: Break up essay structure — ALWAYS RUNS
// ═══════════════════════════════════════════════════════════════════
async function round2_breakStructure(apiKey, text, originalWordCount) {
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  const { positiveBlock } = buildExampleBlocks(2, 0);

  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paraOpenings = paragraphs.map((p, i) => {
    const first = (getSentences(p)[0] || '').trim();
    return `  Para ${i + 1}: "${first.slice(0, 90)}"`;
  }).join('\n');

  const raw = await mistral(apiKey,
    `This text is still being detected as AI. The problem is it reads like an organized essay.

REFERENCE — Aiden's real writing that passes GPTZero:
${positiveBlock}

Notice: Aiden's writing flows as one stream of thought. He doesn't write in organized sections. His reasoning is sometimes a little loose — not every sentence perfectly connects.

RULES FOR THIS PASS:
• Do NOT use em dashes (—)
• Do NOT use colon setups
• Do NOT write rhetorical questions
• Do NOT use numbered lists

YOUR JOB:
1. Merge 2–3 paragraphs together so it flows as one stream of thought
2. Rewrite formal topic sentence openers to be more casual
3. Add connecting words: "also", "and", "but", "so", "now", "plus", "and also"
4. Let some sentences be slightly loose — not perfectly connecting to the next one
5. Word count must stay ${minWords}–${maxWords} words (currently ${wc(text)})

Current paragraph openers:
${paraOpenings}

Output ONLY the result.`,
    text, 0.65, 3000);

  return await enforceWordCount(apiKey, hardScrub(raw), originalWordCount);
}

// ═══════════════════════════════════════════════════════════════════
//  ROUND 3: Add burstiness and casual language — ALWAYS RUNS
// ═══════════════════════════════════════════════════════════════════
async function round3_addBurstiness(apiKey, text, originalWordCount) {
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);
  const burst = calcBurstiness(text);
  const aiExamplesBlock = AI_COUNTER_EXAMPLES.slice(0, 2)
    .map(e => `[AVOID — ${e.label}]\n"${e.sample}"`)
    .join('\n\n');

  const raw = await mistral(apiKey,
    `Final polish. This text needs to sound more like a real person talking and less like AI.

WHAT AI SOUNDS LIKE — DO NOT WRITE LIKE THIS:
${aiExamplesBlock}

YOUR JOB:
1. Add 2–3 SHORT plain sentences (4–7 words) to break up the rhythm.
   Good: "That changes everything." / "No one could do this before." / "Anyone can do this now." / "That is the whole point." / "It just makes sense." / "That is a big deal."
   Bad (still AI): "Unstoppable." / "Period." / "Game over." — too dramatic
2. Find 2–3 sentences that sound too smooth or polished — make them slightly more casual
3. Replace formal words: "however" → "but", "obtain" → "get", "currently" → "now", "significant" → "big", "individuals" → "people"
4. Word count must stay ${minWords}–${maxWords} words (currently ${wc(text)})
   Current burstiness: ${burst} (target: above 0.45)

Output ONLY the result.`,
    text, 0.70, 3000);

  return await enforceWordCount(apiKey, hardScrub(raw), originalWordCount);
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
  log('3/7', `Rewriting in Aiden's voice (${analysis.type} mode)...`);
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

  // Final hard scrub
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

  // Step 1/3: Write initial draft
  log('1/3', 'Finding closest human example...');
  const closest = findClosestAidenExample(question);
  log('1/3', `Using "${closest.question}" as template — writing draft...`);

  const humanSentences = getSentences(closest.answer);
  const allAidenText = AIDEN_EXAMPLES.map((e, i) => `[HUMAN ${i + 1} — Q: "${e.question}"]\n"${e.answer}"`).join('\n\n');
  const aiExamplesBlock = AI_COUNTER_EXAMPLES.slice(0, 3).map(e => `[AVOID — ${e.label}]\n"${e.sample}"`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';
  const sentenceBreakdown = humanSentences.map((s, i) => `  S${i + 1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n');

  const draftRaw = await mistral(apiKey,
    `Answer a question in Aiden's exact voice. Study all his real answers carefully.

AIDEN'S REAL ANSWERS — WRITE EXACTLY LIKE THESE:
${allAidenText}

AI WRITING TO AVOID — DO NOT WRITE LIKE THIS:
${aiExamplesBlock}

STRUCTURAL TEMPLATE — match this sentence-by-sentence pattern:
${sentenceBreakdown}

KEY TRAITS OF AIDEN'S VOICE:
• Takes a strong clear position immediately — no hedging
• Short direct sentences
• Personal references: "I think", "When I...", "We"
• Slightly loose reasoning — not every sentence perfectly connects (this is normal and human)
• Casual words: "lots of", "way behind", "anyone and everyone", "a lot of"
• Repeats his main point at the end

RULES:
• Every sentence under 18 words
• No em dashes (—) — use a period instead
• No colon setups: "here's the thing:", "here's the twist:"
• No rhetorical questions
• No one-word dramatic sentences
• No numbered lists
• No hedging — take a position

${userStyleBlock}

OUTPUT: Return ONLY the answer.`,
    `Question: "${question}"\n\nWrite the answer matching the sentence-by-sentence structure of the template.`,
    0.88, 800);

  let result = hardScrub(draftRaw);
  log('1/3', `Draft done: ${wc(result)} words | burst=${calcBurstiness(result)}`);

  // Step 2/3: Fix AI patterns and improve flow
  log('2/3', 'Fixing AI patterns and improving flow...');
  try {
    const targetWC = wc(result);
    const minWords = Math.floor(targetWC * 0.90);
    const maxWords = Math.ceil(targetWC * 1.10);

    const fixedRaw = await mistral(apiKey,
      `This answer may still be detected as AI. Fix it to sound more like Aiden.

AIDEN'S REAL WRITING (copy this voice):
${AIDEN_EXAMPLES.slice(0, 3).map((e, i) => `[${i + 1}] "${e.answer}"`).join('\n\n')}

KEY: Aiden's reasoning is sometimes loose. Not every sentence perfectly connects. That's normal and human.

RULES:
• No em dashes (—)
• No colon setups
• No rhetorical questions
• No one-word sentences
• No numbered lists
• No hedging

YOUR JOB:
1. Bring the draft closer to Aiden's voice
2. If it has clean organized paragraphs, merge them into one flowing stream
3. Add casual connecting words: "also", "and", "but", "so", "now", "plus"
4. Let some sentences be slightly loose
5. Word count must stay ${minWords}–${maxWords} words (currently ${wc(result)})

Output ONLY the corrected answer.`,
      result, 0.60, 1000);

    result = hardScrub(fixedRaw);
    result = await enforceWordCount(apiKey, result, targetWC);
    log('2/3', `After fix: ${wc(result)} words | burst=${calcBurstiness(result)}`);
  } catch (e) {
    log('2/3', `Fix pass failed (${e.message}) — continuing`);
  }

  // Step 3/3: Add burstiness
  log('3/3', 'Adding burstiness and final polish...');
  try {
    const targetWC = wc(result);
    const minWords = Math.floor(targetWC * 0.90);
    const maxWords = Math.ceil(targetWC * 1.10);
    const burst = calcBurstiness(result);

    const burstRaw = await mistral(apiKey,
      `Final polish. Add short punchy sentences to make this sound more like a real person.

RULES:
• No em dashes (—)
• No colon setups
• No rhetorical questions or one-word sentences

YOUR JOB:
1. Add 1–2 SHORT sentences (4–7 words) to break up the rhythm.
   Good: "That is the whole point." / "Anyone can do this now." / "It just makes sense." / "That changes everything." / "That is a big deal."
   Bad: "Unstoppable." / "Period." — too dramatic, still AI
2. Find 1–2 sentences that sound too polished and make them more casual
3. Replace formal words: "however" → "but", "obtain" → "get", "currently" → "now"
4. Word count must stay ${minWords}–${maxWords} words (currently ${wc(result)})
   Current burstiness: ${burst} (target: above 0.4)

Output ONLY the result.`,
      result, 0.70, 800);

    result = hardScrub(burstRaw);
    result = await enforceWordCount(apiKey, result, targetWC);
    log('3/3', `Final: ${wc(result)} words | burst=${calcBurstiness(result)}`);
  } catch (e) {
    log('3/3', `Burst pass failed — keeping previous`);
  }

  result = hardScrub(result);

  return {
    text: result,
    scores: {
      bannedWordsFound: countBanned(result),
      aiOpenersFound: countAIOpeners(result).length,
      burstiness: calcBurstiness(result),
      wordCount: wc(result)
    }
  };
}
