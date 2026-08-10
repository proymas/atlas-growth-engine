import { chromium } from 'playwright';
import path from 'node:path';
import { readThreadContext } from './thread-context.js';
import { decideConversation, buildReply } from './conversation-core.js';
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

for (const prior of published) {
  try {
    const ctx = await readThreadContext(page, prior.threadUrl);
    if (!ctx) continue;
    const hasNewExternalReply = ctx.comments.some(c => c.author && c.author !== 'AtlasValidProj' && c.body.length > 20);
    if (!hasNewExternalReply) continue;
    const decision = decideConversation(ctx);
    if (!decision.shouldReply) continue;
    const text = buildReply(ctx, decision);
    const action = await enqueueAction(ctx, decision, text, 'followup');
    if (action) {
      queued++;
      console.log(JSON.stringify({ followupQueued: true, threadUrl: ctx.url, actionId: action.id }));
    }
    await page.waitForTimeout(1400);
  } catch (error) {
    console.error(JSON.stringify({ threadUrl: prior.threadUrl, error: String(error) }));
  }
}

console.log(JSON.stringify({ ok: true, queued }, null, 2));
await context.close();
