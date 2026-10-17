import { defineSet } from '../../engine/define';
import { Item, Set, Tag } from '../../engine/ids';

// Heat set: every burn lasts longer (L1); L2 also multiplies burn damage and lets heat weapons without a burn ignite on some hits
// (`WeaponStats.ignite`, rolled by the engine in engine/onHitStatuses). Arrays are L1/L2/L3. The ignite burn is the Fuel Can's at ★1.
export default defineSet({
  id: Set.heat,
  tune: { burnExtra: [1, 1, 2], burnMult: [1.4, 1.4, 1.8], igniteChance: [0.15, 0.15, 0.25], igniteDpsMult: 1.4, igniteExtra: [1, 1, 2] },
  text: {
    en: {
      name: 'Heat',
      bonus: [
        'Burn lasts +{burnExtra} s',
        'Burn damage ×{burnMult}; heat weapons ignite {igniteChance|pctn}% of hits',
        'Burn +{burnExtra} s, damage ×{burnMult}; heat weapons ignite {igniteChance|pctn}% of hits',
      ],
    },
    de: {
      name: 'Hitze',
      bonus: [
        'Brennen dauert +{burnExtra} s länger',
        'Brandschaden ×{burnMult}; Hitzewaffen zünden {igniteChance|pctn} % der Treffer',
        'Brennen +{burnExtra} s, Schaden ×{burnMult}; Hitzewaffen zünden {igniteChance|pctn} % der Treffer',
      ],
    },
  },
  build: {
    phase: 'set', order: 40,
    weapon(w, c) {
      const t = c.tune();
      if (w.burn) w.burn = { ...w.burn, duration: w.burn.duration + t.burnExtra, dps: w.burn.dps * (c.tier >= 2 ? t.burnMult : 1) };
      if (c.tier >= 2 && c.def(w.type).element === Tag.heat && !w.burn) {
        const fuel = c.tuneOf(Item.fuel, 1);
        w.ignite = { chance: t.igniteChance, burn: { dps: fuel.dps * t.igniteDpsMult, duration: fuel.duration + t.igniteExtra, tick: fuel.tick } };
      }
    },
  },
});
