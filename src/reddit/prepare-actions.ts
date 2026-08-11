import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readThreadContext } from './thread-context.js';
import { reasonWithGemini } from './gemini-reasoner.js';
import { enqueueAction, type RedditAction } from './action-queue.js';

const profileDir = path.resolve('.auth/reddit-profile');
const stateFile = path.resolve('.state/reddit.json');
const actionsFile = path.resolve('.state/reddit-actions.json');
const decisionsFile = path.resolve('.state/reddit-decisions.json');

type DecisionState = Record<string, { analyzedAt: string; shouldReply: boolean; reason?: string; retryAfter?: string }>;
let seen: Record<string, { firstSeen?: string; lastSeen?: string; url?: string }> = {};
let previousActions: RedditAction[] = [];
let decisions: DecisionState = {};
try { seen = JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch {}
try { previousActions = JSON.parse(await fs.readFile(actionsFile, 'utf8')); } catch {}
try { decisions = JSON.parse(await fs.readFile(decisionsFile, 'utf8')); } catch {}

const saveDecisions = () => fs.writeFile(decisionsFile, JSON.stringify(decisions, null, 2), 'utf8');
const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: null });
const page = context.pages()[0] ?? await context.newPage();
let prepared = 0;
let skipped = 0;
let failed = 0;
let geminiCalls = 0;
const maxGeminiCalls = Number(process.env.REDDIT_MAX_GEMINI_CALLS || 2);
const now = Date.now();

function backoffMs(error: string) {
  if (/gemini_http_429/.test(error)) return 15 * 60_000;
  if (/gemini_http_503/.test(error)) return 5 * 60_000;
  return 0;
}

for (const [id, meta] of Object.entries(seen).reverse().slice(0, 12)) {
  if (!meta.url) continue;

  const existing = previousActions.filter(a => a.threadId === id && a.kind === 'reply');
  if (existing.some(a => a.status === 'queued' || a.status === 'published')) {
    skipped++;
    continue;
  }

  const latestFailed = [...existing].reverse().find(a => a.status === 'failed' && a.text?.trim());
  if (latestFailed) {
    try {
      const ctx = await readThreadContext(page, meta.url);
      if (!ctx) continue;
      const action = await enqueueAction(ctx, latestFailed.decision, latestFailed.text, 'reply');
      if (action) {
        prepared++;
        console.log(JSON.stringify({ prepared: true, requeued: true, threadId: id, url: ctx.url, text: latestFailed.text }));
      }
    } catch (error) {
      failed++;
      console.error(JSON.stringify({ threadId: id, error: String(error), failClosed: true }));
    }
    continue;
  }

  const cached = decisions[id];
  if (cached?.shouldReply === false) {
    skipped++;
    console.log(JSON.stringify({ prepared: false, cached: true, threadId: id, reason: cached.reason ?? 'previously_rejected' }));
    continue;
  }
  if (cached?.retryAfter && Date.parse(cached.retryAfter) > now) {
    skipped++;
    console.log(JSON.stringify({ prepared: false, cooldown: true, threadId: id, retryAfter: cached.retryAfter }));
    continue;
  }

  if (geminiCalls >= maxGeminiCalls) {
    skipped++;
    continue;
  }

  try {
    const ctx = await readThreadContext(page, meta.url);
    if (!ctx) continue;
    geminiCalls++;
    const gemini = await reasonWithGemini(ctx, 'reply');
    decisions[id] = { analyzedAt: new Date().toISOString(), shouldReply: gemini.shouldReply, reason: gemini.reason };
    await saveDecisions();

    if (!gemini.shouldReply) {
      skipped++;
      console.log(JSON.stringify({ prepared: false, threadId: id, url: ctx.url, reason: gemini.reason, confidence: gemini.confidence }));
      continue;
    }
    const { replyText, mentionAtlas, confidence, summary, ...decision } = gemini;
    const action = await enqueueAction(ctx, decision, replyText, 'reply');
    if (action) {
      prepared++;
      console.log(JSON.stringify({ prepared: true, threadId: id, url: ctx.url, decision, mentionAtlas, confidence, summary, text: replyText }));
    }
    await page.waitForTimeout(800);
  } catch (error) {
    const message = String(error);
    const wait = backoffMs(message);
    if (wait > 0) {
      decisions[id] = { analyzedAt: new Date().toISOString(), shouldReply: true, reason: 'temporary_gemini_error', retryAfter: new Date(Date.now() + wait).toISOString() };
      await saveDecisions();
      skipped++;
      console.error(JSON.stringify({ threadId: id, cooldown: true, retryAfter: decisions[id].retryAfter, error: message, failClosed: true }));
      continue;
    }
    failed++;
    console.error(JSON.stringify({ threadId: id, error: message, failClosed: true }));
  }
}

console.log(JSON.stringify({ ok: failed === 0, prepared, skipped, failed, geminiCalls }, null, 2));
await context.close();
