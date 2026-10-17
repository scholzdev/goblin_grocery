import { defineEnemy } from '../../engine/define';

export default defineEnemy({
  id: 'soda', behavior: 'tank', scale: 0.72, hpBar: true,
  stats: {
    hp: 48, speed: 46, contactDamage: 6, coins: 2, radius: 25,
    knockbackResist: 0.8,
  },
  text: {
    en: { name: 'Soda Six-Pack', blurb: 'Six cans, one grudge. Slow and fizzy-tough; barely flinches at dashes.' },
    de: { name: 'Limo-Sixpack', blurb: 'Sechs Dosen, ein Groll. Langsam und sprudelzäh; zuckt kaum bei Dashes.' },
  },
});
