import { defineItem, flavorOf, tierMult } from '../../engine/define';
import { Item, Set, Tag } from '../../engine/ids';

// Each instance carries a flavor (`instance.flavor`, rerolled every shop visit by state/run.ts `rollFlavors`; a missing one is heat).
// It adds that flavor's real module effect (Fuel Can burn, Ice Pack slow, Party Popper blast) at `base` x the tier multiplier of its own
// effective tier, but never weaker than what the real module already gave the weapon. The beans also count toward the flavor's set
// (data/sets `setsOf`). `strength` is that product per ★ for the text and the shop row; the hook multiplies `tierMult(tier) * base`
// itself, which also holds at Gold Star's ★4.
const BASE = 0.7;

export default defineItem({
  id: Item.jellybeans, kind: 'module', sets: [Set.snacks], flavored: true, shape: '1x1', price: 10,
  tune: { base: BASE, strength: [BASE * tierMult(1), BASE * tierMult(2), BASE * tierMult(3)] },
  text: {
    en: { name: 'Jelly Beans', blurb: 'Every shop visit, a new flavor.', rules: 'The flavor changes every shop visit: Heat (Fuel Can burn), Frost (Ice Pack slow) or Blast (Party Popper blast). Adjacent weapons get that effect at {strength|pct} strength, and the beans count toward that flavor\'s set.' },
    de: { name: 'Gummibohnen', blurb: 'Bei jedem Einkauf eine neue Sorte.', rules: 'Die Sorte wechselt bei jedem Einkauf: Hitze (Brand des Benzinkanisters), Frost (Verlangsamung des Kühlakkus) oder Wumms (Explosion des Partyknallers). Angrenzende Waffen erhalten diesen Effekt mit {strength|pct} Stärke, und die Bohnen zählen für das Set dieser Sorte.' },
  },
  rows: [{ label: { en: 'Flavor strength', de: 'Geschmacksstärke' }, key: 'strength', fmt: 'pct' }],
  build: {
    phase: 'flavor', // right after the module loop, before Sourdough / Power Strip (global-mod)
    weapon(w, c) {
      const { base } = c.tune();
      // The full-strength modules at ★1: the beans scale them by `m`.
      const fuel = c.tuneOf(Item.fuel, 1), ice = c.tuneOf(Item.ice, 1), popper = c.tuneOf(Item.popper, 1);
      for (const { instance, tier } of c.touching(w)) {
        const m = tierMult(tier) * base, f = flavorOf(instance);
        if (f === Tag.heat && (w.burn?.dps ?? 0) < fuel.dps * m) w.burn = { dps: fuel.dps * m, duration: fuel.duration, tick: fuel.tick };
        else if (f === Tag.frost) w.slow = { pct: Math.max(w.slow?.pct ?? 0, Math.min(ice.cap, ice.pct * m)), duration: ice.duration };
        else if (f === Tag.blast && (w.popper?.damage ?? 0) < popper.damage * m) w.popper = { damage: popper.damage * m, radius: popper.radius };
      }
    },
  },
});
