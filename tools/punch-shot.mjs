// DEV: screenshots of the Punch Card sticker (banner, in progress, done, failed), the Staff Only door and the goblin select signatures.
// Usage: npm run dev -- --port 5188, then `node tools/punch-shot.mjs http://localhost:5188/ [outDir]`.
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5173/', out = process.argv[3] ?? 'screenshots';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const open = async (q) => { await page.goto(`${base}?${q}`); await page.waitForFunction(() => window.__gg?.store.state.phase !== 'title' || document.querySelector('#title:not(.hidden)'), null, { timeout: 15000 }); };
const card = (fn, ...a) => page.evaluate(([f, args]) => { const p = window.__gg.store.state.punch; new Function('p', 'a', f)(p, args); window.__gg.store.changed(); }, [fn, a]);

await open('sim=punch-card');
await page.waitForSelector('#punch:not(.hidden)', { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/punch-banner.png` });
await page.waitForTimeout(2600);
await card('if (p.goal !== "nohit") p.progress = Math.round(p.target * 0.6); else p.progress = 12;');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/punch-progress.png` });
await card('p.progress = p.target; p.status = "done";');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/punch-done.png` });
await card('p.status = "failed"; p.progress = 3;');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/punch-failed.png` });
console.log('goal', await page.evaluate(() => JSON.stringify(window.__gg.store.state.punch)));

await open('sim=shortcut-key');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 15000 });
await page.evaluate(() => window.__gg.flow.leaveShop());
await page.waitForSelector('.door.shortcut', { timeout: 5000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/staff-only-door.png` });

await page.goto(base);
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]');
for (const s of ['toaster', 'pan', 'coupon', 'night']) { await page.click(`[data-starter="${s}"]`); await page.waitForTimeout(150); await page.screenshot({ path: `${out}/goblin-${s}.png`, clip: { x: 0, y: 80, width: 1280, height: 640 } }); }
console.log(errs.join(';') || 'no page errors');
await b.close();
