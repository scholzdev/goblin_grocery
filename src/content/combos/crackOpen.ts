import { defineCombo, SHRED } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Nail Gun + Can Opener: every `every`th nail that hits the same enemy shreds `stacks` extra stacks (on top of the Can Opener's own roll). The count is this
// combo's own, per enemy id in `c.state.hits` (Frostbite Nails keeps its own `enemy.nailHits`), fresh every aisle. No rng.
export default defineCombo({
  id: Combo.crackOpen, requires: [Item.nailgun, Item.canopener],
  tune: { every: 3, stacks: 2, duration: SHRED.duration },
  text: {
    en: {
      name: 'Crack Open', short: '{every}rd nail: +{stacks} Shred',
      summary: 'Nail Gun touching a Can Opener: nails pry armor open.',
      detail: 'Every {every}rd nail that hits the same enemy applies {stacks} extra Shred stacks.',
    },
    de: {
      name: 'Aufknacken', short: '{every}. Nagel: +{stacks} Aufreißen',
      summary: 'Nagelpistole berührt Dosenöffner: Nägel hebeln die Panzerung auf.',
      detail: 'Jeder {every}. Nagel, der denselben Gegner trifft, fügt {stacks} zusätzliche Stapel Aufreißen hinzu.',
    },
  },
  hooks: {
    'pattern:shotHit'(ev, ctx, c) {
      const e = ev.enemy;
      if (!c.touches(ev.stats.uid) || ev.stats.pattern !== 'burst' || !e.alive) return;
      const t = c.tune(), hits: Map<number, number> = (c.state.hits ??= new Map());
      const n = (hits.get(e.id) ?? 0) + 1;
      hits.set(e.id, n);
      if (n % t.every === 0) ctx.shred(e, t.stacks, t.duration);
    },
  },
});
