// ═══════════════════════════════════════════════════════════════════
//  scraper.js — fetches REAL human writing from Reddit & forums
//  No auth needed. Uses Reddit's public .json API + cheerio parsing.
// ═══════════════════════════════════════════════════════════════════

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept': 'application/json' };

// ── Reddit public JSON API (no auth, no rate-limit issues at low volume) ──────
async function fetchRedditSearch(query, limit = 15) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&type=link&limit=${limit}&restrict_sr=false`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const posts = data?.data?.children || [];
    return posts
      .map(p => p.data)
      .filter(p => p.selftext && p.selftext.length > 120 && p.selftext !== '[removed]' && p.selftext !== '[deleted]')
      .map(p => ({
        source: `r/${p.subreddit}`,
        title: p.title,
        text: cleanText(p.selftext),
        score: p.score,
        url: `https://reddit.com${p.permalink}`
      }))
      .filter(p => p.text.length > 100);
  } catch { return []; }
}

async function fetchSubredditPosts(subreddit, sort = 'top', limit = 10) {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&t=year`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const posts = data?.data?.children || [];
    return posts
      .map(p => p.data)
      .filter(p => p.selftext && p.selftext.length > 150 && p.selftext !== '[removed]' && p.selftext !== '[deleted]')
      .map(p => ({
        source: `r/${p.subreddit}`,
        title: p.title,
        text: cleanText(p.selftext),
        score: p.score,
        url: `https://reddit.com${p.permalink}`
      }))
      .filter(p => p.text.length > 100);
  } catch { return []; }
}

async function fetchRedditComments(postUrl, limit = 20) {
  try {
    const jsonUrl = postUrl.replace('https://reddit.com', 'https://www.reddit.com') + '.json?limit=' + limit;
    const res = await fetch(jsonUrl, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    const comments = data?.[1]?.data?.children || [];
    return comments
      .map(c => c.data)
      .filter(c => c.body && c.body.length > 80 && c.body !== '[removed]' && c.body !== '[deleted]')
      .map(c => ({
        source: `r/${c.subreddit} comment`,
        text: cleanText(c.body),
        score: c.score
      }))
      .filter(c => c.text.length > 80)
      .slice(0, 8);
  } catch { return []; }
}

// ── Pick subreddits relevant to the topic ─────────────────────────────────────
function pickSubreddits(topic) {
  const t = topic.toLowerCase();
  const always = ['college', 'academia', 'UniversityofReddit'];

  const topicMap = [
    { keys: ['essay','thesis','paper','writing','argument','claim'], subs: ['AskAcademia','GradSchool','writing','EnglishLearning'] },
    { keys: ['history','historical','war','century','politics'], subs: ['history','AskHistorians','worldhistory'] },
    { keys: ['science','biology','chemistry','physics','research'], subs: ['science','askscience','biology'] },
    { keys: ['psychology','mental','behavior','cognitive'], subs: ['psychology','PsychologyStudents','mentalhealth'] },
    { keys: ['technology','software','ai','machine learning','data'], subs: ['technology','MachineLearning','learnprogramming'] },
    { keys: ['economics','finance','money','market','business'], subs: ['economics','personalfinance','investing'] },
    { keys: ['environment','climate','sustainability','carbon'], subs: ['environment','climate','sustainability'] },
    { keys: ['society','social','culture','inequality','race'], subs: ['sociology','TrueOffMyChest','changemyview'] },
    { keys: ['health','medical','medicine','disease','treatment'], subs: ['medicine','AskDocs','premed'] },
    { keys: ['literature','novel','book','poetry','author'], subs: ['literature','books','bookclub'] },
  ];

  const extra = [];
  for (const { keys, subs } of topicMap) {
    if (keys.some(k => t.includes(k))) extra.push(...subs);
  }

  // Always include changemyview — some of the best structured human argumentation on Reddit
  return [...new Set([...always, 'changemyview', ...extra.slice(0, 4)])].slice(0, 6);
}

// ── Main export: gather real human writing on a topic ─────────────────────────
export async function gatherHumanExamples(topicKeywords, rawText) {
  console.log(`  → Scraping Reddit for: "${topicKeywords}"`);

  const results = { human: [], sources: [] };

  // Run scrapes in parallel for speed
  const [searchResults, cmvPosts] = await Promise.all([
    fetchRedditSearch(topicKeywords, 20),
    fetchSubredditPosts('changemyview', 'top', 8),
  ]);

  // Pick relevant subreddits and fetch from them
  const subs = pickSubreddits(topicKeywords);
  const subResults = await Promise.all(
    subs.slice(0, 4).map(sub => fetchSubredditPosts(sub, 'top', 6))
  );

  // Combine all raw posts
  const allPosts = [
    ...searchResults,
    ...cmvPosts,
    ...subResults.flat()
  ];

  // Score by relevance and quality
  const keywords = topicKeywords.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const scored = allPosts.map(p => {
    const t = (p.text + ' ' + (p.title || '')).toLowerCase();
    const relevance = keywords.filter(k => t.includes(k)).length;
    const quality = scoreHumanQuality(p.text);
    return { ...p, relevance, quality, total: relevance * 2 + quality };
  });

  // Sort by combined score, dedupe by first 60 chars
  const seen = new Set();
  const top = scored
    .sort((a, b) => b.total - a.total)
    .filter(p => {
      const key = p.text.slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);

  // For the best posts, also grab their top comments
  const commentFetches = await Promise.all(
    top.slice(0, 3)
      .filter(p => p.url)
      .map(p => fetchRedditComments(p.url, 15))
  );

  const topComments = commentFetches.flat()
    .filter(c => scoreHumanQuality(c.text) > 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // Extract clean paragraphs from top posts + comments
  for (const post of top.slice(0, 8)) {
    const paras = extractBestParagraphs(post.text, 2);
    for (const para of paras) {
      results.human.push({ source: post.source, text: para });
      results.sources.push(post.source);
    }
  }
  for (const comment of topComments) {
    const paras = extractBestParagraphs(comment.text, 1);
    for (const para of paras) {
      results.human.push({ source: comment.source, text: para });
    }
  }

  console.log(`  → Got ${results.human.length} real human paragraphs from Reddit`);
  return results;
}

// ── Score how "human" a piece of text is ─────────────────────────────────────
function scoreHumanQuality(text) {
  if (!text || text.length < 80) return 0;
  let score = 0;

  // Good signals
  if (/\bI (think|feel|believe|realized|found|learned|noticed)\b/i.test(text)) score += 2;
  if (/\b(honestly|actually|basically|literally|kind of|sort of)\b/i.test(text)) score += 2;
  if (/\b(tbh|ngl|imo|imho|fwiw|iirc)\b/i.test(text)) score += 3; // reddit-speak
  if (/\.\.\./g.test(text)) score += 1; // ellipsis
  if (/\b(my|our|we|us)\b/i.test(text)) score += 1;
  if (/[?!]{2}/.test(text)) score += 1;
  if (/\b(but|and|so|because|since|though|although)\b/i.test(text)) score += 1;
  if (text.includes("'")) score += 1; // contractions
  if (/\b\d+\b/.test(text)) score += 1; // numbers are human
  if (text.split('\n').length > 1) score += 1; // paragraph breaks

  // Bad signals (AI-like)
  if (/\b(furthermore|moreover|additionally|nevertheless|consequently)\b/i.test(text)) score -= 3;
  if (/\b(it is important to|it is worth noting|it should be noted)\b/i.test(text)) score -= 3;
  if (/\b(multifaceted|nuanced|comprehensive|holistic|paradigm)\b/i.test(text)) score -= 2;
  if (/^(In conclusion|To summarize|In summary)/i.test(text)) score -= 4;
  if (/^(The [a-z]+ of [a-z]+)/i.test(text)) score -= 2;

  // Length sweet spot
  const wds = text.split(/\s+/).length;
  if (wds >= 60 && wds <= 400) score += 2;
  if (wds < 30) score -= 2;

  return score;
}

// ── Extract the best paragraphs from a Reddit post ───────────────────────────
function extractBestParagraphs(text, maxParas = 2) {
  const paras = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 80 && p.split(/\s+/).length >= 20);

  return paras
    .map(p => ({ text: cleanText(p), score: scoreHumanQuality(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxParas)
    .map(p => p.text);
}

// ── Clean text: strip markdown, URLs, excessive whitespace ───────────────────
function cleanText(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links → text
    .replace(/https?:\/\/\S+/g, '')           // bare URLs
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // bold/italic
    .replace(/#{1,6}\s/g, '')                  // headers
    .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
