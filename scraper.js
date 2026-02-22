// ═══════════════════════════════════════════════════════════════════
//  scraper.js — fetches REAL human writing from Reddit & forums
//  No auth needed. Uses Reddit's public .json API + Pushshift fallback
//  (Railway/datacenter IPs often get blocked by Reddit directly)
// ═══════════════════════════════════════════════════════════════════

import fetch from 'node-fetch';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept': 'application/json' };

// ── Reddit public JSON API ─────────────────────────────────────────────────────
async function fetchRedditSearch(query, limit = 15) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&type=link&limit=${limit}&restrict_sr=false`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })() });
    if (!res.ok) {
      console.log(`  → Reddit search returned ${res.status} — likely blocked`);
      return [];
    }
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
  } catch (e) {
    console.log(`  → Reddit search failed: ${e.message}`);
    return [];
  }
}

async function fetchSubredditPosts(subreddit, sort = 'top', limit = 10) {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&t=year`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })() });
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
    const res = await fetch(jsonUrl, { headers: HEADERS, signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })() });
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

// ── Pushshift fallback (works from datacenter IPs when Reddit blocks) ──────────
async function fetchPushshift(query, limit = 20) {
  const url = `https://api.pullpush.io/reddit/search/submission/?q=${encodeURIComponent(query)}&size=${limit}&is_self=true`;
  try {
    console.log(`  → Trying Pushshift/PullPush fallback...`);
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })() });
    if (!res.ok) {
      console.log(`  → Pushshift returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    const posts = data?.data || [];
    return posts
      .filter(p => p.selftext && p.selftext.length > 120 && p.selftext !== '[removed]' && p.selftext !== '[deleted]')
      .map(p => ({
        source: `r/${p.subreddit}`,
        title: p.title || '',
        text: cleanText(p.selftext),
        score: p.score || 0,
        url: p.full_link || ''
      }))
      .filter(p => p.text.length > 100);
  } catch (e) {
    console.log(`  → Pushshift failed: ${e.message}`);
    return [];
  }
}

// ── Pushshift comment search ───────────────────────────────────────────────────
async function fetchPushshiftComments(query, limit = 20) {
  const url = `https://api.pullpush.io/reddit/search/comment/?q=${encodeURIComponent(query)}&size=${limit}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })() });
    if (!res.ok) return [];
    const data = await res.json();
    const comments = data?.data || [];
    return comments
      .filter(c => c.body && c.body.length > 80 && c.body !== '[removed]' && c.body !== '[deleted]')
      .map(c => ({
        source: `r/${c.subreddit} comment`,
        text: cleanText(c.body),
        score: c.score || 0
      }))
      .filter(c => c.text.length > 80);
  } catch (e) {
    console.log(`  → Pushshift comments failed: ${e.message}`);
    return [];
  }
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

  return [...new Set([...always, 'changemyview', ...extra.slice(0, 4)])].slice(0, 6);
}

// ── Main export: gather real human writing on a topic ─────────────────────────
export async function gatherHumanExamples(topicKeywords, rawText) {
  console.log(`  → Scraping Reddit for: "${topicKeywords}"`);

  const results = { human: [], sources: [] };

  // Try direct Reddit API first (works locally, often blocked on servers)
  const [searchResults, cmvPosts] = await Promise.all([
    fetchRedditSearch(topicKeywords, 20),
    fetchSubredditPosts('changemyview', 'top', 8),
  ]);

  const subs = pickSubreddits(topicKeywords);
  const subResults = await Promise.all(
    subs.slice(0, 4).map(sub => fetchSubredditPosts(sub, 'top', 6))
  );

  let allPosts = [...searchResults, ...cmvPosts, ...subResults.flat()];

  // ── FALLBACK: If Reddit blocked us (datacenter IP), use Pushshift ─────────
  if (allPosts.length < 5) {
    console.log(`  → Direct Reddit returned only ${allPosts.length} posts — switching to Pushshift fallback`);
    const [pushshiftPosts, pushshiftComments] = await Promise.all([
      fetchPushshift(topicKeywords, 25),
      fetchPushshiftComments(topicKeywords, 25),
    ]);

    // Also try a broader search with just the first 2 keywords
    const broadKeywords = topicKeywords.split(' ').slice(0, 2).join(' ');
    let broadPosts = [];
    if (broadKeywords !== topicKeywords) {
      broadPosts = await fetchPushshift(broadKeywords, 15);
    }

    allPosts = [...allPosts, ...pushshiftPosts, ...broadPosts];

    // Add comments as individual "posts"
    for (const c of pushshiftComments.filter(c => scoreHumanQuality(c.text) > 2).slice(0, 10)) {
      const paras = extractBestParagraphs(c.text, 1);
      for (const para of paras) {
        results.human.push({ source: c.source, text: para });
        results.sources.push(c.source);
      }
    }

    console.log(`  → Pushshift returned ${pushshiftPosts.length + broadPosts.length} posts, ${pushshiftComments.length} comments`);
  }

  if (allPosts.length === 0) {
    console.log(`  → No examples found from any source — pipeline will continue without Reddit examples`);
    return results;
  }

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

  // For the best posts, also grab their top comments (only if we have URLs from direct Reddit)
  const postsWithUrls = top.slice(0, 3).filter(p => p.url && p.url.includes('reddit.com'));
  if (postsWithUrls.length > 0) {
    const commentFetches = await Promise.all(
      postsWithUrls.map(p => fetchRedditComments(p.url, 15))
    );
    const topComments = commentFetches.flat()
      .filter(c => scoreHumanQuality(c.text) > 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    for (const comment of topComments) {
      const paras = extractBestParagraphs(comment.text, 1);
      for (const para of paras) {
        results.human.push({ source: comment.source, text: para });
      }
    }
  }

  // Extract clean paragraphs from top posts
  for (const post of top.slice(0, 8)) {
    const paras = extractBestParagraphs(post.text, 2);
    for (const para of paras) {
      results.human.push({ source: post.source, text: para });
      results.sources.push(post.source);
    }
  }

  console.log(`  → Got ${results.human.length} real human paragraphs`);
  return results;
}

// ── Score how "human" a piece of text is ─────────────────────────────────────
function scoreHumanQuality(text) {
  if (!text || text.length < 80) return 0;
  let score = 0;

  if (/\bI (think|feel|believe|realized|found|learned|noticed)\b/i.test(text)) score += 2;
  if (/\b(honestly|actually|basically|literally|kind of|sort of)\b/i.test(text)) score += 2;
  if (/\b(tbh|ngl|imo|imho|fwiw|iirc)\b/i.test(text)) score += 3;
  if (/\.\.\./g.test(text)) score += 1;
  if (/\b(my|our|we|us)\b/i.test(text)) score += 1;
  if (/[?!]{2}/.test(text)) score += 1;
  if (/\b(but|and|so|because|since|though|although)\b/i.test(text)) score += 1;
  if (text.includes("'")) score += 1;
  if (/\b\d+\b/.test(text)) score += 1;
  if (text.split('\n').length > 1) score += 1;

  if (/\b(furthermore|moreover|additionally|nevertheless|consequently)\b/i.test(text)) score -= 3;
  if (/\b(it is important to|it is worth noting|it should be noted)\b/i.test(text)) score -= 3;
  if (/\b(multifaceted|nuanced|comprehensive|holistic|paradigm)\b/i.test(text)) score -= 2;
  if (/^(In conclusion|To summarize|In summary)/i.test(text)) score -= 4;
  if (/^(The [a-z]+ of [a-z]+)/i.test(text)) score -= 2;

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
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
