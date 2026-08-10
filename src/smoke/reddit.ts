import { chromium } from 'playwright';

const target = process.env.REDDIT_SMOKE_URL ?? 'https://www.reddit.com/r/SideProject/new/';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'AtlasGrowthEngine/0.1 (+https://atlas-beta-2.vercel.app; smoke-test only)',
});

try {
  const page = await context.newPage();
  const response = await page.goto(target, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  console.log(
    JSON.stringify(
      {
        ok: Boolean(response?.ok()),
        status: response?.status() ?? null,
        url: page.url(),
        title: await page.title(),
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
