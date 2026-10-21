import { defineItem } from '../../engine/define';
import { Enemy, Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.rubberboots, kind: 'passive', sets: [Set.cleaning], shape: '1x2', price: 11,
  tune: { reduction: [0.5, 0.6, 0.7], slowResist: [0.5, 0.65, 0.8] },
  text: {
    en: { name: 'Rubber Boots', blurb: 'Approved for questionable puddles.', rules: 'Take {reduction|pct} less damage from floor hazards. Floor slows from gum, slush and wet floors are {slowResist|pct} weaker. Does not stack.' },
    de: { name: 'Gummistiefel', blurb: 'Für fragwürdige Pfützen zugelassen.', rules: 'Nimm {reduction|pct} weniger Schaden durch Bodengefahren. Verlangsamungen durch Kaugummi, Matsch und nasse Böden sind {slowResist|pct} schwächer. Stapelt sich nicht.' },
  },
  rows: [{ label: { en: 'Hazard protection', de: 'Bodenschutz' }, key: 'reduction', fmt: 'pct' }, { label: { en: 'Slow resistance', de: 'Verlangsamungsresistenz' }, key: 'slowResist', fmt: 'pct' }],
  build: { phase: 'final', player(b, c) { b.floorSlowResist = c.tune().slowResist; } },
  hooks: {
    order: -40,
    onPlayerHit(ev, _ctx, c) {
      const src = ev.source;
      const bossFloor = src?.how === 'boss' && (src.by === Enemy.boss_frozen || src.by === Enemy.boss_checkout); // ids-ok: 'boss' is a HitSource attack kind
      if (src?.how === 'hazard' || src?.how === 'event' || bossFloor) ev.dmg *= 1 - c.tune().reduction;
    },
  },
});
