import { defineSet } from '../../engine/define';

// Kitchen set: kitchen weapons hit harder (L1), kills by kitchen weapons sometimes heal (L2, L3 stronger). Arrays are L1/L2/L3.
export default defineSet({
  id: 'kitchen',
  tune: { damageMult: [1.1, 1.1, 1.2], healChance: [0.05, 0.05, 0.1], heal: [3, 3, 4] },
  text: {
    en: {
      name: 'Kitchen',
      bonus: [
        'Kitchen weapons +{damageMult|pctup}% damage',
        'Kitchen kills: {healChance|pctn}% chance to heal {heal} HP',
        'Kitchen weapons +{damageMult|pctup}% damage; kills: {healChance|pctn}% chance to heal {heal} HP',
      ],
    },
    de: {
      name: 'Küche',
      bonus: [
        'Küchenwaffen +{damageMult|pctup} % Schaden',
        'Küchen-Kills: {healChance|pctn} % Chance, {heal} LP zu heilen',
        'Küchenwaffen +{damageMult|pctup} % Schaden; Kills: {healChance|pctn} % Chance, {heal} LP zu heilen',
      ],
    },
  },
  build: {
    // `set` phase, first of the weapon bonuses (kitchen 10, cleaning 20, tools 30, heat 40, blast 50, electric 60 = the legacy sequence).
    phase: 'set', order: 10,
    weapon(w, c) { if (c.def(w.type).family === 'kitchen') w.damage *= c.tune().damageMult; },
  },
  hooks: {
    // Kills by a kitchen weapon (popper blasts included: they carry the weapon's stats). One roll per kill; Blast's pop rolls right after (order).
    order: 10,
    afterKill(ev, ctx, c) {
      const stats = ev.hit?.stats;
      if (!stats || c.tier < 2 || c.def(stats.type).family !== 'kitchen') return;
      const t = c.tune();
      if (ctx.rng() < t.healChance) { ctx.heal(t.heal); ctx.healFx(ev.enemy.x, ev.enemy.y - 30); }
    },
  },
});
