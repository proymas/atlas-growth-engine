import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readThreadContext } from './thread-context.js';
import { decideConversation, buildReply } from './conversation-core.js';
import { enqueueAction } from './action-queue.js';

const profileDir = path.resolve('.auth/reddit-profile');
const stateFile = path.resolve('.state/reddit.json');
let seen: Record<string, { firstSeen?: string; lastSeen?: string; url?: string }> = {};
try { seen = JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch {}

const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: null });
const page = context.pages()[0] ?? await context.newPage();
let prepared = 0;

for (const [id, meta] of Object.entries(seen).slice(-30)) {
  if (!meta.url) continue;
  try {
    const ctx = await readThreadContext(page, meta.url);
    if (!ctx) continue;
    const decision = decideConversation(ctx);
    if (!decision.shouldReply) continue;
    const text = buildReply(ctx, decision);
    if (!text || text.length < 40) continue;
    const action = await enqueueAction(ctx, decision, text, 'reply');
    if (action) {
      prepared++;
      console.log(JSON.stringify({ prepared: true, threadId: id, url: ctx.url, decision, text }));
    }
    await page.waitForTimeout(1200);
  } catch (error) {
    console.error(JSON.stringify({ threadId: id, error: String(error) }));
  }
}

console.log(JSON.stringify({ ok: true, prepared }, null, 2));
await context.close();
