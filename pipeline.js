// ═══════════════════════════════════════════════════════════════════
//  pipeline.js — Humanizer pipeline using Mistral AI
//  No Reddit scraping. Uses HuggingFace human writing dataset.
//  Core approach: sentence-structure imitation from Aiden's real writing.
// ═══════════════════════════════════════════════════════════════════

import fetch from 'node-fetch';

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

// ─── Aiden's real answers — the structural templates ─────────────────────────
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
  if (!res.ok) {
    const errMsg = data.message || data.error?.message || JSON.stringify(data);
    throw new Error(`Mistral API error: ${errMsg}`);
  }
  if (!data.choices || !data.choices[0]) {
    throw new Error(`Unexpected Mistral response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.choices[0].message.content.trim();
}

// ─── Fetch real human writing samples from HuggingFace dataset ───────────────
// gsingh1-py/train has 7321 rows of real human writing in Human_story column
let cachedHumanSamples = null;
async function getHumanSamples() {
  if (cachedHumanSamples) return cachedHumanSamples;
  try {
    const url = 'https://datasets-server.huggingface.co/rows?dataset=gsingh1-py%2Ftrain&config=default&split=train&offset=0&length=100';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HF API returned ${res.status}`);
    const data = await res.json();
    const rows = data.rows || [];
    const samples = rows
      .map(r => r.row?.Human_story || '')
      .filter(s => s && s.length > 100 && s.length < 800)
      .map(s => s.replace(/\s+/g, ' ').trim());
    cachedHumanSamples = samples;
    console.log(`  → Loaded ${samples.length} human writing samples from HuggingFace`);
    return samples;
  } catch (e) {
    console.log(`  → HuggingFace fetch failed: ${e.message} — using Aiden examples only`);
    return [];
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function wc(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function getSentences(text) {
  return (text.match(/[^.!?]+[.!?]+/g) || [text]).map(s => s.trim()).filter(s => s.length > 0);
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

// ─── Find Aiden example by question similarity ────────────────────────────────
function findClosestAidenExample(question) {
  const q = question.toLowerCase();
  const qWords = q.split(/\s+/).filter(w => w.length > 3);

  const scored = AIDEN_EXAMPLES.map((ex, i) => {
    const exWords = ex.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const exact = qWords.filter(w => exWords.includes(w)).length;
    const partial = qWords.filter(w => exWords.some(ew => ew.includes(w) || w.includes(ew))).length;
    return { i, score: exact * 2 + partial };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const prefer = [4, 1, 2, 3, 0, 5];
    return prefer.indexOf(a.i) - prefer.indexOf(b.i);
  });

  return AIDEN_EXAMPLES[scored[0].i];
}

// ─── Find Aiden example closest in sentence count ────────────────────────────
function findClosestByLength(inputText) {
  const inputCount = getSentences(inputText).length;
  return AIDEN_EXAMPLES.reduce((best, ex) => {
    const exCount = getSentences(ex.answer).length;
    const bestCount = getSentences(best.answer).length;
    return Math.abs(exCount - inputCount) < Math.abs(bestCount - inputCount) ? ex : best;
  });
}

function sentenceBreakdown(text) {
  return getSentences(text)
    .map((s, i) => `  S${i + 1} [${s.split(/\s+/).length}w]: "${s}"`)
    .join('\n');
}

// ─── Hard trim guard ──────────────────────────────────────────────────────────
async function hardTrim(apiKey, text, targetWC) {
  if (!text || !text.trim()) throw new Error('hardTrim received empty text');
  const current = wc(text);
  if (current <= Math.ceil(targetWC * 1.15)) return text;
  console.log(`  → Hard trim: ${current} → ~${targetWC} words`);
  const result = await mistral(apiKey,
    `Trim this text from ${current} to approximately ${targetWC} words. Remove repeated ideas and filler. Keep all unique arguments. Output ONLY the trimmed text.`,
    text, 0.3, targetWC * 3);
  return result;
}

// ─── Build shared style block used in all prompts ────────────────────────────
function buildStyleBlock(humanSamples = []) {
  const allAidenText = AIDEN_EXAMPLES.map((e, i) =>
    `[HUMAN EXAMPLE ${i + 1} — Q: "${e.question}"]\n${e.answer}`
  ).join('\n\n');

  const aiText = AI_EXAMPLES.map(e => `[${e.label}]\n${e.sample}`).join('\n\n');

  const samplesBlock = humanSamples.length > 0
    ? '\n━━━ ADDITIONAL REAL HUMAN WRITING (from dataset) ━━━\n' +
      shuffle(humanSamples).slice(0, 8).map((s, i) => `[${i+1}] "${s.slice(0, 300)}"`).join('\n')
    : '';

  return `━━━ REAL HUMAN WRITING — IMITATE THIS VOICE ━━━
${allAidenText}
${samplesBlock}

━━━ AI WRITING — DO NOT SOUND LIKE THIS ━━━
${aiText}`;
}

function buildUserStyleBlock(profile) {
  if (!profile) return '';
  const rules = [];
  const s = (profile.summary || '').toLowerCase();
  if (s.includes('rarely or never use contractions')) rules.push('Avoid contractions');
  else if (s.includes('always use contractions')) rules.push("Use contractions freely");
  if (s.includes('very casual')) rules.push('Very casual tone');
  if (s.includes('formal')) rules.push('More formal tone');
  if (profile.examples?.length) {
    return `\n━━ USER'S OWN WRITING ━━\n${profile.examples.map((s, i) => `${i+1}. ${s}`).join('\n')}\n${rules.map(r => `• ${r}`).join('\n')}`;
  }
  return rules.length ? `\n━━ STYLE NOTES ━━\n${rules.map(r => `• ${r}`).join('\n')}` : '';
}

// ═══════════════════════════════════════════════════════════════════
//  HUMANIZE PIPELINE — 7 passes
// ═══════════════════════════════════════════════════════════════════

// ─── Pass 1: Extract topic ────────────────────────────────────────────────────
async function pass1_extractTopic(apiKey, text) {
  const raw = await mistral(apiKey,
    `Extract the core topic and a short search phrase from this text.
Return JSON only, no other text:
{"topic":"short topic name","keywords":"3 to 5 words total"}
Keywords must be 3-5 words total. One phrase only.`,
    text.slice(0, 500), 0.1, 100);
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.keywords && parsed.keywords.split(/\s+/).length > 6) {
      parsed.keywords = parsed.keywords.split(/\s+/).slice(0, 5).join(' ');
    }
    return parsed;
  } catch {
    return { topic: 'general topic', keywords: 'essay writing' };
  }
}

// ─── Pass 2: Fetch human examples ────────────────────────────────────────────
// (HuggingFace dataset — no Reddit)

// ─── Pass 3: Rewrite using structural imitation ───────────────────────────────
async function pass3_rewrite(apiKey, inputText, humanSamples, strength, styleProfile) {
  const wordTarget = wc(inputText);
  const minWords = Math.floor(wordTarget * 0.93);
  const maxWords = Math.ceil(wordTarget * 1.07);
  const temps = { aggressive: 0.95, standard: 0.85, subtle: 0.72 };

  const template = findClosestByLength(inputText);
  const templateBreakdown = sentenceBreakdown(template.answer);
  const styleBlock = buildStyleBlock(humanSamples);
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  const result = await mistral(apiKey, `${styleBlock}

━━━ YOUR STRUCTURAL TEMPLATE ━━━
This is how a real human structured a similar piece — sentence by sentence:
${templateBreakdown}

For each sentence in the input text, express the same idea but:
- Match the template sentence's length (±3 words)
- Write it the way the real human above would say it
- State things directly — don't explain or hedge
- Use plain casual words, not academic vocabulary

━━━ WORD COUNT — STRICT ━━━
Input: ${wordTarget} words. Output MUST be ${minWords}–${maxWords} words. No new ideas.

━━━ NEVER DO ━━━
• "Here's what..." or "Here's why..." setups
• Hedging: arguably, it could be said, one might argue
• Numbered structure: First... Second... Third...
• Long sentences over 20 words
• Em dashes for effect
• These words: ${BANNED.slice(0, 25).join(', ')}

${userStyleBlock}

OUTPUT: Return ONLY the rewritten text.`,
    `Rewrite this text:\n\n${inputText}`,
    temps[strength], 3000);

  return await hardTrim(apiKey, result, wordTarget);
}

// ─── Pass 4: Splice real human sentences ─────────────────────────────────────
async function pass4_splice(apiKey, text, humanSamples, originalWordCount) {
  const sentences = humanSamples
    .flatMap(s => (s.match(/[^.!?]+[.!?]+/g) || []))
    .map(s => s.trim())
    .filter(s => {
      const w = s.split(/\s+/).length;
      return w >= 8 && w <= 30;
    })
    .filter(s => s.length > 20);

  if (sentences.length < 5) {
    console.log('  → Not enough human sentences for splicing — skipping');
    return text;
  }

  const selected = shuffle(sentences).slice(0, 15);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const result = await mistral(apiKey,
    `Replace the 3 most AI-sounding sentences in this text with real human-written sentences from the list below.

Real human sentences:
${selected.map((s, i) => `${i+1}. "${s}"`).join('\n')}

Rules:
1. Find the 3 smoothest, most formulaic sentences
2. Replace each with a sentence from the list that fits contextually
3. Lightly adapt if needed — keep 75%+ of the original wording
4. Do not change any other sentences
5. Keep output between ${minWords} and ${maxWords} words

Output ONLY the edited text.`,
    `Edit this text:\n\n${text}`,
    0.45, 3000);

  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── Pass 5: Scrub AI patterns ────────────────────────────────────────────────
async function pass5_scrub(apiKey, text, humanSamples, originalWordCount) {
  const { banned, aiOpeners } = scoreText(text);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const problems = [];
  if (banned.length > 0) problems.push(`Replace banned words: ${banned.join(', ')}`);
  if (aiOpeners.length > 0) problems.push(`Rewrite AI openers:\n${aiOpeners.slice(0, 4).map(s => `  • "${s}"`).join('\n')}`);

  const sample = humanSamples.length > 0
    ? '\nReal human writing for reference:\n' + shuffle(humanSamples).slice(0, 3).map((s, i) => `[${i+1}] "${s.slice(0, 200)}"`).join('\n')
    : '';

  const result = await mistral(apiKey,
    `Fix specific AI patterns in this text. Every change is a swap — never add content.

⚠️ WORD COUNT: ${wc(text)} words. Must stay ${minWords}–${maxWords} words.

${problems.length > 0 ? 'PROBLEMS:\n' + problems.join('\n') : 'No critical problems — apply improvements below.'}

ALWAYS FIX:
1. Find 3 sentences where every word is the obvious expected choice — replace 2-3 words with less predictable but natural alternatives
2. Find 2 sentences that explain something — rewrite them to state it instead
3. Find any hedging sentence — make it take a clear side
4. Find any comma list of 3+ concepts — restructure into separate sentences
${sample}

Output ONLY the fixed text.`,
    `Fix this text:\n\n${text}`,
    0.68, 3000);

  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── Pass 6: Verify ───────────────────────────────────────────────────────────
async function pass6_verify(apiKey, text, originalText, humanSamples) {
  const { banned, aiOpeners, burst } = scoreText(text);
  const originalWordCount = wc(originalText);
  const minWords = Math.floor(originalWordCount * 0.93);
  const maxWords = Math.ceil(originalWordCount * 1.07);

  const template = findClosestByLength(text);

  const result = await mistral(apiKey,
    `Compare this text against real human writing sentence by sentence and fix anything still AI-sounding.

REAL HUMAN WRITING (structural reference):
${sentenceBreakdown(template.answer)}

⚠️ WORD COUNT: Must stay ${minWords}–${maxWords} words (currently ${wc(text)}). Swap only.

For each sentence, check:
- Is it direct and confident like the human? Fix if not.
- Does it use plain words? Fix academic vocabulary.
- Does it STATE rather than EXPLAIN? Fix if explaining.

Also fix:
- Banned words: ${banned.length > 0 ? banned.join(', ') : 'none'}
- AI openers: ${aiOpeners.length > 0 ? aiOpeners.slice(0,3).map(s=>s.trim()).join(' | ') : 'none'}
- Sentence variety: burstiness=${burst}${burst < 0.45 ? ' (TOO LOW — vary lengths more)' : ' (ok)'}

Output ONLY the corrected text.`,
    text, 0.72, 3000);

  return await hardTrim(apiKey, result, originalWordCount);
}

// ─── Pass 7: Word count fix ───────────────────────────────────────────────────
async function pass7_wordCount(apiKey, text, originalWordCount) {
  const current = wc(text);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  if (current >= min && current <= max) return text;

  if (current > max) {
    return await mistral(apiKey,
      `Trim this text from ${current} to between ${min} and ${max} words. Cut filler, shorten sentences, remove repeated ideas. Keep all unique arguments. Output ONLY the trimmed text.`,
      text, 0.3, max * 3);
  } else {
    return await mistral(apiKey,
      `Expand this text from ${current} to between ${min} and ${max} words. Add a concrete detail to 1-2 existing points. Do not add new arguments. Output ONLY the expanded text.`,
      text, 0.5, max * 3);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN HUMANIZE EXPORT
// ═══════════════════════════════════════════════════════════════════
export async function humanize(apiKey, inputText, strength, styleProfile, onProgress) {
  const log = (step, msg) => {
    const full = `[${step}] ${msg}`;
    console.log(' ' + full);
    if (onProgress) onProgress({ step, msg });
  };

  if (!apiKey) throw new Error('No API key provided');
  if (!inputText || !inputText.trim()) throw new Error('No input text provided');

  const originalWordCount = wc(inputText);
  console.log(`\n=== HUMANIZE START === ${originalWordCount} words ===`);

  // Pass 1
  log('1/7', `Analyzing topic... (${originalWordCount} words)`);
  let topicData;
  try {
    topicData = await pass1_extractTopic(apiKey, inputText);
    log('1/7', `Topic: "${topicData.topic}" | Keywords: "${topicData.keywords}"`);
  } catch (e) {
    log('1/7', `Topic extraction failed: ${e.message} — using defaults`);
    topicData = { topic: 'general', keywords: 'essay writing' };
  }

  // Pass 2
  log('2/7', 'Loading human writing examples...');
  let humanSamples = [];
  try {
    humanSamples = await getHumanSamples();
    log('2/7', `Loaded ${humanSamples.length} human writing samples`);
  } catch (e) {
    log('2/7', `Examples load failed: ${e.message} — continuing without`);
  }

  // Pass 3
  log('3/7', 'Rewriting using human sentence structure...');
  let result;
  try {
    result = await pass3_rewrite(apiKey, inputText, humanSamples, strength || 'aggressive', styleProfile);
    const s = scoreText(result);
    log('3/7', `After rewrite: ${wc(result)} words (target: ${originalWordCount}) | burstiness=${s.burst} | banned=${s.banned.length} | ai-openers=${s.aiOpeners.length}`);
  } catch (e) {
    throw new Error(`Pass 3 (rewrite) failed: ${e.message}`);
  }

  // Pass 4
  log('4/7', 'Splicing real human sentences...');
  try {
    result = await pass4_splice(apiKey, result, humanSamples, originalWordCount);
    const s = scoreText(result);
    log('4/7', `After splice: ${wc(result)} words | burstiness=${s.burst} | banned=${s.banned.length}`);
  } catch (e) {
    log('4/7', `Splice failed: ${e.message} — continuing`);
  }

  // Pass 5
  log('5/7', 'Scrubbing remaining AI patterns...');
  try {
    result = await pass5_scrub(apiKey, result, humanSamples, originalWordCount);
    const s = scoreText(result);
    log('5/7', `After scrub: ${wc(result)} words | burstiness=${s.burst} | banned=${s.banned.length} | ai-openers=${s.aiOpeners.length}`);
  } catch (e) {
    log('5/7', `Scrub failed: ${e.message} — continuing`);
  }

  // Pass 6
  log('6/7', 'Verification pass...');
  try {
    result = await pass6_verify(apiKey, result, inputText, humanSamples);
    const s = scoreText(result);
    log('6/7', `After verify: ${wc(result)} words | burstiness=${s.burst} | banned=${s.banned.length}`);
  } catch (e) {
    log('6/7', `Verify failed: ${e.message} — continuing`);
  }

  // Pass 7
  const currentWC = wc(result);
  const min = Math.floor(originalWordCount * 0.93);
  const max = Math.ceil(originalWordCount * 1.07);
  if (currentWC < min || currentWC > max) {
    log('7/7', `Word count out of range (${currentWC}, need ${min}–${max}) — correcting...`);
    try {
      result = await pass7_wordCount(apiKey, result, originalWordCount);
      log('7/7', `Final: ${wc(result)} words`);
    } catch (e) {
      log('7/7', `Word count fix failed: ${e.message}`);
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
      examplesUsed: humanSamples.length,
      originalWordCount,
      outputWordCount: wc(result),
      wordCountDelta: Math.round((wc(result) - originalWordCount) / originalWordCount * 100) + '%',
      humanExampleSources: ['HuggingFace human dataset']
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
  if (!question || !question.trim()) throw new Error('No question provided');

  console.log(`\n=== ANSWER START === "${question}" ===`);

  log('1/3', 'Finding closest human example...');
  const closest = findClosestAidenExample(question);
  log('1/3', `Using "${closest.question}" as structural template`);

  const closestBreakdown = sentenceBreakdown(closest.answer);
  const humanSentences = getSentences(closest.answer);
  const allAidenText = AIDEN_EXAMPLES.map((e, i) =>
    `[HUMAN EXAMPLE ${i+1} — Q: "${e.question}"]\n${e.answer}`
  ).join('\n\n');
  const allAIText = AI_EXAMPLES.map(e => `[${e.label}]\n${e.sample}`).join('\n\n');
  const userStyleBlock = styleProfile ? buildUserStyleBlock(styleProfile) : '';

  log('1/3', 'Writing answer using sentence structure...');
  const draft = await mistral(apiKey,
    `You are going to answer a question by substituting new content into the exact sentence structure of a real human answer.

━━━ THE HUMAN ANSWER TO COPY STRUCTURALLY ━━━
Real person answered: "${closest.question}"

Their answer sentence by sentence:
${closestBreakdown}

━━━ YOUR JOB ━━━
Answer the NEW question using the SAME sentence structure:
- Same number of sentences
- Each sentence same LENGTH as the corresponding human sentence (±3 words)  
- Same TYPE (declarative → declarative, question → question, analogy → analogy)
- New content relevant to the new question

━━━ ALL HUMAN EXAMPLES FOR VOICE REFERENCE ━━━
${allAidenText}

━━━ AI WRITING — NEVER PRODUCE THIS ━━━
${allAIText}

━━━ HARD RULES ━━━
• Never write a sentence longer than 20 words
• Never use: however, moreover, furthermore, nuanced, leverage, complex, multifaceted, arguably
• Never list concepts: "X, Y, and Z"
• Never end with a caveat or "it depends"
• Never acknowledge the other side has valid points

${userStyleBlock}

OUTPUT: Return ONLY the answer. No preamble.`,
    `New question: "${question}"\n\nWrite the answer now, matching the sentence-by-sentence structure of the human example above.`,
    0.88, 800);

  log('2/3', 'Comparing draft to human answer sentence by sentence...');

  const draftSentences = getSentences(draft);
  const compareResult = await mistral(apiKey,
    `Compare the draft answer to the human answer sentence by sentence. Fix any sentences that diverged from the human's structure.

HUMAN ANSWER (sentence by sentence):
${humanSentences.map((s, i) => `H${i+1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

DRAFT ANSWER (sentence by sentence):
${draftSentences.map((s, i) => `D${i+1} [${s.split(/\s+/).length}w]: "${s}"`).join('\n')}

For each draft sentence check:
1. Is it within 3 words of the human sentence's length? If not — fix.
2. Is it as direct and confident as the human? If not — remove hedges.
3. Does it use plain vocabulary? If not — replace academic words.
4. Does it STATE things rather than EXPLAIN them? Fix if needed.

Keep the content and argument. Output ONLY the corrected full answer.`,
    draft, 0.45, 800);

  log('3/3', 'Done');
  console.log(`=== ANSWER DONE ===\n`);

  return {
    text: compareResult,
    scores: {
      bannedWordsFound: countBannedWords(compareResult),
      aiOpenersFound: countAIOpeners(compareResult).length,
      burstiness: calcBurstiness(compareResult),
      wordCount: wc(compareResult)
    }
  };
}
