import { AFFINITY, defineEnemy } from '../../engine/define';
import { Enemy } from '../../engine/ids';

// tune = the conveyor: shoves the player toward the boss at `speed` px/s for `time` s.
export default defineEnemy({
  id: Enemy.boss_checkout, behavior: 'boss', scale: 0.95,
  stats: {
    hp: 1550, speed: 50, contactDamage: 14, coins: 30, radius: 46,
    armor: 3, knockbackResist: 1, tell: 0.8, attackCooldown: 2.3, attackDamage: 9, projectileSpeed: 195, projectileLife: 5, lungeSpeed: 560, lungeTime: 0.7,
  },
  tune: { speed: 170, time: 2.4 },
  weak: { electric: AFFINITY.bossWeak },
  resist: { blast: AFFINITY.resist },
  text: {
    en: { name: 'The Self-Checkout Kiosk', blurb: 'Runs the conveyor against you, then charges. Bags in gum and gift cards.' },
    de: { name: 'Die Selbstbedienungskasse', blurb: 'Lässt das Fließband gegen dich laufen und rammt dich dann. Holt Kaugummis und Geschenkkarten dazu.' },
  },
  boss: {
    theme: 'checkout',
    kit: { cycle: ['special', 'charge', 'volley', 'summon', 'charge', 'special'], shot: 'proj_receipt', special: 'belt', moves: { volleyCount: 7, volleySpreadDeg: 70, summonCount: 4, summonTypes: [Enemy.gum, Enemy.giftcard] } },
  },
});
