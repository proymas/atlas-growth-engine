import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const authDir = path.resolve('.auth');
const authFile = path.join(authDir, 'reddit-storage-state.json');

await fs.mkdir(authDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

console.log('\nSe abrirá Reddit en Chromium.');
console.log('1) Inicia sesión manualmente con la cuenta de Atlas.');
console.log('2) Cuando veas Reddit ya autenticado, vuelve a esta ventana.');
console.log('3) Pulsa ENTER para guardar la sesión localmente.\n');

await page.goto('https://www.reddit.com/login/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

process.stdin.resume();
await new Promise<void>((resolve) => {
  process.stdin.once('data', () => resolve());
});

await context.storageState({ path: authFile });
console.log(`Sesión guardada localmente en ${authFile}`);
console.log('Ese archivo está excluido de Git y no debe compartirse.');

await browser.close();
process.stdin.pause();
