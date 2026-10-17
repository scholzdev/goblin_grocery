import { AFFINITY, defineEnemy } from '../../engine/define';
import { Enemy } from '../../engine/ids';

// The Main Aisle boss. Its volley and summon numbers are the shared `BOSS` base (data/enemies.ts), which the shifts tune: `moves` stays empty.
export default defineEnemy({
  id: Enemy.boss, behavior: 'boss', scale: 0.95,
  stats: {
    hp: 1500, speed: 55, contactDamage: 14, coins: 30, radius: 48,
    knockbackResist: 1, tell: 0.8, attackCooldown: 2.4, attackDamage: 9, projectileSpeed: 200, projectileLife: 5, lungeSpeed: 520, lungeTime: 0.7,
  },
  weak: { mark: AFFINITY.markWeak },
  text: {
    en: { name: 'The Store Manager', blurb: 'Volleys, charges and summons. Gets cranky if you take too long.' },
    de: { name: 'Der Filialleiter', blurb: 'Salven, Ansturm und Verstärkung. Wird ungemütlich, wenn du zu lange brauchst.' },
  },
  boss: {
    theme: 'main',
    kit: { cycle: ['volley', 'charge', 'summon', 'charge', 'volley', 'summon'], shot: 'proj_receipt', moves: {} },
  },
});
