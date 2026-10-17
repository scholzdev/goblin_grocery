import { defineSet } from '../../engine/define';
import { Set } from '../../engine/ids';

// Blast set: bigger blasts (L1: Party Popper radius, area weapons); L2 makes weapon kills sometimes pop. Arrays are L1/L2/L3.
export default defineSet({
  id: Set.blast,
  tune: { radiusMult: [1.15, 1.15, 1.25], killChance: [0.1, 0.1, 0.2], damage: [6, 6, 10], radius: [60, 60, 75] },
  text: {
    en: {
      name: 'Blast',
      bonus: [
        'Blast radius +{radiusMult|pctup}%',
        'Weapon kills: {killChance|pctn}% chance to pop ({damage} dmg)',
        'Blast radius +{radiusMult|pctup}%; weapon kills: {killChance|pctn}% chance to pop ({damage} dmg)',
      ],
    },
    de: {
      name: 'Knall',
      bonus: [
        'Explosionsradius +{radiusMult|pctup} %',
        'Waffen-Kills: {killChance|pctn} % Chance zu platzen ({damage} Schaden)',
        'Explosionsradius +{radiusMult|pctup} %; Waffen-Kills: {killChance|pctn} % Chance zu platzen ({damage} Schaden)',
      ],
    },
  },
  build: {
    phase: 'set', order: 50,
    weapon(w, c) {
      const t = c.tune(), pattern = c.def(w.type).weapon!.pattern;
      if (w.popper) w.popper = { ...w.popper, radius: w.popper.radius * t.radiusMult };
      if (pattern === 'zap' || pattern === 'mortar') w.aoe *= t.radiusMult;
    },
  },
  hooks: {
    // Weapon kills (not popper blasts: they never re-trigger) sometimes pop. Rolls after the Kitchen heal (order 10 < 20).
    order: 20,
    afterKill(ev, ctx, c) {
      const hit = ev.hit;
      if (!hit?.stats || c.tier < 2 || hit.opts.fromPopper) return;
      const t = c.tune();
      if (ctx.rng() < t.killChance) ctx.popperBlast(ev.enemy, { damage: t.damage, radius: t.radius }, true);
    },
  },
});
