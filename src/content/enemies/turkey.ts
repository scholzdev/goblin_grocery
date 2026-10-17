import { defineEnemy } from '../../engine/define';

export default defineEnemy({
  id: 'turkey', behavior: 'tank', scale: 0.8, hpBar: true,
  stats: {
    hp: 150, speed: 38, contactDamage: 9, coins: 4, radius: 34,
    knockbackResist: 0.92,
  },
  text: {
    en: { name: 'Frozen Turkey', blurb: 'Frozen solid, heavy as a brick. Takes forever to thaw out.' },
    de: { name: 'Gefrorener Truthahn', blurb: 'Steinhart gefroren, schwer wie ein Ziegel. Braucht ewig zum Auftauen.' },
  },
});
