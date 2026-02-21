// ═══════════════════════════════════════════════════════════════════
//  HUMANIZER DATASET LIBRARY — datasets.js
//  40 human paragraphs · 40 AI paragraphs · 20 contrast pairs
//  + forced substitutions + fragment templates + imperfection rules
// ═══════════════════════════════════════════════════════════════════

const HUMAN_PARAGRAPHS = [

  // ── ACADEMIC ARGUMENTATIVE ───────────────────────────────────────

  `The paper gets something wrong that I think matters. It treats the wage gap as if it's one number when it's really six different numbers depending on what you control for. Once you account for hours worked, occupation, and years of experience, the gap shrinks considerably. That doesn't mean discrimination doesn't exist — it probably does — but conflating the raw gap with the adjusted gap misleads more than it clarifies.`,

  `My thesis changed three times. First I thought the evidence pointed clearly one way, then I read the counterarguments and wasn't sure, then I found a 2019 meta-analysis that complicated both positions. This isn't me being indecisive. This is what actually happens when you read carefully. The final argument I landed on is messier than the one I started with, but it's also more honest about what the data actually shows.`,

  `There's a version of this argument that works and a version that doesn't. The version that works is: given constraints X, Y, and Z, policy A produces better outcomes than policy B on metrics 1, 2, and 3. The version that doesn't work is: policy A is good because it reflects the right values. Both arguments appear in this essay. The second one keeps sneaking in around page five and undermining the first.`,

  `The study's methodology has a flaw that the authors acknowledge in footnote 14 and then proceed to ignore for the next forty pages. They measured stress using self-reported surveys at two points six months apart. But stress isn't stable over six months — it fluctuates week to week based on external events. Using those two data points as if they represent stable states introduces noise that could account for a substantial portion of the observed effect.`,

  `What the Renaissance actually was depends heavily on who you ask and who you're asking about. For a wealthy merchant in Florence, it was a real shift — new art, new architecture, new ideas circulating in salons. For a peasant outside that same city, life looked almost identical in 1500 to how it had in 1300. Calling it a cultural revolution is accurate for some people and almost meaningless for others, and most textbook treatments don't make this distinction nearly clearly enough.`,

  `I want to push back on the framing here. The question isn't whether social media causes depression — that's almost certainly too simple. The question is whether social media causes depression in whom, under what conditions, and through what mechanism. A 14-year-old girl who uses Instagram for social comparison is having a completely different experience than a 40-year-old man who uses Facebook to stay in touch with family. Treating them as one data point obscures more than it reveals.`,

  `The honest answer is that the evidence is mixed and anyone who tells you otherwise is either wrong or selling something. There are studies showing benefit, studies showing harm, and a large number of studies that show nothing in particular. The effect sizes in almost all of them are small. This doesn't mean we can't draw any conclusions — it means the conclusions should be tentative, conditional, and heavily caveated.`,

  `Darwin didn't actually invent the idea of evolution. He invented natural selection as the mechanism. Lamarck had proposed evolution decades earlier, and the general idea that species change over time was circulating well before the Origin of Species. What Darwin did — and this is the part that actually mattered — was provide a mechanism that didn't require a guiding intelligence. That's the part that was controversial. Not the change, but the lack of a director.`,

  `The correlation between poverty and crime does not mean poverty causes crime. That requires a mechanism. Several mechanisms have been proposed — stress, opportunity cost, neighborhood effects, peer networks — and the evidence for each varies. The relationship probably works through multiple channels simultaneously, which means no single intervention fixes it. This is inconvenient for policymakers, so they tend to pick one mechanism and build a program around it. That's understandable. It's also why so many programs don't generalize.`,

  `The first chapter of this novel is doing three things simultaneously, and I'm not sure all three are compatible. It's establishing the narrator's voice, setting up the central conflict, and also trying to do something formally experimental with tense. The tense thing keeps interrupting the other two. By the time you understand what the narrator wants, you've been pulled out of the story twice by sudden shifts to present tense that feel like accidents rather than choices.`,

  // ── PERSONAL / REFLECTIVE ────────────────────────────────────────

  `I thought I understood what my grandmother went through until I read her letters. Not the content — the physical experience of reading them. Her handwriting got smaller as she got older. Not because she was trying to fit more on the page. Because she was losing the fine motor control that made large letters possible. I hadn't thought about aging as something that happens to your handwriting. Now I can't stop thinking about it.`,

  `The internship was useful but not in the way I expected. I didn't learn much about the industry. I learned that I hate open offices, that I'm very bad at small talk with people I don't respect, and that I need to understand what I'm working toward or I stop caring almost immediately. These are not flattering things to discover about yourself. They are, however, useful.`,

  `Running helped until it didn't. For about two years it was the thing that kept everything else manageable — a reliable two hours where my brain was mostly quiet. Then I got injured, took six weeks off, and discovered the quiet had followed me around longer than I realized. The running wasn't creating the calm. It was revealing that the calm was available. That took me an embarrassingly long time to understand.`,

  `The professor gave me a B+ and wrote "clear thinking, weak transitions" on my paper. I've been thinking about that note for three years. I think he was wrong about the transitions — they were intentionally abrupt, not accidentally — but right that I hadn't made that intention legible to a reader. That's the same problem, actually. It just has two different diagnoses.`,

  `My roommate and I have completely different standards for clean. This became clear around week two and has been a low-level source of tension ever since. What I've noticed is that we're both right by our own standards and both find the other person's standard incomprehensible. He doesn't understand how I can work in what he calls disorder. I don't understand how he can relax after spending an hour cleaning something that was already clean. We've reached a détente, not a resolution.`,

  // ── NARRATIVE / JOURNALISTIC ─────────────────────────────────────

  `The factory had been closing for fifteen years before it actually closed. You could watch it in the workforce numbers — 800 employees in 2005, 600 in 2009, 340 in 2014, 180 when the final announcement came. People knew. They'd known for a long time. The announcement was almost a relief compared to the sustained uncertainty that preceded it. At least now they could stop waiting.`,

  `Three different people told me three different versions of what happened that night, and at least two of them were present. This isn't unusual. Memory doesn't record events — it reconstructs them using whatever materials are available, including what you expected to happen, what you later found out, and what you need to believe. The gaps between the three versions are not evidence that people are lying. They're evidence that memory works the way memory works.`,

  `The neighborhood changed faster than anyone expected, including the people who wanted it to change. In 2015 there was one coffee shop that felt out of place. By 2019 it felt like the old businesses were the ones out of place. The hardware store owner I talked to wasn't bitter about it exactly. More like bewildered. He kept saying he didn't understand when it happened. He'd watched it happen. He still didn't understand when.`,

  `What struck me most about the trial wasn't the verdict. It was the two weeks beforehand — the procedural arguments, the contested motions, the technical debates about admissibility. The parts that never make the news. This is where most of the actual justice or injustice gets decided, by people in a room who mostly look like they're doing paperwork. The dramatic verdict is real, but it's downstream of a thousand smaller decisions that most people never see.`,

  `She'd been teaching the same course for twenty-two years and had strong opinions about everything in it, including things I didn't think it was possible to have strong opinions about, like the correct order in which to introduce ideas and the exact week at which students were ready to encounter a particular kind of complexity. Some of this was probably just habit. Some of it, I came to think, was actually right.`,

  // ── TECHNICAL / ANALYTICAL ───────────────────────────────────────

  `The bug wasn't in the function I was looking at. It never is. It was three layers up, in the code that called the function that called the function, where someone had made an assumption about input type that was valid in 2019 and stopped being valid when the API changed. The function itself was fine. It was doing exactly what it was told. It was being told the wrong thing.`,

  `The model performs well on the test set because the test set was drawn from the same distribution as the training set. That's not a useful finding. What matters is how it performs on data from deployment, which comes from a different distribution entirely. This is a recurring problem in ML research that people acknowledge in the limitations section and then ignore when they write the abstract.`,

  `Caching solved the latency problem and created a different one. We were now serving stale data in cases where fresh data mattered. The fix was cache invalidation, which introduced a race condition. The fix for that was a queue, which introduced a bottleneck. Each fix created something new to fix. This is not a failure of engineering. This is what distributed systems actually look like.`,

  `Statistical significance is not the same as practical significance, and this paper keeps treating them as if they are. Yes, the difference was significant at p < 0.05. The effect size was d = 0.12. That's a real effect, but it's a small one — in most real-world contexts, it would be invisible without a very large sample. The paper discusses its implications as if d = 0.12 changes clinical practice. It probably doesn't.`,

  `The architecture made sense for the problem it was designed to solve in 2017. The problem has since changed in four significant ways, none of which anyone explicitly decided to change — they accumulated gradually, through small product decisions that each seemed reasonable at the time. The technical debt isn't the architecture. The technical debt is the gap between the problem the architecture was built for and the problem it's currently being asked to solve.`,

  // ── FORUM / DISCUSSION VOICE ─────────────────────────────────────

  `Okay but the problem with this argument is that it works too well. It can justify almost any policy if you accept the premises, which means it's not really doing the work you think it is. The actual argument has to be at the level of the premises — do we accept that outcomes X and Y are what we're optimizing for? Because if we don't share those, the whole structure collapses.`,

  `I've tried four different approaches to this and none of them fully work. Method A handles cases 1-3 well but breaks on case 4. Method B handles case 4 but is three times slower and introduces a memory issue. Method C is theoretically elegant and practically unusable. Method D is a hack that mostly works but I don't understand why. I shipped Method D. I'm not proud of it. It works.`,

  `What you're describing sounds less like a productivity problem and more like a clarity problem. You're not struggling to do the work — you're struggling to figure out which work is worth doing. In the absence of that clarity you're doing all of it, badly. The fix isn't a better task manager. The fix is deciding what matters, which is harder and more uncomfortable.`,

  `The short answer is yes. The long answer is yes, but only if you've already done X, you're working in context Y, and you're willing to accept tradeoff Z. Most people asking this question haven't done X, aren't in context Y, and don't know tradeoff Z exists. So in practice the answer for most people is no, which is confusing given that technically the answer is yes.`,

  `I disagree with this but I want to understand it better before I say why. My instinct is that the evidence doesn't support the conclusion, but my instinct has been wrong before on exactly this kind of question. Can you walk me through the specific studies you're relying on? Not the meta-analysis — the underlying studies. I want to see what the actual measurements were.`,

  // ── STUDENT ESSAY VOICE ──────────────────────────────────────────

  `I'm not sure I fully understood this text the first time I read it. The second time I understood it differently, not better. What I think is happening is that the author is doing something I don't have vocabulary for yet — some technique I can recognize is working without being able to name what it is or explain how. That's an uncomfortable place to write an analysis from, but I'd rather admit it than pretend I have more purchase on this than I do.`,

  `The counterargument is actually stronger than I initially gave it credit for. I wrote the first draft treating it as easy to dismiss. After doing more reading, I think I was wrong about that. The revised version of my argument has to do more work, specifically around whether the evidence I cite generalizes beyond the specific contexts in which it was gathered. I'm not sure it does.`,

  `There are three reasons this matters and I want to be honest that the third one is the most important but also the hardest to establish from the available evidence. The first two reasons are well-supported. The third is more speculative and I've tried to mark it as such throughout. If you're skeptical of the third reason, the argument still holds on the first two — it's just weaker than I'd like it to be.`,

  `My professor told me the argument was clear but the evidence was thin. My writing tutor told me the evidence was strong but the argument was buried. I think they're both right and I think the problem is structural — I assembled the evidence before I had a fully formed argument, which means the argument had to fit around the evidence instead of the other way around. The revision I need to do is more fundamental than either of them said.`,

  `Reading this source alongside the other four changed how I understood it. In isolation it seemed to be making a straightforward empirical claim. Next to the others, it becomes clear it's making a methodological argument disguised as an empirical one. The data it presents doesn't actually support the conclusion independently — it only supports the conclusion if you already accept the methodological assumptions it's trying to establish. That's circular.`,

  // ── ADDITIONAL VARIETY ───────────────────────────────────────────

  `The graph shows a correlation. It does not show a cause. These are different things and the article spends its entire second half treating them as if they're the same. The writer probably knows this distinction exists. What happened is that the correlation is striking and the causal story is intuitive and attractive, and somewhere in the writing process the distinction dissolved. That's a very common failure mode.`,

  `I've been reading about this for three months and I've become less confident, not more. The more I read, the more exceptions I find, the more my initial framing looks like a simplification. I don't think this is bad. I think this is what learning actually feels like from the inside, which is nothing like how it looks from the outside. From the outside it looks like progress. From the inside it mostly feels like mounting uncertainty.`,

  `The objection I keep running into is one I can't fully answer. I have partial responses. None of them are satisfying. The best I can do is argue that the objection, even if valid, doesn't undermine the core claim — it just means the core claim requires a stronger form of evidence than I currently have. That's an honest position. It's also not a particularly strong one.`,

  `What surprised me wasn't the conclusion. It was how far back the consensus went. I had assumed this was a recent finding. Reading the literature more carefully, it became clear this was established in the 1980s and has been replicated consistently since. The "recent discovery" framing I'd absorbed from popular sources was just wrong. The discovery wasn't recent. The popular coverage was.`,

  `Two things can be true simultaneously: the study is methodologically sound, and the conclusion doesn't follow from the methodology. This study is both. The design is careful, the analysis is appropriate, and the conclusion section makes a claim the data doesn't support. This isn't fraud. It's the kind of thing that happens when you've been working on something for three years and you want it to matter more than the data strictly allows.`,

];

// ══════════════════════════════════════════════════════════════════
//  AI PARAGRAPHS — 40 examples of real AI writing patterns
// ══════════════════════════════════════════════════════════════════

const AI_PARAGRAPHS = [

  // ── SMOOTH INTRO PATTERN ─────────────────────────────────────────

  `The question of whether social media has a detrimental effect on mental health has become increasingly relevant in today's digitally interconnected world. As platforms such as Instagram, TikTok, and Twitter continue to grow in popularity, researchers and mental health professionals have begun to examine the complex relationship between online activity and psychological well-being. This essay will explore the multifaceted nature of this relationship, considering both the potential harms and benefits associated with social media use.`,

  `Climate change represents one of the most pressing challenges facing humanity in the twenty-first century. The scientific consensus is clear: human activity, particularly the burning of fossil fuels, has led to a significant increase in greenhouse gas emissions, resulting in rising global temperatures and increasingly severe weather events. It is therefore crucial that governments, businesses, and individuals work together to implement comprehensive strategies aimed at reducing carbon emissions.`,

  `The relationship between education and economic mobility is a complex and multifaceted one that has been the subject of extensive academic research. While it is widely acknowledged that access to quality education can significantly improve an individual's economic prospects, the precise mechanisms through which this occurs remain a subject of ongoing debate. This essay will examine the key ways in which education contributes to economic mobility, while also considering the structural barriers that continue to limit access.`,

  `Throughout human history, the development of technology has fundamentally transformed the way people live, work, and interact with one another. From the invention of the printing press to the development of the internet, technological innovations have consistently reshaped social structures, economic systems, and cultural practices. In today's rapidly evolving technological landscape, it is more important than ever to carefully consider both the opportunities and the challenges that emerging technologies present.`,

  `The concept of social justice has gained significant prominence in contemporary political and academic discourse. At its core, social justice refers to the fair and equitable distribution of resources, opportunities, and privileges within a society. Advocates argue that systemic inequalities based on race, gender, class, and other factors must be actively addressed through policy interventions and cultural change. However, critics have raised important questions about the means by which social justice goals should be pursued.`,

  // ── HEDGED ANALYSIS PATTERN ──────────────────────────────────────

  `It is worth noting that the evidence on this topic is somewhat mixed, and it would be overly simplistic to draw definitive conclusions without careful consideration of the various factors at play. While some studies suggest a positive relationship between X and Y, others have found no significant association, or even a negative one. This variability in findings may be attributable to differences in methodology, sample composition, and the specific contexts in which the research was conducted.`,

  `When considering the implications of this research, it is important to acknowledge the limitations of the current evidence base. The studies reviewed in this essay vary considerably in terms of their methodological rigor, sample sizes, and the populations studied. As a result, it is difficult to draw firm conclusions about the generalizability of the findings. Furthermore, the rapidly changing nature of this field means that some of the research may already be outdated.`,

  `The relationship between these variables is undeniably complex, and it would be misleading to suggest that any single factor can fully account for the observed patterns. A more nuanced understanding requires consideration of the interplay between individual characteristics, social context, and structural factors. It is also important to recognize that these relationships may operate differently across different populations and cultural contexts.`,

  `While it is tempting to draw straightforward causal conclusions from these findings, it is important to exercise caution. The correlational nature of much of the existing research means that we cannot rule out the possibility that the observed associations are the result of confounding variables rather than direct causal relationships. Longitudinal studies that track individuals over time would provide stronger evidence, but such research is costly and time-consuming to conduct.`,

  `In light of these considerations, it becomes evident that a comprehensive approach to addressing this issue will require collaboration across multiple sectors. No single organization or institution can tackle these challenges alone, and it is therefore essential that stakeholders work together to develop coordinated strategies that address the root causes of the problem while also mitigating its most immediate effects.`,

  // ── FORMULAIC CONCLUSION PATTERN ────────────────────────────────

  `In conclusion, the evidence reviewed in this essay suggests that the relationship between X and Y is both complex and consequential. While significant progress has been made in our understanding of this relationship, much work remains to be done. Future research should focus on addressing the methodological limitations identified in existing studies, while also exploring the mechanisms through which this relationship operates. By doing so, we can develop a more comprehensive understanding that can inform effective policy and practice.`,

  `To summarize, this essay has examined the key arguments surrounding this issue and concluded that a balanced approach is necessary. It is clear that both the benefits and the risks must be carefully weighed, and that any policy response must be tailored to the specific context in which it is implemented. Ultimately, the goal must be to promote the well-being of all members of society while also respecting individual rights and freedoms.`,

  `In conclusion, it is evident that this is a multifaceted issue that requires careful and nuanced consideration. The evidence presented in this essay demonstrates that simplistic solutions are unlikely to be effective, and that a more comprehensive approach is needed. By working together across disciplinary boundaries and engaging with the perspectives of those most directly affected, we can develop strategies that are both effective and equitable.`,

  `This essay has argued that the phenomenon in question cannot be understood in isolation from the broader social, economic, and cultural context in which it occurs. By adopting a holistic perspective that takes into account the complex interplay of factors involved, we can develop a more accurate and useful understanding of the issue. This, in turn, will enable us to develop more effective and targeted interventions.`,

  `Ultimately, addressing this challenge will require a fundamental shift in how we think about and approach these issues. This will not be easy, and it will require sustained commitment from individuals, organizations, and governments at all levels. However, with the right policies and resources in place, it is possible to make meaningful progress toward a more just and equitable future.`,

  // ── HOLLOW PERSONAL STATEMENT PATTERN ───────────────────────────

  `My passion for this field began at an early age, when I first became aware of the profound impact that this discipline can have on people's lives. As I have grown and developed both academically and personally, this passion has only deepened, driving me to seek out opportunities to engage with the field at a deeper level. Through my academic studies, extracurricular activities, and volunteer work, I have developed a strong foundation of knowledge and skills.`,

  `Throughout my academic career, I have consistently demonstrated a commitment to excellence and a willingness to engage with challenging material. My experiences both inside and outside the classroom have shaped my understanding of the field and reinforced my conviction that this is the right path for me. I am particularly drawn to the opportunity to contribute to cutting-edge research while also developing the practical skills necessary to make a meaningful impact.`,

  `I believe that my unique combination of academic preparation, professional experience, and personal qualities makes me an exceptionally strong candidate for this program. My background has provided me with a solid grounding in the theoretical foundations of the field, while my practical experience has given me an appreciation for the real-world challenges that practitioners face. I am confident that I have both the ability and the motivation to succeed.`,

  // ── OVER-STRUCTURED ARGUMENT PATTERN ────────────────────────────

  `There are three main reasons why this policy represents the most effective approach to addressing this challenge. First, it is based on a solid foundation of empirical evidence that demonstrates its effectiveness in comparable contexts. Second, it is consistent with established ethical principles and respects the rights and dignity of all individuals affected. Third, it is practical and implementable within existing institutional frameworks, making it more likely to achieve its intended outcomes.`,

  `The argument can be broken down into several key components. To begin with, it is necessary to establish the empirical basis for the claim being made. This involves reviewing the relevant evidence and assessing its quality and relevance. Next, it is important to consider the logical structure of the argument and to identify any potential weaknesses or counterarguments. Finally, it is necessary to consider the practical implications of the argument.`,

  `This analysis will proceed in three stages. In the first stage, we will examine the historical context that gave rise to this phenomenon. In the second stage, we will analyze the key factors that have contributed to its development. In the third and final stage, we will consider the implications of these findings for both theory and practice, and will suggest directions for future research.`,

  // ── TEXTBOOK EXPLANATION PATTERN ────────────────────────────────

  `Cognitive dissonance, a concept first introduced by psychologist Leon Festinger in 1957, refers to the mental discomfort experienced by an individual who holds two or more contradictory beliefs, values, or attitudes simultaneously. This psychological phenomenon is significant because it motivates individuals to reduce the inconsistency between their beliefs and their behavior, often through rationalization or by seeking out information that confirms their existing beliefs.`,

  `Supply and demand is one of the most fundamental concepts in economics, describing the relationship between the availability of a good or service and the desire for that good or service. According to the law of supply, the quantity of a good that producers are willing to supply increases as the price of the good increases, all other things being equal. Conversely, the law of demand states that consumers will purchase less of a good as its price increases.`,

  `The process of natural selection, first described by Charles Darwin in his seminal work On the Origin of Species, is the mechanism by which heritable traits that increase an organism's reproductive success become more common in successive generations. This process occurs because individuals within a population vary in their traits, some of which are heritable, and those individuals with traits that provide a reproductive advantage are more likely to pass those traits on to their offspring.`,

  // ── BALANCED TAKE PATTERN ────────────────────────────────────────

  `The debate over this issue is complex, with compelling arguments to be found on both sides. Proponents of the view argue that it is supported by a strong body of empirical evidence and is consistent with widely shared ethical principles. Critics, on the other hand, contend that it oversimplifies a complex reality and fails to adequately account for important contextual factors. A balanced assessment requires careful consideration of both sets of arguments.`,

  `While there is much to recommend this approach, it is important to acknowledge that it is not without its limitations. On the positive side, it offers a number of significant advantages over alternative approaches, including greater simplicity, lower cost, and a stronger evidence base. At the same time, it has been criticized for failing to address certain important dimensions of the problem, and there are legitimate questions about its applicability in all contexts.`,

  `Reasonable people can and do disagree about this issue, and it would be presumptuous to suggest that there is a simple or obvious answer. Those who favor one approach emphasize certain values and priorities, while those who favor an alternative approach emphasize different ones. What is needed is a thoughtful and open-minded dialogue that takes seriously the concerns of all stakeholders and seeks to find common ground where possible.`,

  // ── TRANSITION-HEAVY ANALYSIS ────────────────────────────────────

  `Furthermore, it is important to consider the broader implications of these findings for our understanding of the issue. Not only do they shed new light on the mechanisms through which this phenomenon operates, but they also have significant implications for policy and practice. Moreover, they suggest that previous theoretical frameworks may need to be revised in light of the new evidence, which represents a significant contribution to the field.`,

  `Additionally, the study has several notable strengths that distinguish it from previous research in this area. In particular, the use of a longitudinal design allows for the examination of causal relationships that cannot be established through cross-sectional research. Furthermore, the large and diverse sample enhances the generalizability of the findings. However, it is important to note that the study also has several limitations that must be taken into account.`,

  `Building on the work of previous researchers, this study makes several important contributions to the existing literature. Specifically, it extends previous findings by examining a population that has been largely neglected in prior research. Moreover, it employs a more rigorous methodological approach that addresses several of the limitations of earlier studies. As a result, the findings provide a more robust and nuanced understanding of the phenomenon.`,

  // ── AI ADVICE PATTERN ────────────────────────────────────────────

  `There are several key strategies that individuals can employ to improve their academic performance. First and foremost, it is essential to develop effective time management skills, including the ability to prioritize tasks and allocate sufficient time for study and revision. Additionally, seeking feedback from instructors and peers can provide valuable insights into areas for improvement. Furthermore, maintaining a healthy lifestyle can significantly enhance cognitive function and academic performance.`,

  `In order to achieve success in this endeavor, it is necessary to approach the challenge in a systematic and organized manner. Begin by clearly defining your goals and identifying the steps necessary to achieve them. Next, develop a realistic plan that takes into account your available resources and any potential obstacles. As you implement your plan, be sure to monitor your progress regularly and make adjustments as needed.`,

  `The key to effective communication lies in understanding your audience and tailoring your message accordingly. This requires not only a clear and coherent presentation of your ideas, but also an awareness of the cultural, emotional, and contextual factors that may influence how your message is received. By taking the time to consider these factors and to craft your message thoughtfully, you can significantly enhance the effectiveness of your communication.`,

  // ── PURPLE CREATIVE WRITING PATTERN ─────────────────────────────

  `The morning light filtered through the curtains in gentle golden streams, casting a warm and welcoming glow across the room. Maria sat at her desk, her fingers hovering above the keyboard as she contemplated the words she was about to write. There was something magical about this time of day, when the world was still quiet and full of possibility, before the demands of daily life began to intrude upon her creative solitude.`,

  `The ancient forest stretched out before them in all its magnificent glory, a testament to the enduring power of nature. The towering trees, their bark weathered by centuries of wind and rain, stood like silent sentinels guarding the secrets of the past. As the travelers made their way along the winding path, they felt a profound sense of connection to the natural world, a reminder of the delicate balance that sustains all living things.`,

  `She gazed out at the vast expanse of ocean before her, feeling a profound sense of peace wash over her troubled soul. The rhythmic sound of the waves breaking upon the shore seemed to speak to her in a language older than words, reminding her of the eternal cycle of life and death, of endings and beginnings. In that moment, she felt a deep sense of gratitude for the beauty of the world and the gift of being alive.`,

  // ── AI TRANSITION FILLER PATTERN ─────────────────────────────────

  `As previously mentioned, the evidence suggests that this relationship is more complex than initially assumed. In light of this, it is necessary to revisit some of the assumptions that have underpinned earlier research in this area. By doing so, we can develop a more accurate and comprehensive understanding of the phenomenon, which will in turn enable us to develop more effective interventions and policies.`,

  `With this in mind, it is clear that a more holistic approach is needed. Rather than focusing narrowly on individual factors, we must consider the broader systemic context in which these factors operate. This requires a willingness to engage with complexity and ambiguity, and to resist the temptation to reduce complex phenomena to simple narratives. Only by embracing this complexity can we hope to develop solutions that are truly effective and sustainable.`,

  `It is against this backdrop that we must evaluate the significance of the findings presented in this essay. Taken together, they paint a complex and nuanced picture that defies simple characterization. Nevertheless, certain patterns do emerge from the data, and these patterns have important implications for our understanding of the issue and for the development of effective policy responses.`,

  `Having considered the available evidence, it is now possible to draw some tentative conclusions. While it would be premature to make definitive claims, the weight of evidence does appear to support the view that certain factors play a more significant role than others in determining outcomes. These findings have important implications for both theory and practice, and suggest several promising directions for future research.`,

  `It is important to note that the findings discussed in this essay should be interpreted with caution, given the inherent limitations of the available evidence. That said, the patterns that emerge from the data are sufficiently consistent to warrant serious attention from researchers and policymakers alike. Further research will be necessary to confirm these findings and to explore the mechanisms through which the observed effects operate.`,

];

// ══════════════════════════════════════════════════════════════════
//  CONTRAST PAIRS — 20 same-topic human vs AI
// ══════════════════════════════════════════════════════════════════

const CONTRASTS = [
  {
    topic: 'thesis statement problems',
    human: `My thesis went through four versions, each one more hedged than the last, until my advisor told me to stop making it smaller and make it more specific instead. Those are different things. A hedged thesis is vague. A specific thesis is defensible. I had been confusing being careful with being clear.`,
    ai: `Developing a strong thesis statement is one of the most challenging aspects of academic writing. A good thesis should be specific, arguable, and clearly articulated. It is important to revise your thesis statement multiple times throughout the writing process to ensure that it accurately reflects your argument.`
  },
  {
    topic: 'reading a difficult book',
    human: `I read the same paragraph four times and understood it differently each time. I don't think that's because I was confused. I think the paragraph is doing four different things and you can only see one at a time. This is either a feature or a bug and I genuinely can't tell which.`,
    ai: `Reading complex academic texts can be a challenging but rewarding experience. To improve comprehension, it is helpful to read actively by taking notes, asking questions, and making connections to what you already know. Re-reading difficult passages multiple times can also deepen understanding.`
  },
  {
    topic: 'group work in college',
    human: `Group projects work when everyone cares about the same thing. When they don't, someone ends up doing most of it and being quietly resentful, and the person who did the least gets the same grade. This is not a mystery. Everyone knows this is how it works. We keep assigning group projects anyway.`,
    ai: `Collaborative learning through group projects can provide students with valuable opportunities to develop teamwork, communication, and problem-solving skills. While challenges related to unequal participation may arise, these can be mitigated through clear role assignment, regular check-ins, and peer evaluation mechanisms.`
  },
  {
    topic: 'sleep and studying',
    human: `I ran an experiment on myself. For two weeks I studied the normal amount and slept badly. For the next two weeks I studied less and slept eight hours. The second two weeks I retained more. My sample size is one. I am still pretty convinced.`,
    ai: `Research consistently demonstrates that adequate sleep plays a crucial role in academic performance. During sleep, the brain consolidates memories formed during waking hours, a process essential for learning and retention. Students who prioritize sleep are therefore more likely to achieve their academic goals.`
  },
  {
    topic: 'why students procrastinate',
    human: `I don't procrastinate because I'm lazy. I procrastinate because I'm afraid the thing I write will be bad, and as long as I haven't written it, it still might be good. The procrastination is protecting a version of the paper that exists only as potential. That's not a time management problem. It's a different problem.`,
    ai: `Procrastination is a common challenge among students and can have significant negative effects on academic performance. Research suggests that procrastination is often driven by fear of failure, perfectionism, and poor self-regulation skills. Effective strategies include breaking tasks into smaller steps and using time management techniques.`
  },
  {
    topic: 'liberal arts education',
    human: `The practical argument for a liberal arts education is underrated. Not the "you'll learn to think" argument — everyone makes that and it's too vague to evaluate. The specific version: you'll encounter problems that don't fit the category you were trained for, and the person who read widely does better than the person who read narrowly. That's a concrete and testable claim.`,
    ai: `A liberal arts education provides students with a broad foundation of knowledge across multiple disciplines, cultivating critical thinking, communication, and analytical skills that are highly valued in today's workforce. By engaging with diverse fields of study, students develop the intellectual flexibility necessary to adapt to new challenges.`
  },
  {
    topic: 'writing a conclusion',
    human: `The conclusion is where you figure out what you actually argued. Not what you planned to argue — what you actually ended up saying. If those are the same thing, you were either very disciplined or you didn't learn anything while writing. I almost always learn something, which means my conclusions are usually revisions of my introductions.`,
    ai: `The conclusion of an academic essay serves the important function of synthesizing the key arguments presented throughout the paper. An effective conclusion should restate the thesis in light of the evidence presented, summarize the main points, and indicate the broader implications of the argument for theory and practice.`
  },
  {
    topic: 'evaluating sources',
    human: `I've learned to be suspicious of sources that are too convenient. If a source says exactly what I need it to say, I read it twice as carefully. Either I'm right and found confirmation, or I'm wrong and the source is doing the work of justifying something I already believed. The second thing happens more often than I'd like.`,
    ai: `The effective use of sources is a critical skill in academic research. When incorporating sources into your writing, it is important to evaluate their credibility, relevance, and currency. Primary sources and secondary sources both play important roles in building a well-supported argument.`
  },
  {
    topic: 'studying history',
    human: `The strange thing about studying history is that everyone already knows how it ends, and you have to work to remember that the people in it didn't. They were making decisions under uncertainty, the way we do. The outcomes that now seem inevitable were not obvious to them. Keeping that in mind makes history make more sense and also makes it more frightening.`,
    ai: `The study of history is essential for developing a nuanced understanding of the present. By examining the events and processes of the past, students gain insight into the complex forces that have shaped contemporary societies and institutions. History also teaches important analytical skills, including the ability to evaluate sources critically.`
  },
  {
    topic: 'disagreeing with a professor',
    human: `I disagreed with my professor's reading in the paper and was nervous about it. He gave me an A and wrote "I don't agree but this is well-argued." I've thought about that comment a lot since. The grade wasn't for being right. It was for being coherent and accountable to evidence. That distinction matters more than I initially realized.`,
    ai: `Academic discourse is enriched by the respectful exchange of differing perspectives and interpretations. Students should feel empowered to engage critically with the ideas presented by their instructors, provided that they do so in a constructive manner that is grounded in evidence and sound reasoning.`
  },
  {
    topic: 'social media and attention',
    human: `I'm skeptical of the attention span argument. My attention span for things I care about is fine. My attention span for things I don't care about is short, which I think has always been true. What might be happening is that I now have an alternative whenever I'm bored, which means I'm less practiced at waiting. That's a different claim.`,
    ai: `The proliferation of social media and digital technologies has raised significant concerns about the impact of these platforms on cognitive functioning, particularly attention span. Research suggests that the constant notifications and rapid content cycling encouraged by these platforms may be contributing to a decline in sustained attention among regular users.`
  },
  {
    topic: 'peer review',
    human: `Peer review is a good system with a serious problem: the peers reviewing your work are your competitors. They have incentives to delay, to be conservative about novelty, and to require revisions that make your work more like their work. None of this means peer review is bad. It means you have to read reviewer comments while holding that context in mind.`,
    ai: `Peer review is a cornerstone of the academic publishing process, providing an important mechanism for ensuring the quality and validity of published research. By subjecting manuscripts to evaluation by experts in the relevant field, peer review helps to identify methodological flaws, factual errors, and gaps in reasoning before research is disseminated.`
  },
  {
    topic: 'note-taking methods',
    human: `Cornell notes never worked for me. I tried them for a semester because a study skills pamphlet said they were evidence-based. What actually worked was writing a one-paragraph summary of each lecture from memory, immediately after, without looking at my notes. I got the summary wrong sometimes. That turned out to be useful information.`,
    ai: `Effective note-taking is a fundamental academic skill that can significantly impact learning outcomes. Research supports the use of structured methods such as the Cornell system. These methods encourage active engagement with course material and facilitate review and retrieval during study sessions.`
  },
  {
    topic: 'writing anxiety',
    human: `The blank page problem isn't really a problem with the page. It's a problem with the stakes I've assigned to what goes on the page. When I write like it matters a lot, I freeze. When I write like it's a draft I'll definitely revise, I can usually start. The trick is that my brain knows I'm lying. I try to lie convincingly enough that it takes a few minutes to catch on.`,
    ai: `Writing anxiety is a common experience among students and can significantly impede academic performance. This form of anxiety is often associated with perfectionism, fear of evaluation, and negative self-assessment. Effective strategies include freewriting exercises, breaking the writing task into smaller components, and seeking support from writing centers.`
  },
  {
    topic: 'the scientific method',
    human: `The textbook version of the scientific method — hypothesis, test, confirm or reject, repeat — is not how science actually works. Science works through a messy combination of intuition, opportunism, funding constraints, equipment availability, and the tastes of journal editors. The textbook version describes what scientists say they did. Reading actual lab notebooks describes what they did.`,
    ai: `The scientific method is a systematic approach to inquiry that has been refined over centuries to minimize bias and ensure the reliability of research findings. By following a structured process of observation, hypothesis formulation, experimental design, data collection, and analysis, scientists generate knowledge that is both valid and replicable.`
  },
  {
    topic: 'changing your mind',
    human: `Changing your mind in an essay is allowed. I was told it was a sign of weak thinking for a long time. I now think the opposite. An argument that never encounters a genuine objection it has to accommodate is either in a field with no good objectors, or it's not engaging honestly with the best version of the other side. Neither is a compliment.`,
    ai: `The ability to revise one's views in response to new evidence and compelling arguments is a hallmark of intellectual maturity. Academic discourse requires a willingness to engage critically with opposing perspectives and to update one's position when the evidence warrants it. This kind of intellectual flexibility is essential for the advancement of knowledge.`
  },
  {
    topic: 'gap year value',
    human: `A gap year is good preparation for college if you do something that requires you to figure things out without institutional support. It's bad preparation if you just rest. The resting is fine, but call it what it is. The people I know who found gap years useful were the ones who had to solve a problem nobody had already solved for them.`,
    ai: `A gap year, when approached thoughtfully and purposefully, can provide students with valuable opportunities for personal growth, self-discovery, and the development of practical skills. Experiences such as travel, volunteering, or work can broaden perspectives and help students clarify their academic and career goals.`
  },
  {
    topic: 'class participation grades',
    human: `Class participation grades favor one cognitive style over another and then describe this as measuring engagement. Talking is not the same as thinking. Some of the most engaged students I've been in class with almost never spoke. Some of the most frequent speakers were not thinking very hard. Grading participation is grading extroversion and calling it something else.`,
    ai: `Classroom participation is an important component of the learning process, providing students with opportunities to practice critical thinking and communication skills in a social context. Educators can create inclusive environments that value diverse forms of participation and provide multiple avenues for students to demonstrate their engagement.`
  },
  {
    topic: 'AI in education',
    human: `The concern about AI in education isn't that students will use it. They will. The concern is that we haven't figured out what we actually want students to learn now that the things we were measuring — recall, basic writing, rote problem-solving — are automatable. We're still giving the same assessments. We just banned a tool that makes those assessments meaningless. That's a holding action, not a solution.`,
    ai: `The integration of artificial intelligence in educational settings presents both significant opportunities and important challenges. AI-powered tools can provide personalized learning experiences and offer immediate feedback. However, concerns about academic integrity, data privacy, and the potential exacerbation of educational inequalities must be carefully addressed.`
  },
  {
    topic: 'learning from failure',
    human: `Failure is useful when you learn something specific. "I failed, therefore I should try harder" is not learning something specific. "I failed because I misunderstood the constraints, and here is what I'll do differently" is learning something. Most advice about failure skips the middle part — the part where you actually figure out what went wrong — and goes straight to the inspirational conclusion.`,
    ai: `Failure is an inevitable and valuable part of the learning process. Research suggests that students who adopt a growth mindset are better equipped to learn from failure and use it as a springboard for improvement. By reframing failure as an opportunity for growth, educators can help students develop the resilience necessary for long-term success.`
  },
];

// ══════════════════════════════════════════════════════════════════
//  FORCED SUBSTITUTIONS
//  Specific word-for-word replacements — more effective than
//  "don't use X" because they tell the model what to say instead
// ══════════════════════════════════════════════════════════════════

const FORCED_SUBSTITUTIONS = [
  { from: 'it is important to note that', to: 'worth saying here' },
  { from: 'it is worth noting that', to: 'the thing is' },
  { from: 'it\'s worth noting that', to: 'the thing is' },
  { from: 'this demonstrates', to: 'this shows / which means' },
  { from: 'this highlights', to: 'this shows / which points to' },
  { from: 'this underscores', to: 'this reinforces / this confirms' },
  { from: 'furthermore', to: 'also / and / on top of that' },
  { from: 'moreover', to: 'and / what\'s more / also' },
  { from: 'in conclusion', to: 'so / in the end / what this adds up to' },
  { from: 'to summarize', to: 'to put it simply / the short version' },
  { from: 'ultimately', to: 'in the end / when it comes down to it' },
  { from: 'it is crucial', to: 'it matters / this part is key' },
  { from: 'it is essential', to: 'you have to / it matters that' },
  { from: 'multifaceted', to: 'complicated / not simple / has several parts' },
  { from: 'nuanced', to: 'more complicated than it looks' },
  { from: 'delve into', to: 'look at / get into / work through' },
  { from: 'navigate', to: 'deal with / work through / figure out' },
  { from: 'leverage', to: 'use / take advantage of' },
  { from: 'holistic', to: 'full picture / considering everything' },
  { from: 'robust', to: 'strong / solid / reliable' },
  { from: 'comprehensive', to: 'thorough / full / complete' },
  { from: 'in today\'s rapidly evolving', to: 'right now / these days' },
  { from: 'the landscape of', to: 'how X works / the state of X' },
  { from: 'as previously mentioned', to: 'as I said / earlier I noted' },
  { from: 'it should be noted', to: 'note that / worth knowing' },
  { from: 'this essay will explore', to: 'I\'ll look at / this is about' },
  { from: 'in light of', to: 'given / considering' },
  { from: 'it is evident that', to: 'clearly / obviously / the evidence shows' },
  { from: 'one can see that', to: 'you can see / clearly' },
  { from: 'building on this', to: 'going further / adding to that' },
  { from: 'with this in mind', to: 'given that / so' },
  { from: 'it is important to consider', to: 'worth thinking about' },
  { from: 'plays a pivotal role', to: 'matters a lot / is central' },
  { from: 'plays a crucial role', to: 'matters a lot / is key' },
  { from: 'a wide range of', to: 'many / various / a lot of' },
  { from: 'a variety of', to: 'several / many / different' },
];

// ══════════════════════════════════════════════════════════════════
//  FRAGMENT TEMPLATES
//  Real humans write grammatically incomplete sentences.
//  AI almost never does. These spike perplexity effectively.
// ══════════════════════════════════════════════════════════════════

const FRAGMENT_TEMPLATES = [
  `Not the point.`,
  `Which is fine.`,
  `Or so it seems.`,
  `Worth knowing.`,
  `A real problem.`,
  `Not always.`,
  `Which is odd.`,
  `Still unclear.`,
  `Hard to say.`,
  `At least partially.`,
  `Sometimes literally.`,
  `For most people, anyway.`,
  `A reasonable concern.`,
  `Debatable.`,
  `Not exactly comforting.`,
  `Especially at first.`,
  `In theory.`,
  `Which says something.`,
  `Useful to know.`,
  `Probably.`,
  `Fair enough.`,
  `That's the part that matters.`,
  `Not a small thing.`,
  `Which is the whole problem.`,
  `More or less.`,
];

// ══════════════════════════════════════════════════════════════════
//  IMPERFECTION RULES
//  Concrete instructions for injecting human writing patterns
// ══════════════════════════════════════════════════════════════════

const IMPERFECTION_RULES = [
  `Add one sentence that starts mid-thought with a dash — like you interrupted yourself to clarify.`,
  `Include one sentence that's under 5 words. Standalone. Just sitting there.`,
  `Add a parenthetical aside that qualifies something you just said (even if it slightly weakens the point).`,
  `Use "actually" once, in a place where a person would genuinely use it to push back on an assumption.`,
  `Write one sentence where you start to say one thing, then change direction with "— or rather," or "— no, that's not right."`,
  `Include one mild qualification like "I think" or "probably" or "at least in my reading."`,
  `Add a sentence that admits something is harder to prove than you'd like.`,
  `Include one sentence that circles back to something earlier: "That's the same issue as..." or "Which connects to the earlier point about..."`,
  `Add one place where you say something direct and then immediately walk it back slightly.`,
  `Use one incomplete sentence — a fragment — that stands alone as its own paragraph or sentence. Make it feel intentional.`,
];

// works in browser (script tag) and Node (require/import)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HUMAN_PARAGRAPHS, AI_PARAGRAPHS, CONTRASTS, FORCED_SUBSTITUTIONS, FRAGMENT_TEMPLATES, IMPERFECTION_RULES };
}
