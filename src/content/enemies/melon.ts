import { defineEnemy } from '../../engine/define';

// Death: `slices` Melon Slices.
export default defineEnemy({
  id: 'melon', behavior: 'splitter', scale: 0.9, hpBar: true,
  stats: {
    hp: 60, speed: 50, contactDamage: 6, coins: 3, radius: 30,
    knockbackResist: 0.5,
  },
  tune: { slices: 3 },
  text: {
    en: { name: 'Watermelon', blurb: 'Bursts into three fast slices when it dies. Mind the mess.' },
    de: { name: 'Wassermelone', blurb: 'Platzt beim Tod in drei flinke Scheiben. Vorsicht, Matsch.' },
  },
});
