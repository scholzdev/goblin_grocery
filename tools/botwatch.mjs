// Watches the in-page dev bot (src/bot/bot.ts, `?bot=1`) play whole runs and prints one line per run plus one per shop visit.
// Usage: node tools/botwatch.mjs [url=http://localhost:5173/?bot=1] [runs=3]   (needs the dev server running; the bot starts the runs and restarts itself)
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/?bot=1';
const runs = Number(process.argv[3] ?? 3);
const RUN_TIMEOUT = 15 * 60_000;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__gg && window.__botlog, null, { timeout: 60_000 });

const peek = () => page.evaluate(() => {
  const s = window.__gg.store.state;
  if (!s) return null;
  const inv = s.inventory;
  const items = (l) => l.filter(Boolean).map((i) => `${i.type}${(i.tier ?? 1) > 1 ? `*${i.tier}` : ''}`);
  return {
    seed: s.seed, phase: s.phase, wave: s.wave, hp: Math.round(s.hp), maxHp: Math.round(s.build.maxHp), money: s.money, kills: s.stats.kills,
    cart: items(inv.placed).join(' '), shelf: items(inv.shelf).join(' '), recipes: s.build.recipes.map((r) => r.id).join(','), size: `${inv.cols}x${inv.rows}`,
    shopLevel: s.shopLevel, shops: window.__botlog.shops, doors: window.__botlog.doors,
  };
});

let shopsSeen = 0, doorsSeen = 0, seed = null, t0 = Date.now(), done = 0;
const results = [];
while (done < runs) {
  const s = await peek();
  if (!s) { await page.waitForTimeout(1000); continue; }
  if (s.seed !== seed && s.phase !== 'victory' && s.phase !== 'defeat') { seed = s.seed; t0 = Date.now(); }
  for (; shopsSeen < s.shops.length; shopsSeen++) {
    const r = s.shops[shopsSeen], p = r.spend;
    console.log(`  run ${r.run} shop@${r.aisle}: hp ${r.hp}/${r.maxHp} $${r.moneyIn}->${r.moneyOut} (income ${r.income}) spend items ${p.items} merge ${p.merge}x repair ${p.repair} upgr ${p.upgrades} reroll ${p.reroll} | dps ${r.dps}/${r.need} tough ${r.tough}/${r.target} | ${r.acts.join(', ')}`);
  }
  for (; doorsSeen < s.doors.length; doorsSeen++) console.log(`    door ${s.doors[doorsSeen]}`);
  if (s.phase === 'victory' || s.phase === 'defeat') {
    const secs = Math.round((Date.now() - t0) / 1000);
    done++;
    const line = `run ${done}: ${s.phase === 'victory' ? 'WIN' : 'DEAD'} aisle=${s.wave} kills=${s.kills} maxHp=${s.maxHp} money=${s.money} cart=[${s.cart}] shelf=[${s.shelf}] ${s.size} loyalty=${s.shopLevel} recipes=[${s.recipes}] time=${secs}s`;
    results.push({ line, aisle: s.wave });
    console.log(line);
    seed = s.seed; // wait for the bot's restart before reading the next run
    while ((await peek())?.seed === seed) await page.waitForTimeout(500);
    continue;
  }
  if (Date.now() - t0 > RUN_TIMEOUT) {
    done++;
    console.log(`run ${done}: TIMEOUT after 15 min (phase ${s.phase}, aisle ${s.wave})`);
    results.push({ line: 'timeout', aisle: s.wave });
    await page.evaluate(() => window.__gg.flow.startRun('toaster', 0, 'toaster', 'main'));
    t0 = Date.now();
  }
  await page.waitForTimeout(1000);
}
const avg = results.reduce((a, r) => a + r.aisle, 0) / Math.max(1, results.length);
console.log(`avg aisle ${avg.toFixed(2)} over ${results.length} runs (${results.map((r) => r.aisle).join(', ')})`);
if (errors.length) console.log([...new Set(errors)].slice(0, 10).join('\n'));
await page.screenshot({ path: 'screenshots/botwatch.png' }).catch(() => {});
await browser.close();
