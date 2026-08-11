import { buildSearchQueries, draftReply, scoreCandidate, type XCandidate } from './growth-core.js';
import { loadXState, saveXState, upsertRecord } from './state.js';
import { launchXContext } from './browser-context.js';

const context = await launchXContext(false);
const page = context.pages()[0] ?? await context.newPage();
const state = await loadXState();
const candidates = new Map<string, XCandidate>();

try {
  for (const query of buildSearchQueries()) {
    const url = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(2500);

    const found = await page.locator('article').evaluateAll((articles) => articles.slice(0, 12).map((article) => {
      const statusLink = Array.from(article.querySelectorAll('a')).find((a) => /\/status\/\d+/.test(a.getAttribute('href') || '')) as HTMLAnchorElement | undefined;
      if (!statusLink) return null;
      const href = statusLink.getAttribute('href') || '';
      const match = href.match(/^\/([^/]+)\/status\/(\d+)/);
      if (!match) return null;
      const text = (article.querySelector('[data-testid="tweetText"]')?.textContent || '').trim();
      return { id: match[2], username: match[1], url: `https://x.com${href.split('?')[0]}`, text };
    }).filter(Boolean));

    for (const raw of found as Array<{id:string; username:string; url:string; text:string}>) {
      if (!raw.text || raw.username.toLowerCase() === 'atlasvalidproj') continue;
      candidates.set(raw.id, { ...raw, discoveredAt: new Date().toISOString() });
    }
    await page.waitForTimeout(1200);
  }

  const decisions = [...candidates.values()].map(scoreCandidate).sort((a, b) => b.score - a.score);
  const queue = decisions.filter((d) => d.qualified && !state.records[d.candidate.id]).slice(0, 10).map((d) => ({
    id: d.candidate.id, url: d.candidate.url, username: d.candidate.username, score: d.score,
    reasons: d.reasons, text: d.candidate.text, proposedReply: draftReply(d),
  }));

  for (const d of decisions) {
    if (state.records[d.candidate.id]) continue;
    upsertRecord(state, {
      id: d.candidate.id, url: d.candidate.url, username: d.candidate.username,
      status: d.qualified ? 'qualified' : 'seen', score: d.score,
      ...(d.qualified ? { lastReplyText: d.candidate.text } : {}),
    });
  }
  await saveXState(state);
  console.log(JSON.stringify({ mode: 'browser-radar', discovered: candidates.size, qualified: decisions.filter((d) => d.qualified).length, actionQueue: queue }, null, 2));
} finally { await context.close(); }
