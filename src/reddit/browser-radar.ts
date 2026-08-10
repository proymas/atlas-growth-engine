import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scoreCandidate, buildValueFirstDraft, type RedditCandidate } from './radar-core.js';

const authFile = path.resolve('.auth/reddit-storage-state.json');
const stateDir = path.resolve('.state');
const stateFile = path.join(stateDir, 'reddit.json');

const subreddits = ['SideProject', 'SaaS', 'startups', 'Entrepreneur', 'indiehackers'];
const maxPerSubreddit = 20;
const minScore = 4;

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
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${maxPerSubreddit}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!response?.ok()) {
    console.error(JSON.stringify({ subreddit, ok: false, status: response?.status() ?? null }));
    continue;
  }

  const raw = await page.locator('body').innerText();
  let json: any;
  try { json = JSON.parse(raw); } catch { continue; }

  for (const child of json?.data?.children ?? []) {
    const d = child?.data ?? {};
    if (!d.id || !d.title || !d.permalink) continue;
    candidates.push({
      id: String(d.id),
      subreddit,
      title: String(d.title),
      body: String(d.selftext ?? ''),
      author: String(d.author ?? ''),
      url: `https://www.reddit.com${d.permalink}`,
      createdUtc: Number(d.created_utc ?? 0),
    });
  }
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
