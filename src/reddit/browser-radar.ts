import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scoreCandidate, buildValueFirstDraft, type RedditCandidate } from './radar-core.js';

const profileDir = path.resolve('.auth/reddit-profile');
const stateDir = path.resolve('.state');
const stateFile = path.join(stateDir, 'reddit.json');

const subreddits = ['SideProject', 'SaaS', 'startups', 'Entrepreneur', 'indiehackers'];
const minScore = 3;

await fs.mkdir(profileDir, { recursive: true });
await fs.mkdir(stateDir, { recursive: true });

let seen: Record<string, { firstSeen: string; lastSeen: string; url?: string; subreddit?: string; title?: string; score?: number }> = {};
try { seen = JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch {}

const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: null });
let page = context.pages()[0] ?? await context.newPage();
const candidates: RedditCandidate[] = [];

async function ensurePage() {
  if (page.isClosed()) page = await context.newPage();
  return page;
}

for (const subreddit of subreddits) {
  const url = `https://www.reddit.com/r/${subreddit}/new/`;
  let response;
  try {
    const p = await ensurePage();
    response = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } catch (error) {
    console.error(JSON.stringify({ subreddit, ok: false, error: String(error) }));
    try { page = await context.newPage(); } catch {}
    continue;
  }

  const p = await ensurePage();
  const status = response?.status() ?? null;
  if (!response?.ok()) { console.error(JSON.stringify({ subreddit, ok: false, status, url: p.url() })); continue; }
  try { await p.waitForTimeout(2500); } catch { page = await context.newPage(); continue; }

  let extracted: Array<{ id: string; title: string; url: string }> = [];
  try {
    extracted = await p.evaluate(() => {
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
  } catch (error) {
    console.error(JSON.stringify({ subreddit, ok: false, phase: 'extract', error: String(error) }));
    try { page = await context.newPage(); } catch {}
    continue;
  }

  console.log(JSON.stringify({ subreddit, ok: true, status, extracted: extracted.length }));
  for (const item of extracted) candidates.push({ id: item.id, subreddit, title: item.title, body: '', author: '', url: item.url, createdUtc: 0 });
  try { await p.waitForTimeout(1000); } catch {}
}

const allScored = candidates.map(scoreCandidate).sort((a, b) => b.score - a.score);
const now = new Date().toISOString();
const scored = allScored.filter(x => x.score >= minScore).slice(0, 10).map(x => ({ ...x, alreadySeen: Boolean(seen[x.id]), draft: buildValueFirstDraft(x) }));

for (const item of scored) {
  const prev = seen[item.id];
  seen[item.id] = {
    firstSeen: prev?.firstSeen ?? now,
    lastSeen: now,
    url: item.url,
    subreddit: item.subreddit,
    title: item.title,
    score: item.score,
  };
}
await fs.writeFile(stateFile, JSON.stringify(seen, null, 2));

console.log(JSON.stringify({
  ok: true,
  scanned: candidates.length,
  qualified: scored.length,
  opportunities: scored,
  nearMisses: allScored.slice(0, 12).map(({ id, subreddit, title, url, score, signals, risk }) => ({ id, subreddit, title, url, score, signals, risk })),
}, null, 2));

await context.close();
