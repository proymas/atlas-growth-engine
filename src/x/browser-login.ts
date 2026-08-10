import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const authPath = resolve('.auth/x.json');
await mkdir(dirname(authPath), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1365, height: 768 },
  locale: 'en-US',
});
const page = await context.newPage();

console.log('Abriendo X. Inicia sesión manualmente con la cuenta de Atlas.');
await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45_000 });

process.stdout.write('Cuando veas la cuenta de Atlas iniciada en X, vuelve aquí y pulsa Enter...');
await new Promise<void>((resolveInput) => {
  process.stdin.resume();
  process.stdin.once('data', () => resolveInput());
});

await context.storageState({ path: authPath });
console.log(`Sesión guardada en ${authPath}`);
await context.close();
await browser.close();
process.stdin.pause();
