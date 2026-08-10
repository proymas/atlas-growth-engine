import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scoreCandidate, buildValueFirstDraft, type RedditCandidate } from './radar-core.js';

const authFile = path.resolve('.auth/reddit-storage-state.json');
const stateDir = path.resolve('.state');
const stateFile = path.join(stateDir, 'reddit.json');

const subreddits = ['SideProject', 'SaaS', 'startups', 'Entrepreneur', 'indiehackers'];
const minScore = 4;
const maxPerSubreddit = 20;

await fs.mkdir(stateDir, { recursive: true });

let seen: Record<string, { firstSeen: string; lastSeen: string }> = {};
try {
  seen = JSON.parse(await fs.readFile(stateFile, 'utf8'));
} catch {}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile });
const page = await context.newPage();

const candidates: RedditCandidate[] = [];

for (const subreddit of subreddits) {
  const url = `https://www.reddit.com/r/${subreddit}/new/`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const status = response?.status() ?? null;

  if (!response?.ok()) {
    console.error(JSON.stringify({ subreddit, ok: false, status, url: page.url() }));
    continue;
  }

  await page.waitForTimeout(1500);

  const posts = await page.locator('shreddit-post').evaluateAll((nodes, limit) => {
    return nodes.slice(0, Number(limit)).map((node: any) => ({
      id: String(node.getAttribute('id') ?? node.getAttribute('thingid') ?? node.getAttribute('post-id') ?? ''),
      title: String(node.getAttribute('post-title') ?? ''),
      author: String(node.getAttribute('author') ?? ''),
      permalink: String(node.getAttribute('permalink') ?? ''),
      contentHref: String(node.getAttribute('content-href') ?? ''),
    }));
  }, maxPerSubreddit);

  let extracted = 0;
  for (const post of posts) {
    const href = post.permalink || post.contentHref;
    if (!post.title || !href) continue;

    const absoluteUrl = href.startsWith('http') ? href : `https://www.reddit.com${href}`;
    const idMatch = absoluteUrl.match(/\/comments\/([^/]+)/i);
    const id = post.id || idMatch?.[1] || absoluteUrl;

    candidates.push({
      id,
      subreddit,
      title: post.title,
      body: '',
      author: post.author,
      url: absoluteUrl,
      createdUtc: 0,
    });
    extracted += 1;
  }

  console.error(JSON.stringify({ subreddit, ok: true, status, extracted }));
}

const now = new Date().toISOString();
const scored = candidates
  .map(scoreCandidate)
  .filter((x) => x.score >= minScore)
  .sort((a, b) => b.score - a.score)
  .slice(0, 10)
  .map((x) => ({
    ...x,
    alreadySeen: Boolean(seen[x.id]),
    draft: buildValueFirstDraft(x),
  }));

for (const item of scored) {
  const prev = seen[item.id];
  seen[item.id] = { firstSeen: prev?.firstSeen ?? now, lastSeen: now };
}
await fs.writeFile(stateFile, JSON.stringify(seen, null, 2));

console.log(JSON.stringify({
  ok: true,
  scanned: candidates.length,
  qualified: scored.length,
  opportunities: scored,
}, null, 2));

await browser.close();
