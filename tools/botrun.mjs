// DEV bot that kites enemies like a cautious human, auto-shops with a simple recipe-aware layout.
// Usage: node tools/botrun.mjs [url] [runs=1]
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5173/';
const runs = Number(process.argv[3] ?? 1);
const browser = await chromium.launch({ channel: 'chrome' });
for (let r = 0; r < runs; r++) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('#title:not(.hidden)');
  await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]'); await page.click('[data-act="start-run"]');
  await page.evaluate(() => {
    setInterval(() => {
      const a = window.__arena; const s = window.__gg.store.state;
      if (!a || s.phase !== 'combat' || !a.player) return;
      const p = a.player; let vx = 0, vy = 0;
      for (const e of a.enemies) {
        if (!e.alive) continue;
        const n = a.playerNear(e.x, e.y); // hitbox capsule: steer away from the closest body point
        const dx = n.x - e.x, dy = n.y - e.y, d = n.d || 1;
        if (d < 300) { const w = (e.def.behavior === 'boss' ? 3 : 1) / (d * d); vx += dx * w * 1000; vy += dy * w * 1000; }
      }
      for (const sh of a.arsenal.enemyShots) if (sh.active) {
        const n = a.playerNear(sh.x, sh.y);
        const dx = n.x - sh.x, dy = n.y - sh.y, d = n.d || 1;
        if (d < 160) { vx += dx / (d * d) * 1500; vy += dy / (d * d) * 1500; }
      }
      vx += (640 - p.x) * 0.004; vy += (480 - p.y) * 0.004; // stay central
      const l = Math.hypot(vx, vy);
      const near = a.enemies.some((e) => e.alive && a.playerNear(e.x, e.y).d < 70);
      a.devInput = l > 0.05 ? { x: vx / l, y: vy / l, shove: near } : { x: 0, y: 0, shove: near };
    }, 80);
  });
  const st = () => page.evaluate(() => { const s = window.__gg.store.state; return { phase: s.phase, wave: s.wave, hp: Math.round(s.hp), money: s.money, kills: s.stats.kills, rec: s.build.recipes.map((x) => x.id).join('+'), cells: s.inventory.placed.reduce((n, i) => n + (i.type==='pan'||i.type==='vacuum'?(i.type==='pan'?3:4):(['toaster','nailgun','fan','fuel','ice','lunchbox'].includes(i.type)?2:1)), 0), shelf: s.inventory.shelf.filter(Boolean).length, lv: s.shopLevel, tiers: s.inventory.placed.map((i) => i.type + (i.tier > 1 ? '*' + i.tier : '')).join(' ') }; });
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < 15 * 60_000) {
    const s = await st();
    if (s.phase === 'victory' || s.phase === 'defeat') { console.log(`run ${r}: ${s.phase} wave=${s.wave} hp=${s.hp} kills=${s.kills} ${s.rec} [${s.tiers}] time=${Math.round((Date.now() - t0) / 1000)}s`); break; }
    if (s.phase === 'route') {
      const doors = await page.$$('[data-act="door"]');
      const pick = doors[Math.floor(Math.random() * doors.length)];
      console.log('  door:', await pick.getAttribute('data-id'));
      await pick.click();
      continue;
    }
    if (s.phase === 'shop') {
      const line = `  shop ${s.wave} lv${s.lv}: hp=${s.hp} money=${s.money} kills=${s.kills} cells=${s.cells}/20 shelf=${s.shelf} ${s.rec}`;
      if (line !== last) console.log(line); last = line;
      await page.evaluate(() => {
        const { store, rules } = window.__gg; const s = store.state;
        if (s.hp < s.build.maxHp - 9) rules.repair(s);
        if (s.money > 45) rules.upgradeShop(s);
        for (const o of s.shop.offers) rules.buyOffer(s, o.slot);
        // Merge any identical pairs (shelf onto grid first).
        const all = () => [...s.inventory.placed, ...s.inventory.shelf.filter(Boolean)];
        for (let pass = 0; pass < 3; pass++) for (const a of all()) for (const b of all()) if (a !== b && a.type === b.type) rules.mergeItems(s, a.uid, b.uid);
        for (let k = 0; k < 4; k++) {
          const it = s.inventory.shelf[k]; if (!it) continue;
          let best = null, score = -1;
          for (const rot of [0, 1]) for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) {
            const pv = rules.previewMove(s, it.uid, { where: 'grid', x, y, rot });
            if (!pv.result.ok) continue;
            const sc = pv.build.recipes.length * 10 + pv.build.weapons.reduce((n, w) => n + w.buffs.length, 0);
            if (sc > score) { score = sc; best = { x, y, rot }; }
          }
          if (best) rules.moveItem(s, it.uid, { where: 'grid', ...best });
        }
        // Leftover coins: grow the cart, then the shelf.
        if (s.money > 30) rules.upgradeCart(s);
        if (s.money > 25) rules.upgradeShelf(s);
        store.changed();
      });
      await page.click('[data-act="next"]');
    }
    await page.waitForTimeout(400);
  }
  if (errors.length) console.log(errors.join('\n'));
  await page.screenshot({ path: `screenshots/botrun-${r}.png` });
  await page.close();
}
await browser.close();
