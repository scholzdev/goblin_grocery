import { AFFINITY, defineEnemy } from '../../engine/define';
import { Enemy } from '../../engine/ids';

// Escapes after `escapeAfter` s; a kill pays `coinMult`x coins (always dropped, no roll).
export default defineEnemy({
  id: Enemy.giftcard, behavior: 'thief', scale: 0.74,
  stats: { hp: 30, speed: 120, contactDamage: 1, coins: 2, radius: 16 },
  tune: { escapeAfter: 8, coinMult: 8 },
  weak: { electric: AFFINITY.weak },
  text: {
    en: { name: 'Gift Card', blurb: 'Runs from you and escapes after {escapeAfter} seconds. Catch it for a jackpot of coins.' },
    de: { name: 'Geschenkkarte', blurb: 'Rennt vor dir weg und entwischt nach {escapeAfter} Sekunden. Schnapp sie dir für einen Münz-Jackpot.' },
  },
});
