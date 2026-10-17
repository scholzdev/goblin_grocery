import { AFFINITY, defineEnemy } from '../../engine/define';
import { Enemy } from '../../engine/ids';

// Puddle cadence, cap per gum, life, radius and the player slow; `trapRadiusMult` = the trap radius multiplier on death.
// The Walk-In Freezer reuses the puddle (scenes/gum.ts) as icy slush.
export default defineEnemy({
  id: Enemy.gum, behavior: 'chase', scale: 0.76, hpBar: true,
  stats: {
    hp: 26, speed: 70, contactDamage: 4, coins: 2, radius: 17,
    trail: true,
  },
  tune: { interval: 1.5, maxPerGum: 6, life: 6, radius: 34, slow: 0.3, trapRadiusMult: 1.6 },
  weak: { frost: AFFINITY.weak },
  resist: { heat: AFFINITY.resist },
  text: {
    en: { name: 'Bubble Gum', blurb: 'Chews after you, leaving sticky pink puddles that slow your walk. Bursts into a trap when popped.' },
    de: { name: 'Kaugummi', blurb: 'Kaut hinter dir her und hinterlässt klebrige rosa Pfützen, die dich verlangsamen. Platzt zur Falle.' },
  },
});
