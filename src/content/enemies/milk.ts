import { AFFINITY, defineEnemy } from '../../engine/define';

export default defineEnemy({
  id: 'milk', behavior: 'chase', scale: 0.78, hpBar: true,
  stats: { hp: 14, speed: 72, contactDamage: 4, coins: 1, radius: 17 },
  weak: { blast: AFFINITY.weak },
  text: {
    en: { name: 'Sour Milk', blurb: 'Past its date and furious about it. Just walks at you. Repeatedly.' },
    de: { name: 'Saure Milch', blurb: 'Über dem Datum und stinksauer darüber. Läuft einfach auf dich zu. Immer wieder.' },
  },
});
