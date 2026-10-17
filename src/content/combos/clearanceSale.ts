import { defineCombo } from '../../engine/define';

// Fizz Cannon + Price Gun + Coupon Book: more bounces, and crits knock a bonus coin loose (once per enemy). The coin is the `onCrit` hook;
// it runs after Free Sample's heal (items register first) and after the crit roll, so the coin's three rng draws keep their place.
export default defineCombo({
  id: 'clearanceSale', requires: ['fizz', 'pricegun', 'coupon'],
  tune: { extraBounces: 2 },
  text: {
    en: {
      name: 'Clearance Sale', short: '+{extraBounces} bounces, crits drop coins',
      summary: 'Fizz Cannon touching a Price Gun AND a Coupon Book: everything must go!',
      detail: 'Caps bounce {extraBounces} extra times, and critical hits knock a bonus coin loose (once per enemy).',
    },
    de: {
      name: 'Räumungsverkauf', short: '+{extraBounces} Abpraller, Krittreffer lassen Münzen fallen',
      summary: 'Sprudelkanone berührt Preisauszeichner UND Couponheft: Alles muss raus!',
      detail: 'Kronkorken prallen {extraBounces} weitere Male ab, und kritische Treffer schütteln eine Bonusmünze los (einmal pro Gegner).',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) { w.bounces += c.tune().extraBounces; },
  },
  hooks: {
    onCrit(hit, ctx, c) {
      const e = hit.enemy;
      if (!hit.stats || !c.touches(hit.stats.uid) || e.critCoinDropped) return;
      e.critCoinDropped = true;
      ctx.dropCoin(e, ctx.t('coinClearance'));
    },
  },
});
