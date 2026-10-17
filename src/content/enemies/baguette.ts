import { defineEnemy } from '../../engine/define';

export default defineEnemy({
  id: 'baguette', behavior: 'swiper', scale: 0.8, hpBar: true,
  stats: {
    hp: 34, speed: 68, contactDamage: 5, coins: 2, radius: 19,
    tell: 0.55, attackCooldown: 2.2, attackRange: 92, attackDamage: 7, arcDeg: 110, knockbackResist: 0.3,
  },
  text: {
    en: { name: 'Baguette Bruiser', blurb: 'Swings a wide crusty arc when you get close. Back off or break it.' },
    de: { name: 'Baguette-Rabauke', blurb: 'Schwingt einen breiten, knusprigen Bogen, wenn du zu nah kommst. Geh weg oder brich ihn.' },
  },
});
