import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const profileDir = resolve('.auth/x-profile');
await mkdir(profileDir, { recursive: true });
const context = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: null });
const page = context.pages()[0] ?? await context.newPage();
console.log('Abriendo X con perfil persistente. Si hay rate limit, no reintentes hasta que se libere.');
await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45_000 });
process.stdout.write('Cuando veas la cuenta de Atlas iniciada, vuelve aquí y pulsa Enter...');
await new Promise<void>(resolveInput => { process.stdin.resume(); process.stdin.once('data', () => resolveInput()); });
console.log(`Perfil persistente guardado en ${profileDir}`);
await context.close();
process.stdin.pause();
