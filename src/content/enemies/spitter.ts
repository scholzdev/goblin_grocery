import { defineEnemy } from '../../engine/define';

// A volley is a fan of `shots` bubbles, `spreadDeg` apart.
export default defineEnemy({
  id: 'spitter', behavior: 'spitter', scale: 0.78, hpBar: true,
  stats: {
    hp: 18, speed: 64, contactDamage: 4, coins: 2, radius: 18,
    tell: 0.45, attackCooldown: 2.6, attackRange: 420, attackDamage: 5, projectileSpeed: 125, projectileLife: 4, preferredDistance: 270,
  },
  tune: { shots: 3, spreadDeg: 22 },
  text: {
    en: { name: 'Detergent Spitter', blurb: 'Squirts slow blobs of detergent from afar. Close in or weave.' },
    de: { name: 'Spülmittel-Spucker', blurb: 'Spritzt aus der Ferne langsame Spülmittelblasen. Geh ran oder weich aus.' },
  },
});
