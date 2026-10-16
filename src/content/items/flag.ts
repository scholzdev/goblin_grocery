import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'flag', kind: 'passive', sets: ['checkout'], shape: '1x1', price: 10,
  // Mark time per ★ (the legacy 2 s x TIER.mult). `bonus` only feeds the text: the damage bonus itself is the shared mark rule in
  // damageEnemy (`RECIPE_TUNING.priceCheck.damageMult`, 1 + bonus), because Price Check marks enemies too.
  tune: { duration: [2, 3, 4], bonus: 0.2 },
  text: {
    en: { name: 'Sale Flag', blurb: 'Plant it in their back. Everything is 20% off.', rules: 'Groceries hit by the Space dash are marked for {duration|s}: they take {bonus|+pct} damage from everything (does not stack).' },
    de: { name: 'Sale-Fähnchen', blurb: 'Steck es ihnen in den Rücken. Alles 20% reduziert.', rules: 'Vom Leertasten-Dash getroffene Gegner sind {duration|s} markiert: Sie erleiden {bonus|+pct} Schaden von allem (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Mark time', de: 'Markierzeit' }, key: 'duration', fmt: 's' }],
  build: {
    // `Build.dashMark` is no longer read by the arena (the hook below marks from the tune); it stays for the golden snapshots.
    phase: 'final',
    player(b, c) { b.dashMark = c.tune().duration; },
  },
  hooks: {
    // Marks every enemy the dash connects with (no rng). The x1.2 on marked enemies is NOT here: a mark has two writers (this and Price
    // Check's beam), so the multiplier is engine behavior in damageEnemy's pipeline, like `burn`/`slow`. It stays until Price Check moves (phase 6).
    onDashHit(ev, ctx, c) { ctx.mark(ev.enemy, c.tune().duration); },
  },
});
