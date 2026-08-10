import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const authFile = path.resolve('.auth/reddit-storage-state.json');

try {
  await fs.access(authFile);
} catch {
  console.error('No existe .auth/reddit-storage-state.json. Ejecuta primero: npm.cmd run reddit:login');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: authFile });
const page = await context.newPage();

const response = await page.goto('https://www.reddit.com/', {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});

const body = (await page.locator('body').innerText()).slice(0, 800);
const hasLogin = /\bLog In\b/i.test(body);
const hasSignup = /\bSign Up\b/i.test(body);

console.log(JSON.stringify({
  ok: response?.ok() ?? false,
  status: response?.status() ?? null,
  url: page.url(),
  authenticatedLikely: !(hasLogin && hasSignup),
  bodyPrefix: body,
}, null, 2));

await browser.close();
