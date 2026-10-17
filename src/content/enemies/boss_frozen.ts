import { AFFINITY, defineEnemy } from '../../engine/define';

// tune = the Cold Snap: `spots` slush circles near the player (damage = attackDamage), `radius`, `scatter` around them, `life` s, `rMult` x the gum puddle radius.
export default defineEnemy({
  id: 'boss_frozen', behavior: 'boss', scale: 1,
  stats: {
    hp: 1700, speed: 40, contactDamage: 14, coins: 30, radius: 52,
    knockbackResist: 1, tell: 0.9, attackCooldown: 2.7, attackDamage: 9, projectileSpeed: 170, projectileLife: 5.5, lungeSpeed: 440, lungeTime: 0.9,
  },
  tune: { spots: 3, radius: 62, scatter: 140, life: 7, rMult: 1.8 },
  weak: { heat: AFFINITY.bossWeak },
  resist: { frost: AFFINITY.resist },
  text: {
    en: { name: 'The Walk-In Freezer', blurb: 'Slow, huge and cold. Its cold snaps freeze the floor into slowing slush, and its charge slides on.' },
    de: { name: 'Der Kühlraum', blurb: 'Langsam, riesig und eiskalt. Seine Kälteeinbrüche machen den Boden zu bremsendem Matsch, und sein Ansturm rutscht weiter.' },
  },
  boss: {
    theme: 'frozen',
    kit: { cycle: ['special', 'volley', 'charge', 'summon', 'special', 'charge'], shot: 'proj_bubble', special: 'slush', moves: { volleyCount: 6, volleySpreadDeg: 80, summonCount: 3, summonTypes: ['expired', 'milk'] } },
  },
});
