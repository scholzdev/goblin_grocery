// Verifies restarts don't duplicate DOM overlays, window/document listeners, sounds or scene objects.
import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.addInitScript(() => {
  window.__listeners = 0;
  for (const T of [Window, Document]) {
    const add = T.prototype.addEventListener, rem = T.prototype.removeEventListener;
    T.prototype.addEventListener = function (...a) { window.__listeners++; return add.apply(this, a); };
    T.prototype.removeEventListener = function (...a) { window.__listeners--; return rem.apply(this, a); };
  }
});
await page.goto(process.argv[2] ?? 'http://localhost:5173/');
await page.waitForSelector('#title:not(.hidden)');
const snap = () => page.evaluate(() => ({
  ui: document.getElementById('ui-root').children.length, body: document.body.children.length, listeners: window.__listeners,
  sounds: window.__gg.game.sound.sounds.length, objs: window.__gg.game.scene.getScene('Arena').children.length,
}));
const rows = [];
for (let i = 0; i < 4; i++) {
  await page.click('[data-act="play"]'); await page.click('[data-starter="toaster"]');
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  rows.push(await snap());
  await page.click('[data-act="quit"]'); await page.waitForTimeout(500);
}
console.table(rows);
console.log(errs.join('\n') || 'no errors');
await b.close();
