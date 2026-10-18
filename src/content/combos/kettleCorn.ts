import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';
import type { WeaponStats } from '../../types';

// Popcorn Maker + Party Popper: a kernel kill scatters `count` more kernels from the corpse (one rng draw each, the angle). Those carry a copy of the stats
// without `popper` (no confetti on their kills) and are remembered in `KERNELS`, so their own kills scatter nothing.
const KERNELS = new WeakSet<WeaponStats>();

export default defineCombo({
  id: Combo.kettleCorn, requires: [Item.popcorn, Item.popper],
  tune: { count: 3, damage: 2.5, range: 160, speed: 520 },
  text: {
    en: {
      name: 'Kettle Corn', short: 'Kernel kills scatter more kernels',
      summary: 'Popcorn Maker touching a Party Popper: sweet, salty, explosive.',
      detail: 'Enemies killed by a kernel scatter {count} more kernels ({damage} damage, {range} range). Those kernels never scatter again and set off no confetti.',
    },
    de: {
      name: 'Karamell-Popcorn', short: 'Korn-Kills streuen weitere Körner',
      summary: 'Popcornmaschine berührt Partyknaller: süß, salzig, explosiv.',
      detail: 'Von einem Korn besiegte Gegner streuen {count} weitere Körner ({damage} Schaden, {range} Reichweite). Diese Körner streuen nie erneut und lösen kein Konfetti aus.',
    },
  },
  hooks: {
    afterKill(ev, ctx, c) {
      const hit = ev.hit, st = hit?.stats;
      if (!st || hit.opts.fromPopper || KERNELS.has(st) || !c.touches(st.uid)) return;
      const t = c.tune(), kernel = { ...st, popper: null };
      KERNELS.add(kernel);
      for (let i = 0; i < t.count; i++) {
        ctx.spawnShot({ key: 'proj_kernel', x: ev.enemy.x, y: ev.enemy.y, angle: ctx.rng() * Math.PI * 2, speed: t.speed, life: t.range / t.speed, damage: t.damage, stats: kernel, maxHits: 1 });
      }
    },
  },
});
