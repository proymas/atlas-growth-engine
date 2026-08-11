import { chromium, type Locator, type Page } from 'playwright';
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

async function firstVisible(candidates: Locator[], timeoutMs = 12_000): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      const count = await candidate.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        const item = candidate.nth(i);
        if (await item.isVisible().catch(() => false)) return item;
      }
    }
    await new Promise(r => setTimeout(r, 350));
  }
  return null;
}

async function findEditor(page: Page): Promise<Locator | null> {
  // Reddit can render either a classic textarea or the newer rich-text composer.
  const trigger = await firstVisible([
    page.getByText(/add a comment|join the conversation/i),
    page.getByRole('button', { name: /add a comment|comment/i }),
  ], 4_000);
  if (trigger) await trigger.click().catch(() => {});

  return await firstVisible([
    page.locator('shreddit-composer textarea'),
    page.locator('textarea[placeholder*="comment" i]'),
    page.locator('shreddit-composer [contenteditable="true"]'),
    page.locator('[data-testid*="comment" i] [contenteditable="true"]'),
    page.locator('div[contenteditable="true"][role="textbox"]'),
    page.locator('textarea'),
    page.locator('[contenteditable="true"]'),
  ], 15_000);
}

async function fillEditor(editor: Locator, text: string) {
  const tag = await editor.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
  if (tag === 'textarea' || tag === 'input') {
    await editor.fill(text);
    return;
  }
  await editor.click();
  await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
  await editor.fill(text).catch(async () => {
    await editor.evaluate((el, value) => {
      el.textContent = String(value);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(value) }));
    }, text);
  });
}

async function findSubmit(page: Page, editor: Locator): Promise<Locator | null> {
  const composer = editor.locator('xpath=ancestor::shreddit-composer[1]');
  const form = editor.locator('xpath=ancestor::form[1]');
  return await firstVisible([
    composer.locator('button[type="submit"]'),
    composer.getByRole('button', { name: /^comment$|^reply$|post/i }),
    form.locator('button[type="submit"]'),
    form.getByRole('button', { name: /^comment$|^reply$|post/i }),
    page.locator('button[type="submit"]').filter({ hasText: /comment|reply|post/i }),
    page.getByRole('button', { name: /^comment$|^reply$|post/i }),
    page.locator('button[aria-label*="comment" i], button[aria-label*="reply" i]'),
  ], 12_000);
}

for (const action of queued) {
  let page: Page | null = null;
  try {
    page = await freshPage();
    await page.goto(action.threadUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (page.isClosed()) {
      page = await context.newPage();
      await page.goto(action.threadUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    }
    await page.waitForTimeout(2200);

    const editor = await findEditor(page);
    if (!editor) throw new Error('reply_editor_not_found');
    await fillEditor(editor, action.text);
    await page.waitForTimeout(600);

    const submit = await findSubmit(page, editor);
    if (!submit) throw new Error('submit_button_not_found');
    if (await submit.isDisabled().catch(() => false)) throw new Error('submit_button_disabled');
    await submit.click();

    await page.waitForTimeout(3500);
    const needle = action.text.trim().slice(0, Math.min(70, action.text.trim().length));
    const verified = await page.locator('body').innerText().then(t => Boolean(needle && t.includes(needle))).catch(() => false);
    if (!verified) {
      await updateAction(action.id, { status: 'failed', error: 'publish_not_verified' });
      console.error(JSON.stringify({ published: false, actionId: action.id, error: 'publish_not_verified' }));
      continue;
    }

    await updateAction(action.id, { status: 'published', publishedAt: new Date().toISOString(), commentUrl: page.url() });
    console.log(JSON.stringify({ published: true, threadUrl: action.threadUrl, actionId: action.id, verified: true }));
  } catch (error) {
    await updateAction(action.id, { status: 'failed', error: String(error) });
    console.error(JSON.stringify({ published: false, actionId: action.id, error: String(error) }));
  }
}

await context.close();
