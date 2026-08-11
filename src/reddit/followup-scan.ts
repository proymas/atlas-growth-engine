import { chromium } from 'playwright';
import path from 'node:path';
import { readThreadContext } from './thread-context.js';
import { reasonWithGemini } from './gemini-reasoner.js';
import { enqueueAction } from './action-queue.js';
import fs from 'node:fs/promises';

const profileDir = path.resolve('.auth/reddit-profile');
const actionsFile = path.resolve('.state/reddit-actions.json');
let actions: any[] = [];
try { actions = JSON.parse(await fs.readFile(actionsFile, 'utf8')); } catch {}
const published = actions.filter(a => a.status === 'published').slice(-20);

const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: null });
const page = context.pages()[0] ?? await context.newPage();
let queued = 0;
let skipped = 0;
let failed = 0;
let geminiCalls = 0;

function hasReplyToAtlas(comments: Array<{ author: string; body: string; depth: number }>) {
  for (let i = 0; i < comments.length; i++) {
    const mine = comments[i];
    if (mine.author !== 'AtlasValidProj') continue;
    for (let j = i + 1; j < comments.length; j++) {
      const c = comments[j];
      if (c.depth <= mine.depth) break;
      if (c.author && c.author !== 'AtlasValidProj' && c.body.length > 5) return true;
    }
  }
  return false;
}

for (const prior of published) {
  try {
    const ctx = await readThreadContext(page, prior.threadUrl);
    if (!ctx) continue;

    if (!hasReplyToAtlas(ctx.comments)) {
      skipped++;
      console.log(JSON.stringify({ followupQueued: false, threadUrl: ctx.url, reason: 'no_new_reply_to_atlas' }));
      continue;
    }

    geminiCalls++;
    const gemini = await reasonWithGemini(ctx, 'followup');
    if (!gemini.shouldReply) {
      skipped++;
      console.log(JSON.stringify({ followupQueued: false, threadUrl: ctx.url, reason: gemini.reason, confidence: gemini.confidence }));
      continue;
    }

    const { replyText, mentionAtlas, confidence, summary, ...decision } = gemini;
    const action = await enqueueAction(ctx, decision, replyText, 'followup');
    if (action) {
      queued++;
      console.log(JSON.stringify({ followupQueued: true, threadUrl: ctx.url, actionId: action.id, mentionAtlas, confidence, summary }));
    }
    await page.waitForTimeout(1400);
  } catch (error) {
    failed++;
    console.error(JSON.stringify({ threadUrl: prior.threadUrl, error: String(error), failClosed: true }));
  }
}

console.log(JSON.stringify({ ok: failed === 0, queued, skipped, failed, geminiCalls }, null, 2));
await context.close();
