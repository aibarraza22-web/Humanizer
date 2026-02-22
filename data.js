// data.js — Humanizer dataset
// All human examples, AI counter-examples, banned words, dramatic phrases, and AI openers
// Separated from pipeline.js for easy data updates without touching logic

// ═══════════════════════════════════════════════════════════════════
//  AIDEN'S REAL ANSWERS — WRITE LIKE THESE
//  These are all 100% human. Direct, personal, opinionated, loose reasoning.
//  "Even when the reasoning is loose" — that's the key. Don't over-connect.
// ═══════════════════════════════════════════════════════════════════
export const AIDEN_EXAMPLES = [
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
  },
  {
    question: "Write about the exact moment you realized you were no longer a child.",
    answer: `I think a realized I was no longer a child from nostalgia. Nostalgia of easier times, less responsibility, less awareness, less things to worry about. I don't know of an exact moment but I do remember that feeling of nostalgia. I get that feeling more and more than I ever used to. Probably thinking about the end of 8th grade and that summer. After that I have this nostalgia of those great moments. Probably because all my life up to that was building up to that moment of graduating 8th grade. I guess then there was no exact moment, but there was the moment after 8th grade summer into high school that I realized I was no longer a child.`
  },
  {
    question: "Find 5 sources, cite in MLA format, for a research paper on AI and social connection.",
    answer: `1. Taylor, Samuel Hardman, and Y. Anthony Chen. "The Lonely Algorithm Problem: The Relationship between Algorithmic Personalization and Social Connectedness on TikTok." Journal of Computer-Mediated Communication, vol. 29, no. 5, 2024, article zmae017, doi:10.1093/jcmc/zmae017. Accessed 22 Feb. 2026.\n2. Kim, Myungsung, et al. "Therapeutic Potential of Social Chatbots in Alleviating Loneliness and Social Anxiety: Quasi-Experimental Mixed Methods Study." Journal of Medical Internet Research, vol. 27, 2025, e65589, doi:10.2196/65589. Accessed 22 Feb. 2026.\n3. Yang, Yuyi, et al. "AI Applications to Reduce Loneliness Among Older Adults: A Systematic Review of Effectiveness and Technologies." Healthcare (Basel), vol. 13, no. 5, 2025, article 446, doi:10.3390/healthcare13050446. Accessed 22 Feb. 2026.\n4. Malfacini, Kim. "The Impacts of Companion AI on Human Relationships: Risks, Benefits, and Design Considerations." AI & Society, vol. 40, 2025, pp. 5527–5540, doi:10.1007/s00146-025-02318-6. Accessed 22 Feb. 2026.\n5. Phang, Jason, et al. "Investigating Affective Use and Emotional Well-being on ChatGPT." OpenAI and MIT Media Lab, 2025.`
  },
  {
    question: "What is 1 + 1 equal?",
    answer: `One plus one equals two.`
  },
  {
    question: "How do you factor 4x^2 + 16x + 15?",
    answer: `First, multiply 15 and 4. Then find a two numbers that multiply into 60 and add into 16. The numbers are 6 and 10. That makes it change into 4x^2 + 6x + 10x + 15. Then using grouping that turns into (4x^2 + 6x) + (10x+15). Using the GCF, that turns into 2x(2x+3) + 5(2x+3). Then the answer is (2x+5)(2x+3)`
  }
];

// ═══════════════════════════════════════════════════════════════════
//  AI COUNTER-EXAMPLES — DO NOT WRITE LIKE THESE
//  These are ChatGPT and Claude answers from the same dataset.
//  Showing the model exactly what to avoid is as important as showing
//  it what to aim for.
// ═══════════════════════════════════════════════════════════════════
export const AI_COUNTER_EXAMPLES = [
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
  },
  {
    label: "ChatGPT — nostalgic prompt, dramatic narrative, zero personality",
    sample: `It wasn't some dramatic event, no big speech or sudden responsibility dropped on my shoulders. It was quieter than that. I remember sitting alone after a long day, realizing that no one was going to fix things for me anymore. The problems in front of me were mine to handle. That shift felt subtle but permanent, like a door closing behind me without a sound.`
  },
  {
    label: "ChatGPT — factual question answered with AI flourishes",
    sample: `One plus one equals two. That's just how math works. You learn it as a kid and it never changes. Anyone can do this now. Math doesn't care about trends. One plus one is still two, no surprises.`
  },
  {
    label: "ChatGPT — math problem with unnecessary AI storytelling",
    sample: `Factoring quadratics is way easier now with AI. No more endless guessing. Before you'd sit there for hours trying to find two numbers. Now you just toss it into a clawbot and boom, done in seconds. That changes everything.`
  }
];

// ─── Banned words ─────────────────────────────────────────────────────────────
export const BANNED = [
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

export const DRAMATIC_PHRASES = [
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

export const AI_OPENERS = [
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
