import { AFFINITY, defineEnemy } from '../../engine/define';

// Heals allies within `radius` every `interval` s for `pct` of their max HP; keeps `keepAway` px from the player.
export default defineEnemy({
  id: 'honey', behavior: 'healer', scale: 0.76, hpBar: true,
  stats: {
    hp: 35, speed: 56, contactDamage: 3, coins: 3, radius: 18,
    preferredDistance: 220,
  },
  tune: { interval: 1, radius: 160, pct: 0.03, keepAway: 220 },
  weak: { frost: AFFINITY.weak },
  resist: { poison: AFFINITY.resist },
  text: {
    en: { name: 'Honey Jar', blurb: 'Hangs back and heals nearby groceries {pct|pct} every second. Sticky business; pop it first.' },
    de: { name: 'Honigglas', blurb: 'Hält sich hinten und heilt Gegner in der Nähe jede Sekunde um {pct|pct}. Klebrig; zuerst platzieren.' },
  },
});
