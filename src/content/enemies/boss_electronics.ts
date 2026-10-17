import { defineEnemy } from '../../engine/define';

// tune = the cable lanes: `count` telegraphed strips (2 more below half HP), `gap` apart around the player, `width` wide.
export default defineEnemy({
  id: 'boss_electronics', behavior: 'boss', scale: 0.95,
  stats: {
    hp: 1500, speed: 34, contactDamage: 12, coins: 30, radius: 50,
    knockbackResist: 1, tell: 0.8, attackCooldown: 2.3, attackDamage: 9, projectileSpeed: 240, projectileLife: 4, lungeSpeed: 500, lungeTime: 0.7,
  },
  tune: { count: 3, gap: 170, width: 76 },
  text: {
    en: { name: 'The Smart-TV Wall', blurb: 'Zaps lanes of live cable across the floor, fires wide fast fans and boots up spitters.' },
    de: { name: 'Die Smart-TV-Wand', blurb: 'Zappt Bahnen aus Starkstromkabeln über den Boden, feuert breite schnelle Fächer und startet Spucker.' },
  },
  boss: {
    theme: 'electronics',
    kit: { cycle: ['special', 'volley', 'summon', 'special', 'charge', 'volley'], shot: 'proj_cap', special: 'lanes', moves: { volleyCount: 9, volleySpreadDeg: 100, summonCount: 3, summonTypes: ['spitter', 'beans'] } },
  },
});
