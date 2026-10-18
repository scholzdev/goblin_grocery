// Screenshot a sim in the running dev server: node tools/verify-shot.mjs <sim-id> <out.png> [waitMs] [js]
// `js` (optional) runs in the page first; `window.__gg` (store, rules, flow) and `window.__arena` exist in dev. Needs `npm run dev` on :5173 (PORT=n overrides) and system Chrome.
// `VIEW=1672x941` sets the viewport (default 1280x800); `LAB=1` opens `?lab` instead of `?sim=` (the sim id is then ignored); `LOCALE=de` starts the game in German; `BOOT=ms` is the wait before `js` runs (default 1500, raise it on a cold dev server).
import { chromium } from 'playwright';
const [sim, out = `screenshots/${sim}.png`, wait = '6000', js] = process.argv.slice(2);
if (!sim) { console.error('usage: node tools/verify-shot.mjs <sim-id> <out.png> [waitMs] [js]'); process.exit(1); }
const b = await chromium.launch({ channel: 'chrome' });
const [vw, vh] = (process.env.VIEW ?? '1280x800').split('x').map(Number);
const page = await b.newPage({ viewport: { width: vw, height: vh }, locale: process.env.LOCALE });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/?${process.env.LAB ? 'lab=1' : `sim=${sim}`}`);
await page.waitForTimeout(Number(process.env.BOOT ?? 1500));
if (js) console.log('js ->', JSON.stringify(await page.evaluate(js)));
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
console.log('saved', out, errs.join(';') || 'no errors');
await b.close();
