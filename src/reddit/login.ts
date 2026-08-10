import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const authDir = path.resolve('.auth');
const profileDir = path.join(authDir, 'reddit-profile');

await fs.mkdir(profileDir, { recursive: true });

const context = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: null,
});

const pages = context.pages();
const page = pages[0] ?? await context.newPage();

console.log('\nSe abrirá Reddit en un perfil Chromium persistente.');
console.log('1) Inicia sesión manualmente con la cuenta de Atlas si hace falta.');
console.log('2) Cuando veas Reddit autenticado, vuelve a esta ventana.');
console.log('3) Pulsa ENTER para cerrar; el perfil completo quedará guardado localmente.\n');

await page.goto('https://www.reddit.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });

process.stdin.resume();
await new Promise<void>((resolve) => {
  process.stdin.once('data', () => resolve());
});

console.log(`Perfil persistente guardado localmente en ${profileDir}`);
console.log('Esa carpeta está excluida de Git y no debe compartirse.');

await context.close();
process.stdin.pause();
