import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'flag', kind: 'passive', sets: ['checkout'], shape: '1x1', price: 10,
  // Mark time per ★ (2 s x TIER.mult). `bonus` only feeds the text: the damage bonus itself is the shared mark rule in
  // damageEnemy (`engine/marks.ts`, Price Check's `damageMult`, 1 + bonus), because Price Check marks enemies too.
  tune: { duration: [2, 3, 4], bonus: 0.2 },
  text: {
    en: { name: 'Sale Flag', blurb: 'Plant it in their back. Everything is {bonus|pct} off.', rules: 'Groceries hit by the Space dash are marked for {duration|s}: they take {bonus|+pct} damage from everything (does not stack).' },
    de: { name: 'Sale-Fähnchen', blurb: 'Steck es ihnen in den Rücken. Alles {bonus|pct} reduziert.', rules: 'Vom Leertasten-Dash getroffene Gegner sind {duration|s} markiert: Sie erleiden {bonus|+pct} Schaden von allem (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Mark time', de: 'Markierzeit' }, key: 'duration', fmt: 's' }],
  hooks: {
    // Marks every enemy the dash connects with (no rng). The x1.2 on marked enemies is NOT here: a mark has two writers (this and Price
    // Check's beam), so the multiplier is engine behavior in damageEnemy's pipeline, like `burn`/`slow` (engine/marks.ts).
    onDashHit(ev, ctx, c) { ctx.mark(ev.enemy, c.tune().duration); },
  },
});
