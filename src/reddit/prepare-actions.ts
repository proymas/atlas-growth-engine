import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readThreadContext } from './thread-context.js';
import { reasonWithGemini } from './gemini-reasoner.js';
import { enqueueAction } from './action-queue.js';

const profileDir = path.resolve('.auth/reddit-profile');
const stateFile = path.resolve('.state/reddit.json');
let seen: Record<string, { firstSeen?: string; lastSeen?: string; url?: string }> = {};
try { seen = JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch {}

const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: null });
const page = context.pages()[0] ?? await context.newPage();
let prepared = 0;
let skipped = 0;
let failed = 0;

for (const [id, meta] of Object.entries(seen).slice(-30)) {
  if (!meta.url) continue;
  try {
    const ctx = await readThreadContext(page, meta.url);
    if (!ctx) continue;
    const gemini = await reasonWithGemini(ctx, 'reply');
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
    await page.waitForTimeout(1200);
  } catch (error) {
    failed++;
    console.error(JSON.stringify({ threadId: id, error: String(error), failClosed: true }));
  }
}

console.log(JSON.stringify({ ok: failed === 0, prepared, skipped, failed }, null, 2));
await context.close();
