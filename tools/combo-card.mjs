// Composes screenshots/strongest-combo.png: ranking bars + in-game combat frame + cart/stats view.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const font = `data:font/woff2;base64,${readFileSync('node_modules/@fontsource/luckiest-guy/files/luckiest-guy-latin-400-normal.woff2').toString('base64')}`;
const max = Math.max(...rows.map((r) => r.crowd));
const bars = rows.map((r, i) => `<div class="row ${i === 0 ? 'top' : ''}"><span class="n">${r.combo}</span><span class="bar"><i style="width:${(r.crowd / max) * 100}%"></i></span><b>${r.crowd}</b><em>${r.single}</em></div>`).join('');
const html = `<html><head><style>
@font-face { font-family: LG; src: url(${font}); }
body { margin: 0; width: 1800px; background: #B8DED2; font: 700 18px/1.3 'Avenir Next', system-ui, sans-serif; color: #30203F; }
.wrap { padding: 28px 32px; display: grid; grid-template-columns: 560px 1fr; gap: 24px; }
h1 { font: 400 54px LG; margin: 0; color: #F45F52; text-shadow: 3px 3px 0 #30203F; }
.sub { margin: 4px 0 18px; }
.card { background: #FFFAF0; border: 3px solid #30203F; border-radius: 14px; padding: 16px 18px; box-shadow: 0 6px 0 rgba(48,32,63,.3); }
.row { display: grid; grid-template-columns: 170px 1fr 56px 46px; align-items: center; gap: 10px; padding: 4px 0; }
.row .bar { height: 18px; background: #E9D9F1; border-radius: 9px; overflow: hidden; border: 2px solid #30203F; }
.row .bar i { display: block; height: 100%; background: #9081B6; }
.row.top .bar i { background: #F45F52; } .row.top .n, .row.top b { color: #C9443B; }
.row b { font: 400 22px LG; text-align: right; } .row em { font-style: normal; opacity: .6; text-align: right; }
.legend { display: grid; grid-template-columns: 170px 1fr 56px 46px; gap: 10px; font-size: 13px; opacity: .7; }
.legend span:nth-child(3), .legend span:nth-child(4) { text-align: right; }
.why { margin-top: 14px; font-size: 16px; } .why li { margin: 4px 0; }
.shots { display: grid; gap: 14px; } .shots img { width: 100%; border: 3px solid #30203F; border-radius: 12px; display: block; }
.badge { display: inline-block; font: 400 26px LG; background: #F5BD45; border: 3px solid #30203F; border-radius: 999px; padding: 6px 18px 2px; box-shadow: 0 4px 0 #30203F; }
.cap { font-size: 14px; margin: 4px 2px 0; opacity: .75; }
</style></head><body><div class="wrap">
<div>
  <h1>Strongest combo (after rebalance)</h1>
  <div class="badge">TV Dinner</div>
  <div class="sub">Microwave + Lunchbox + Battery (★1 items, nothing else in the cart)</div>
  <div class="card">
    <div class="legend"><span>combo</span><span></span><span>crowd</span><span>single</span></div>
    ${bars}
  </div>
  <div class="card why"><b>Why it wins</b><ul>
    <li>26.9 dmg per zap (24 base, +12% Bundle Deal) every <b>1.80 s</b> (2.4 s base, Battery +20%, combo +10%)</li>
    <li>Each zap splashes 70 radius, then <b>chains to 1 more enemy</b> at 60%</li>
    <li>53.8 pack DPS (was 70.6): still #1, but now within 1.6× of the median. tests/combo-balance.test.ts keeps every combo in that band</li>
    <li>Lunchbox adds +15 max HP: the only combo whose support is also defensive</li>
  </ul><div class="cap">DPS model on real computeBuild stats: crowd = pack of 5 (3 inside any arc/line); crits, Double Bag echo and burn counted where present. Express Checkout assumes every shove connects.</div></div>
</div>
<div class="shots">
  <div><img src="${img('screenshots/combo-0.png')}"><div class="cap">In game (Electronics, aisle 6): the zap hits, splashes, and arcs to one more grocery.</div></div>
  <div><img src="${img('screenshots/combo-tab.png')}"><div class="cap">Tab view: cart layout, live Microwave stats, and the redesigned combo cards.</div></div>
</div>
</div></body></html>`;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1800, height: 1000 } });
await p.setContent(html); await p.waitForTimeout(300);
await p.screenshot({ path: 'screenshots/strongest-combo.png', fullPage: true });
await b.close();
console.log('wrote screenshots/strongest-combo.png');
