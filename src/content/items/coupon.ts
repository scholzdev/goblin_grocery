import { defineItem } from '../../engine/define';

// Kill coin chance per ★ (30% base x TIER.mult; `0.3 * 1.5` on purpose, the exact float of the ★2 formula), capped at `cap`
// (only Gold Star's effective ★4 would reach 75%, still below it). Used by the build field and the runtime roll alike.
const chanceOf = (t: { chance: number; cap: number }): number => Math.min(t.cap, t.chance);

export default defineItem({
  id: 'coupon', kind: 'passive', sets: ['checkout'], shape: '1x1', price: 8,
  tune: { chance: [0.3, 0.3 * 1.5, 0.3 * 2], cap: 0.9 },
  text: {
    en: { name: 'Coupon Book', blurb: 'Extra savings on every kill.', rules: 'Kills have a {chance|pct} chance to drop +1 coin (does not stack). Combo: Clearance Sale with Fizz Cannon + Price Gun.' },
    de: { name: 'Couponheft', blurb: 'Extra Ersparnis bei jedem Abschuss.', rules: 'Abschüsse lassen mit {chance|pct} Chance +1 Münze fallen (stapelt sich nicht). Combo: Räumungsverkauf mit Sprudelkanone + Preisauszeichner.' },
  },
  rows: [{ label: { en: 'Coin chance', de: 'Münzchance' }, key: 'chance', fmt: 'pct' }],
  hooks: {
    // Credited kills only (the emit is in killEnemy right after the regular coins and bread, before the Pickpocket loot: the single
    // `rng()` roll keeps the draw position it had when this lived in killEnemy).
    onKill(ev, ctx, c) {
      if (ctx.rng() < chanceOf(c.tune())) ctx.dropCoin(ev.enemy, ctx.t('coinCoupon'));
    },
  },
});
