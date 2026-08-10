import { chromium } from 'playwright';
import path from 'node:path';
import { listQueued, updateAction } from './action-queue.js';

const live = process.env.REDDIT_LIVE_POSTING === '1';
if (!live) {
  console.log(JSON.stringify({ ok: true, live: false, message: 'REDDIT_LIVE_POSTING is not enabled; queued replies will not be published.' }, null, 2));
  process.exit(0);
}

const profileDir = path.resolve('.auth/reddit-profile');
const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: null });
const page = context.pages()[0] ?? await context.newPage();
const queued = (await listQueued()).slice(0, 3);

for (const action of queued) {
  try {
    await page.goto(action.threadUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(1800);

    const replyBox = page.locator('textarea[placeholder*="comment" i], textarea').first();
    if (await replyBox.count() === 0) {
      await updateAction(action.id, { status: 'failed', error: 'reply_box_not_found' });
      continue;
    }
    await replyBox.fill(action.text);

    const submit = page.getByRole('button', { name: /comment|reply/i }).last();
    if (await submit.count() === 0) {
      await updateAction(action.id, { status: 'failed', error: 'submit_button_not_found' });
      continue;
    }

    await submit.click();
    await page.waitForTimeout(1800);
    await updateAction(action.id, { status: 'published', publishedAt: new Date().toISOString(), commentUrl: page.url() });
    console.log(JSON.stringify({ published: true, threadUrl: action.threadUrl, actionId: action.id }));
    await page.waitForTimeout(3500);
  } catch (error) {
    await updateAction(action.id, { status: 'failed', error: String(error) });
    console.error(JSON.stringify({ published: false, actionId: action.id, error: String(error) }));
  }
}

await context.close();
