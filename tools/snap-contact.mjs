// Renders contact sheets with system Chrome. Usage: node tools/snap-contact.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = 'file://' + path.join(root, 'public/assets/svg/contact-sheet.html');
fs.mkdirSync(path.join(root, 'screenshots'), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
for (const [hash, name] of [['', 'contact-sheet'], ['#zoom', 'contact-sheet-zoom']]) {
  await page.goto(url + hash);
  await page.reload();
  await page.waitForLoadState('load');
  await page.screenshot({ path: path.join(root, 'screenshots', `${name}.png`), fullPage: true });
}
await browser.close();
