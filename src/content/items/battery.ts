import { defineItem } from '../../engine/define';
import { Buff, Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.battery, kind: 'module', sets: [Set.tools], shape: '1x1', price: 8, electrical: true, buff: Buff.battery,
  unlock: 'starting',
  // attack speed bonus per ★ (1.12 base x TIER.mult); electric weapons get 1.5x of it
  tune: { rate: [0.12, 0.18, 0.24], electric: [0.18, 0.27, 0.36] },
  text: {
    en: { name: 'Battery', blurb: 'Zap! Faster attacks, electric gadgets most of all.', rules: 'Any adjacent weapon gets {rate|+pct} attack speed; Electric weapons {electric|+pct}.' },
    de: { name: 'Batterie', blurb: 'Zack! Schnellere Angriffe, bei Elektrogeräten besonders.', rules: 'Jede angrenzende Waffe erhält {rate|+pct} Angriffstempo; elektrische Waffen {electric|+pct}.' },
  },
  rows: [
    { label: { en: 'Attack speed', de: 'Angriffstempo' }, key: 'rate', fmt: '+pct' },
    { label: { en: 'Electric', de: 'Elektrisch' }, key: 'electric', fmt: '+pct' },
  ],
  build: {
    phase: 'module', order: 30,
    weapon(w, c) {
      const t = c.tune();
      w.cooldown /= 1 + (c.def(w.type).electrical ? t.electric : t.rate);
    },
  },
});
