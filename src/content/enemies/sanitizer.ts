import { AFFINITY, defineEnemy } from '../../engine/define';
import { Enemy } from '../../engine/ids';

// A slow walker that scrubs the crowd: every `cleanseInterval` s it removes burn, poison, shred, wet and weaken from itself and every enemy within `cleanseRadius`
// (plus their own radius). Slow, stun and mark are left alone. The cleanse draws no rng (`cleanseAura`, systems/combat); the AI is the `chase` walk plus that tick
// (scenes/enemies.ts). Appears from aisle 3 in every theme at a low weight.
export default defineEnemy({
  id: Enemy.sanitizer, behavior: 'chase', scale: 0.82, hpBar: true,
  stats: { hp: 60, speed: 44, contactDamage: 4, coins: 3, radius: 22 },
  tune: { cleanseRadius: 120, cleanseInterval: 1 },
  weak: { blast: AFFINITY.weak },
  resist: { poison: AFFINITY.resist },
  text: {
    en: { name: 'Hand Sanitizer', blurb: 'Plods along and scrubs the crowd clean every {cleanseInterval|s}: burn, poison, shred, wet and weaken wash off everything within {cleanseRadius}, itself included. Slow, stun and marks stay. Pop it first.' },
    de: { name: 'Desinfektionsmittel', blurb: 'Trottet heran und putzt die Meute alle {cleanseInterval|s} sauber: Brand, Gift, Aufreißen, Nässe und Schwächung verschwinden von allem im Umkreis von {cleanseRadius}, auch von ihm selbst. Verlangsamung, Betäubung und Markierungen bleiben. Zuerst ausschalten.' },
  },
});
