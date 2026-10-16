import { defineItem } from '../../engine/define';

// Coin chance per enemy the dash hits (the legacy 40% x TIER.mult, `0.4 * 1.5` on purpose), capped at `cap`: only Gold Star's
// effective ★4 reaches it. Used by the build field and the runtime roll alike.
const chanceOf = (t: { chance: number; cap: number }): number => Math.min(t.cap, t.chance);

export default defineItem({
  id: 'tipjar', kind: 'passive', sets: ['checkout'], shape: '1x1', price: 9,
  tune: { chance: [0.4, 0.4 * 1.5, 0.4 * 2], cap: 1 },
  text: {
    en: { name: 'Tip Jar', blurb: 'Bump them. They tip.', rules: 'Each grocery the Space dash hits has a {chance|pct} chance to drop a coin (does not stack).' },
    de: { name: 'Trinkgeldglas', blurb: 'Anrempeln. Sie geben Trinkgeld.', rules: 'Jeder Gegner, den der Leertasten-Dash trifft, lässt mit {chance|pct} Chance eine Münze fallen (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Tip chance', de: 'Trinkgeldchance' }, key: 'chance', fmt: 'pct' }],
  build: {
    // `Build.dashCoinChance` is no longer read by the arena (the hook below rolls from the tune); it stays for the golden snapshots.
    phase: 'final',
    player(b, c) { b.dashCoinChance = chanceOf(c.tune()); },
  },
  hooks: {
    // Once per enemy the dash connects with, right after its damage: one combat-rng roll, then a coin at the enemy (even one the dash just killed).
    onDashHit(ev, ctx, c) {
      if (ctx.rng() < chanceOf(c.tune())) ctx.dropCoin(ev.enemy, ctx.t('coinTip'));
    },
  },
});
