import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Sparklers: every `every`th direct hit of an adjacent weapon sets off a small blast (popperBlast: never chains). At most one blast per weapon per `gap` s.
// No buff or build effect, like Decaf. Nothing is rolled.
export default defineItem({
  id: Item.sparklers, kind: 'module', sets: [Set.snacks, Set.blast], shape: '1x1', price: 9,
  tune: { every: [6, 4, 3], damage: 6, radius: 50, gap: 0.5 },
  text: {
    en: { name: 'Sparklers', blurb: 'Hold at arm\'s length. Or don\'t.', rules: 'Every {every}th direct hit of an adjacent weapon sets off a blast: {damage} damage within {radius}. At most one blast every {gap|s} per weapon.' },
    de: { name: 'Wunderkerzen', blurb: 'Mit ausgestrecktem Arm halten. Oder auch nicht.', rules: 'Jeder {every}. direkte Treffer der angrenzenden Waffe löst eine Explosion aus: {damage} Schaden im Umkreis von {radius}. Pro Waffe höchstens eine Explosion alle {gap|s}.' },
  },
  rows: [{ label: { en: 'Every nth hit', de: 'Jeder n-te Treffer' }, key: 'every' }],
  hooks: {
    onHit(hit, ctx, c) {
      const { stats } = hit;
      if (!stats || !hit.direct || hit.opts.quiet || !c.touches(stats.uid)) return;
      const t = c.tune(), counts: Record<string, number> = (c.state.counts ??= {}), last: Record<string, number> = (c.state.last ??= {});
      if (((counts[stats.uid] = (counts[stats.uid] ?? 0) + 1)) < t.every) return;
      counts[stats.uid] = 0;
      const now = ctx.now();
      if (now - (last[stats.uid] ?? -Infinity) < t.gap) return;
      last[stats.uid] = now;
      ctx.popperBlast(hit.enemy, { damage: t.damage, radius: t.radius * (ctx.build.sets.blast ? c.tuneOf(Set.blast).radiusMult : 1) });
    },
  },
});
