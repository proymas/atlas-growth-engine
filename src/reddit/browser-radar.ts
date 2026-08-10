import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scoreCandidate, buildValueFirstDraft, type RedditCandidate } from './radar-core.js';

const profileDir = path.resolve('.auth/reddit-profile');
const stateDir = path.resolve('.state');
const stateFile = path.join(stateDir, 'reddit.json');

const subreddits = ['SideProject', 'SaaS', 'startups', 'Entrepreneur', 'indiehackers'];
const minScore = 4;

await fs.mkdir(profileDir, { recursive: true });
await fs.mkdir(stateDir, { recursive: true });

let seen: Record<string, { firstSeen: string; lastSeen: string }> = {};
try {
  seen = JSON.parse(await fs.readFile(stateFile, 'utf8'));
} catch {}

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
});
const pages = context.pages();
const page = pages[0] ?? await context.newPage();

const candidates: RedditCandidate[] = [];

for (const subreddit of subreddits) {
  const url = `https://www.reddit.com/r/${subreddit}/new/`;
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } catch (error) {
    console.error(JSON.stringify({ subreddit, ok: false, error: String(error) }));
    continue;
  }

  const status = response?.status() ?? null;
  if (!response?.ok()) {
    console.error(JSON.stringify({ subreddit, ok: false, status, url: page.url() }));
    continue;
  }

  await page.waitForTimeout(2500);

  const extracted = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/comments/"]')) as HTMLAnchorElement[];
    const out: Array<{ id: string; title: string; url: string }> = [];
    const used = new Set<string>();

    for (const a of anchors) {
      const href = a.href;
      const match = href.match(/\/comments\/([a-z0-9]+)\//i);
      if (!match) continue;
      const id = match[1];
      const title = (a.textContent ?? '').trim().replace(/\s+/g, ' ');
      if (!title || title.length < 8 || used.has(id)) continue;
      used.add(id);
      out.push({ id, title, url: href.split('?')[0] });
    }
    return out.slice(0, 25);
  });

  console.log(JSON.stringify({ subreddit, ok: true, status, extracted: extracted.length }));

  for (const item of extracted) {
    candidates.push({
      id: item.id,
      subreddit,
      title: item.title,
      body: '',
      author: '',
      url: item.url,
      createdUtc: 0,
    });
  }

  await page.waitForTimeout(1800);
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

await context.close();
