import { chromium, type Page } from 'playwright';
import path from 'node:path';
import { listQueued, updateAction } from './action-queue.js';

const live = process.env.REDDIT_LIVE_POSTING === '1';
if (!live) {
  console.log(JSON.stringify({ ok: true, live: false, message: 'REDDIT_LIVE_POSTING is not enabled; queued replies will not be published.' }, null, 2));
  process.exit(0);
}

const queued = (await listQueued()).slice(0, 3);
console.log(JSON.stringify({ ok: true, live: true, queued: queued.length }));
if (queued.length === 0) process.exit(0);

const profileDir = path.resolve('.auth/reddit-profile');
const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: null });

async function freshPage(): Promise<Page> {
  const open = context.pages().find(p => !p.isClosed());
  if (open) return open;
  return await context.newPage();
}

for (const action of queued) {
  let page: Page | null = null;
  try {
    page = await freshPage();
    await page.goto(action.threadUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (page.isClosed()) page = await context.newPage();
    await page.waitForTimeout(1800);

    const replyBox = page.locator('textarea[placeholder*="comment" i], shreddit-composer textarea, textarea').first();
    await replyBox.waitFor({ state: 'visible', timeout: 15_000 });
    await replyBox.fill(action.text);

    const submit = page.getByRole('button', { name: /comment|reply/i }).last();
    await submit.waitFor({ state: 'visible', timeout: 10_000 });
    await submit.click();

    await page.waitForTimeout(2500);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const needle = action.text.trim().slice(0, Math.min(80, action.text.trim().length));
    if (!needle || !bodyText.includes(needle)) {
      await updateAction(action.id, { status: 'failed', error: 'publish_not_verified' });
      console.error(JSON.stringify({ published: false, actionId: action.id, error: 'publish_not_verified' }));
      continue;
    }

    await updateAction(action.id, { status: 'published', publishedAt: new Date().toISOString(), commentUrl: page.url() });
    console.log(JSON.stringify({ published: true, threadUrl: action.threadUrl, actionId: action.id, verified: true }));
    await page.waitForTimeout(1500);
  } catch (error) {
    await updateAction(action.id, { status: 'failed', error: String(error) });
    console.error(JSON.stringify({ published: false, actionId: action.id, error: String(error) }));
  }
}

await context.close();
