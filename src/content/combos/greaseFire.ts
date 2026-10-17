import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Mop + Fuel Can: bigger puddles whose burn is doubled (it multiplies the Fuel Can burn the module phase left, no stacking). The flaming
// puddle sprite and the flame particles are this combo's `pattern:look` (cosmetic only).
export default defineCombo({
  id: Combo.greaseFire, requires: [Item.mop, Item.fuel],
  tune: { radiusMult: 1.4, burnMult: 2 },
  text: {
    en: {
      name: 'Grease Fire', short: 'Huge burning slicks',
      summary: 'Mop touching a Fuel Can: huge burning grease slicks.',
      detail: 'Puddles become grease fires: {radiusMult|pctup}% bigger, and their burn is doubled (Fuel Can burn ×{burnMult}, no stacking).',
    },
    de: {
      name: 'Fettbrand', short: 'Riesige brennende Lachen',
      summary: 'Wischmopp berührt Benzinkanister: riesige brennende Fettlachen.',
      detail: 'Pfützen werden zu Fettbränden: {radiusMult|pctup}% größer, und ihr Brand ist verdoppelt (Benzinkanister-Brand ×{burnMult}, kein Stapeln).',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) {
      const t = c.tune();
      w.range *= t.radiusMult;
      if (w.burn) w.burn = { ...w.burn, dps: w.burn.dps * t.burnMult };
    },
  },
  hooks: {
    'pattern:look'(ev, _ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const between = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);
      ev.look.puddleKey = 'fx_puddle_fire';
      ev.look.puddleFx = (pd, fx) => { if (Math.random() < 0.25) fx.flame(pd.x + between(-pd.r, pd.r) * 0.8, pd.y + between(-pd.r, pd.r) * 0.4); };
    },
  },
});
