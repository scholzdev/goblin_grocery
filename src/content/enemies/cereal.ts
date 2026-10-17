import { defineEnemy } from '../../engine/define';

// Shots whose reversed path is within `halfAngleDeg` of its facing (toward the player) are blocked,
// until the cardboard has soaked up `blocks` shots (x `eliteMult` on Elites); then it goes soggy and everything hits.
export default defineEnemy({
  id: 'cereal', behavior: 'chase', scale: 0.82, hpBar: true,
  stats: {
    hp: 45, speed: 58, contactDamage: 5, coins: 3, radius: 23,
    shield: true, knockbackResist: 0.3,
  },
  tune: { halfAngleDeg: 60, blocks: 6, eliteMult: 2 },
  text: {
    en: { name: 'Cereal Box', blurb: 'Holds a cardboard front up: the first {blocks} shots bounce off, then it goes soggy. Sweeps, blasts, burn and dashes ignore it.' },
    de: { name: 'Müslipackung', blurb: 'Hält eine Pappfront hoch: Die ersten {blocks} Schüsse prallen ab, dann weicht sie durch. Schwünge, Explosionen, Brand und Dashes ignorieren sie.' },
  },
});
