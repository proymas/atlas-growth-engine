import { chromium } from 'playwright';

const targets = [
  'https://www.reddit.com/r/SideProject/new/',
  'https://old.reddit.com/r/SideProject/new/',
  'https://www.reddit.com/r/SideProject/new.json?limit=5',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  locale: 'en-US',
  viewport: { width: 1365, height: 768 },
});

const results = [];

try {
  for (const target of targets) {
    const page = await context.newPage();
    try {
      const response = await page.goto(target, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      results.push({
        target,
        ok: Boolean(response?.ok()),
        status: response?.status() ?? null,
        url: page.url(),
        title: await page.title(),
        bodyPrefix: (await page.locator('body').innerText().catch(() => '')).slice(0, 180),
      });
    } catch (error) {
      results.push({ target, error: error instanceof Error ? error.message : String(error) });
    } finally {
      await page.close();
    }
  }

  console.log(JSON.stringify(results, null, 2));

  if (!results.some((r) => 'ok' in r && r.ok)) {
    process.exitCode = 2;
  }
} finally {
  await context.close();
  await browser.close();
}
