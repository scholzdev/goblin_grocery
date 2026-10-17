import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'hotsauce', kind: 'module', sets: ['kitchen', 'heat'], shape: '1x1', price: 7, buff: 'hotsauce',
  unlock: 'starting',
  tune: { damage: [0.25, 0.375, 0.5] }, // bonus hit damage per ★ (1.25 base x TIER.mult)
  text: {
    en: { name: 'Hot Sauce', blurb: 'Extra spicy damage.', rules: 'Adjacent weapons gain {damage|+pct} hit damage.' },
    de: { name: 'Scharfe Soße', blurb: 'Extra scharfer Schaden.', rules: 'Angrenzende Waffen erhalten {damage|+pct} Trefferschaden.' },
  },
  rows: [{ label: { en: 'Damage', de: 'Schaden' }, key: 'damage', fmt: '+pct' }],
  build: {
    phase: 'module', order: 50, // BUFF_ORDER: fan 10, fuel 20, battery 30, ice 40, hotsauce 50, pricegun 60, tape 70, popper 80, echo 90, multipack 100
    weapon(w, c) { w.damage *= 1 + c.tune().damage; },
  },
});
