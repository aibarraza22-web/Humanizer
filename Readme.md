# Humanizer v8

Real Reddit scraping + 5-pass Groq/LLaMA pipeline.

## How it works

1. **Extract topic** — analyzes your text to get search keywords
2. **Scrape Reddit live** — fetches real posts + comments on your topic from Reddit's public JSON API (no auth needed)
3. **Rewrite** — rewrites using those real human examples as the training signal
4. **Surgical scrub** — fixes burstiness, banned words, AI sentence openers, missing fragments
5. **Verify** — model reviews its own output and fixes remaining AI patterns

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
open http://localhost:3000
```

## Requirements

- Node.js 18+
- Free Groq API key from https://console.groq.com
- Internet connection (for Reddit scraping)

## Why Node instead of pure browser?

Reddit's API blocks browser requests (CORS). The Node server fetches Reddit server-side where there's no CORS restriction, then passes the real examples to Groq.

## Deploying

Works on any Node host — Railway, Render, Fly.io, or just run locally.

For Vercel/Netlify (serverless), you'd need to move the Reddit scraping into an API route. Easiest is just running it locally.
