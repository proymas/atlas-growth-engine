import { chromium } from 'playwright';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const authPath = resolve('.auth/x.json');
await access(authPath);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authPath, locale: 'en-US' });
const page = await context.newPage();

try {
  const response = await page.goto('https://x.com/home', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.waitForTimeout(2500);
  const body = await page.locator('body').innerText().catch(() => '');
  const loginVisible = /sign in|log in|iniciar sesi[oó]n/i.test(body);
  const authenticatedLikely = !loginVisible && !/\/i\/flow\/login/.test(page.url());

  console.log(JSON.stringify({
    ok: Boolean(response?.ok()),
    status: response?.status() ?? null,
    url: page.url(),
    authenticatedLikely,
    bodyPrefix: body.slice(0, 220),
  }, null, 2));

  if (!authenticatedLikely) process.exitCode = 2;
} finally {
  await context.close();
  await browser.close();
}
