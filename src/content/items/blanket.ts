import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.blanket, kind: 'passive', sets: [Set.snacks], shape: '2x2', price: 14,
  tune: { hp: [30, 45, 60], reduction: [0.1, 0.15, 0.2], slow: 0.1 },
  text: {
    en: { name: 'Weighted Blanket', blurb: 'A comforting commitment.', rules: '{hp|+int} max HP and {reduction|pct} less damage from hits, but {slow|pct} slower movement. Does not heal on equip. Does not stack.' },
    de: { name: 'Gewichtsdecke', blurb: 'Eine beruhigende Verpflichtung.', rules: '{hp|+int} max. LP und {reduction|pct} weniger Trefferschaden, aber {slow|pct} langsameres Bewegungstempo. Heilt beim Ausrüsten nicht. Stapelt sich nicht.' },
  },
  rows: [{ label: { en: 'Max HP', de: 'Max. LP' }, key: 'hp', fmt: '+int' }, { label: { en: 'Damage reduction', de: 'Schadensreduktion' }, key: 'reduction', fmt: 'pct' }],
  build: { phase: 'final', player(b, c) { b.maxHp += c.tune().hp; b.moveSpeedMult *= 1 - c.tune().slow; } },
  hooks: { order: -30, onPlayerHit(ev, _ctx, c) { ev.dmg *= 1 - c.tune().reduction; } },
});
