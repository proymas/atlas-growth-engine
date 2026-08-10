import { chromium } from 'playwright';

const target = 'https://www.reddit.com/r/SideProject/new.json?limit=5';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  locale: 'en-US',
  viewport: { width: 1365, height: 768 },
});

try {
  const page = await context.newPage();
  const response = await page.goto(target, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 300);
  const status = response?.status() ?? null;
  const rateLimited = status === 429 || /too many requests|whoa there, pardner/i.test(body);

  console.log(
    JSON.stringify(
      {
        target,
        ok: Boolean(response?.ok()) && !rateLimited,
        status,
        rateLimited,
        url: page.url(),
        bodyPrefix: body,
      },
      null,
      2,
    ),
  );

  if (rateLimited) {
    console.error('Reddit rate limit detected. Stop requests and retry later.');
    process.exitCode = 3;
  } else if (!response?.ok()) {
    process.exitCode = 2;
  }
} finally {
  await context.close();
  await browser.close();
}
