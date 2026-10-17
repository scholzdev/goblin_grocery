import { AFFINITY, defineEnemy } from '../../engine/define';

// tune = the toast ring: `shots` radial shots at `speed` px/s for `life` s, `halfExtra` more below half HP.
export default defineEnemy({
  id: 'boss_bakery', behavior: 'boss', scale: 0.95,
  stats: {
    hp: 1450, speed: 58, contactDamage: 14, coins: 30, radius: 46,
    knockbackResist: 1, tell: 0.75, attackCooldown: 2.2, attackDamage: 8, projectileSpeed: 215, projectileLife: 4.5, lungeSpeed: 540, lungeTime: 0.65,
  },
  tune: { shots: 14, speed: 150, life: 6, halfExtra: 4 },
  weak: { frost: AFFINITY.bossWeak },
  resist: { heat: AFFINITY.resist },
  text: {
    en: { name: 'The Industrial Oven', blurb: 'Tight fans of hot toast, ring bursts of fire and a steady supply of baguettes.' },
    de: { name: 'Der Industrieofen', blurb: 'Enge Toast-Fächer, Feuerringe und ein stetiger Nachschub an Baguettes.' },
  },
  boss: {
    theme: 'bakery',
    kit: { cycle: ['volley', 'special', 'summon', 'charge', 'special', 'volley'], shot: 'proj_toast', special: 'ring', moves: { volleyCount: 5, volleySpreadDeg: 50, summonCount: 4, summonTypes: ['baguette', 'banana'] } },
  },
});
