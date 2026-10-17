import { AFFINITY, defineEnemy } from '../../engine/define';
import { Enemy } from '../../engine/ids';

export default defineEnemy({
  id: Enemy.banana, behavior: 'charger', scale: 0.8, hpBar: true,
  stats: {
    hp: 12, speed: 80, contactDamage: 5, coins: 1, radius: 16,
    tell: 0.6, attackCooldown: 2.6, attackRange: 260, lungeSpeed: 430, lungeTime: 0.38,
  },
  weak: { frost: AFFINITY.weak },
  text: {
    en: { name: 'Banana Bandit', blurb: 'Winds up, then slides in for a peel-out lunge. Sidestep it.' },
    de: { name: 'Bananen-Bandit', blurb: 'Holt aus und rutscht dann zum Schlitterangriff heran. Weich aus.' },
  },
});
