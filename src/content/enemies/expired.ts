import { AFFINITY, defineEnemy } from '../../engine/define';
import { Enemy } from '../../engine/ids';

// Blink cadence, the landing ring distance from the player and its clearance from props.
export default defineEnemy({
  id: Enemy.expired, behavior: 'teleporter', scale: 0.78, hpBar: true,
  stats: {
    hp: 28, speed: 66, contactDamage: 6, coins: 2, radius: 17,
    tell: 0.6,
  },
  tune: { interval: 4, tell: 0.6, ringDist: 110, clearance: 60 },
  weak: { cleaning: AFFINITY.weak },
  resist: { poison: AFFINITY.resist },
  text: {
    en: { name: 'Expired Milk', blurb: 'Flickers, then blinks right next to you. Watch for the dashed ring.' },
    de: { name: 'Abgelaufene Milch', blurb: 'Flackert und blinkt dann direkt neben dich. Achte auf den gestrichelten Ring.' },
  },
});
