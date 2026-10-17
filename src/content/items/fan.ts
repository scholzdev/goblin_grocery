import { defineItem, PROJECTILE_PATTERNS } from '../../engine/define';
import { Buff, Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.fan, kind: 'module', sets: [Set.cleaning], shape: '1x2', price: 9, buff: Buff.fan,
  unlock: 'starting',
  tune: { range: [0.3, 0.45, 0.6], speed: [0.3, 0.45, 0.6] }, // bonus range/reach and projectile speed per ★ (1.3 base x TIER.mult)
  text: {
    en: { name: 'Desk Fan', blurb: 'Whoosh. More range for whatever it touches.', rules: 'Any adjacent weapon gains {range|+pct} range or reach and {speed|+pct} projectile speed.' },
    de: { name: 'Tischventilator', blurb: 'Wuusch. Mehr Reichweite für alles, was er berührt.', rules: 'Jede angrenzende Waffe erhält {range|+pct} Reichweite und {speed|+pct} Projektiltempo.' },
  },
  rows: [
    { label: { en: 'Range / reach', de: 'Distanz / Reichweite' }, key: 'range', fmt: '+pct' },
    { label: { en: 'Projectile speed', de: 'Projektiltempo' }, key: 'speed', fmt: '+pct' },
  ],
  build: {
    phase: 'module', order: 10,
    weapon(w, c) {
      const t = c.tune();
      if (PROJECTILE_PATTERNS.has(w.pattern)) w.projectileSpeed *= 1 + t.speed;
      w.range *= 1 + t.range;
    },
  },
});
