import { AFFINITY, defineEnemy } from '../../engine/define';

// The blast: ground-ring `radius`, and `enemyDamage` dealt to the other groceries caught in it (the player takes `attackDamage`).
export default defineEnemy({
  id: 'egg', behavior: 'exploder', scale: 0.78, hpBar: true,
  stats: {
    hp: 30, speed: 60, contactDamage: 3, coins: 2, radius: 20,
    tell: 0.7, attackRange: 70, attackDamage: 8,
  },
  tune: { radius: 90, enemyDamage: 12 },
  weak: { blast: AFFINITY.weak },
  text: {
    en: { name: 'Egg Carton', blurb: 'Waddles close and explodes. Pop it first.' },
    de: { name: 'Eierkarton', blurb: 'Watschelt heran und explodiert. Platz ihn zuerst.' },
  },
});
