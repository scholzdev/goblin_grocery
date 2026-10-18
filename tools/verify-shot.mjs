// Screenshot a sim in the running dev server: node tools/verify-shot.mjs <sim-id> <out.png> [waitMs] [js]
// `js` (optional) runs in the page first; `window.__gg` (store, rules, flow) and `window.__arena` exist in dev. Starts its own dev server (or set GG_URL); needs system Chrome.
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const [sim, out = `screenshots/${sim}.png`, wait = '6000', js] = process.argv.slice(2);
if (!sim) { console.error('usage: node tools/verify-shot.mjs <sim-id> <out.png> [waitMs] [js]'); process.exit(1); }
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(new URL(`?sim=${sim}`, await devUrl()).href);
await page.waitForTimeout(1500);
if (js) console.log('js ->', JSON.stringify(await page.evaluate(js)));
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
console.log('saved', out, errs.join(';') || 'no errors');
await b.close();
