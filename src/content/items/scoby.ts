import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Grows with time: `age` = aisles completed in the cart. Direct hits of adjacent weapons poison, `growth` stronger per aisle. A kill on an enemy that is
// poisoned and burning, or poisoned right after a reaction (Toxic Fumes eats the burn, so a fume kill is usually the latter; the condition is spelled out here: content must not import engine/reactions.ts, which has no event of its own) counts as one extra aisle, once per aisle.
export default defineItem({
  id: Item.scoby, kind: 'passive', sets: [Set.snacks], shape: '1x1', price: 12,
  age: 'cart',
  tune: { dps: [2, 3, 4], duration: 3, growth: 0.1 },
  text: {
    en: { name: 'Kombucha Scoby', blurb: 'It is alive. It is fine. Do not shake it.', rules: 'Direct hits of an adjacent weapon poison: {dps|ps} for {duration|s}. The poison gets {growth|pct} stronger for every aisle the Scoby stays in the cart. A kill on a burning, poisoned enemy (Toxic Fumes) counts as an extra aisle, once per aisle.' },
    de: { name: 'Kombucha-Mutter', blurb: 'Sie lebt. Alles gut. Nicht schütteln.', rules: 'Direkte Treffer der angrenzenden Waffe vergiften: {dps|ps} für {duration|s}. Das Gift wird für jeden Gang, den die Kombucha-Mutter im Wagen bleibt, um {growth|pct} stärker. Ein Kill an einem brennenden, vergifteten Gegner (Giftwolke) zählt als zusätzlicher Gang, einmal pro Gang.' },
  },
  rows: [{ label: { en: 'Poison', de: 'Gift' }, key: 'dps', fmt: 'ps' }],
  hooks: {
    onHit(hit, ctx, c) {
      const { stats } = hit;
      if (!stats || !hit.direct || hit.opts.quiet) return;
      const t = c.tune();
      let dps = 0;
      for (const p of c.touching(stats.uid)) dps = Math.max(dps, c.tuneOf(Item.scoby, p.tier ?? 1).dps * (1 + t.growth * (p.age ?? 0)));
      if (dps > 0) ctx.poison(hit.enemy, dps, t.duration);
    },
    onKill(ev, ctx, c) {
      const s = ev.enemy.status;
      if (c.state.fumes || !(s.poisonUntil > ctx.now() && s.poisonDps > 0 && ((s.burnUntil > ctx.now() && s.burnDps > 0) || s.reactionCdUntil > ctx.now()))) return;
      c.state.fumes = true;
      for (const p of c.instances) p.age = (p.age ?? 0) + 1;
    },
  },
});
