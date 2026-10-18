// DEV: screenshots of the Punch Card sticker (banner, in progress, done, failed), the Staff Only door and the goblin select signatures.
// Usage: node tools/punch-shot.mjs [url] [outDir]  (starts its own dev server when no url is given)
import { chromium } from 'playwright';
import { devUrl } from './lib/dev.mjs';
const base = await devUrl(process.argv[2]), out = process.argv[3] ?? 'screenshots';
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

// ── live path (no forced progress): real kills move the counter, completion pays, the Staff Only door lands correctly ──
await open('sim=punch-card');
await page.waitForSelector('#punch:not(.hidden)', { timeout: 15000 });
await page.evaluate(() => { const s = window.__gg.store.state; s.labGod = true; s.punch = { goal: 'heat', target: 20, progress: 0, status: 'active', coins: 5 }; window.__gg.store.changed(); });
await page.waitForFunction(() => window.__gg.store.state.punch.progress > 0, null, { timeout: 25000 }).catch(() => {});
const heat = await page.evaluate(() => window.__gg.store.state.punch.progress);
console.log('heat kills counted by real fights:', heat, heat > 0 ? 'OK' : 'FAIL');
const money0 = await page.evaluate(() => { const s = window.__gg.store.state; s.punch.progress = s.punch.target - 1; return s.money; });
await page.waitForFunction(() => window.__gg.store.state.punch.status === 'done', null, { timeout: 30000 });
const paid = await page.evaluate(() => ({ money: window.__gg.store.state.money, bark: document.querySelector('#bark').textContent, coins: window.__gg.store.state.punch.coins }));
console.log('completion:', JSON.stringify(paid), 'was', money0, paid.money - money0 >= paid.coins && paid.bark === 'Punched!' ? 'OK' : 'FAIL');
await page.screenshot({ path: `${out}/punch-done-live.png` });

await open('sim=shortcut-key');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 15000 });
await page.evaluate(() => window.__gg.flow.leaveShop());
await page.click('.door.shortcut');
await page.waitForFunction(() => window.__gg.store.state.phase === 'combat', null, { timeout: 8000 });
await page.waitForTimeout(800);
const land = await page.evaluate(() => { const s = window.__gg.store.state; return { wave: s.wave, hp: s.hp, max: s.build.maxHp, key: [...s.inventory.placed, ...s.inventory.shelf].filter(Boolean).map((i) => i.type), bark: document.querySelector('#bark').textContent }; });
console.log('shortcut landing:', JSON.stringify(land), land.wave === 4 && land.hp === land.max && land.key.includes('spentkey') ? 'OK' : 'FAIL');
await page.screenshot({ path: `${out}/staff-only-landing.png` });

await open('sim=shortcut-key');
await page.waitForSelector('#shop:not(.hidden)', { timeout: 15000 });
await page.evaluate(() => { const { flow, store } = window.__gg; store.state.lab = false; store.state.shopLevel = 3; flow.leaveShop(); }); // Loyalty 3 rolls three doors, plus Staff Only
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/staff-only-four-doors.png` });

await page.goto(base);
await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="play"]');
for (const s of ['toaster', 'pan', 'coupon', 'night']) { await page.click(`[data-starter="${s}"]`); await page.waitForTimeout(150); await page.screenshot({ path: `${out}/goblin-${s}.png`, clip: { x: 0, y: 80, width: 1280, height: 640 } }); }
await page.goto(base); await page.waitForSelector('#title:not(.hidden)');
await page.click('[data-act="codex"]'); await page.click('[data-act="codex-tab"][data-tab="items"]'); await page.waitForTimeout(300);
console.log('catalog items:', await page.evaluate(() => document.querySelectorAll('.codex-card').length));
console.log(errs.join(';') || 'no page errors');
await b.close();
