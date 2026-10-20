import { defineItem, hasStar3, weaponBase, weaponTiers, wrapAngle, WEAPON_ROWS, WET_STATUS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `cone` (engine/patterns/cone.ts) with the default spray sprite and the default knockback 40. Sour Mist and Tailwind hook `pattern:cone`. `tune.wet` (the spray only, the Leaf Blower has none) soaks every enemy the cone hits for that many seconds, before the hit.
// From ★3 its own `pattern:cone` hook washes the enemy shots inside the cone away.
const W = weaponBase({ pattern: 'cone', damage: 3, cooldown: 0.55, range: 170, arcDeg: 70 });

export default defineItem({
  id: Item.spray, kind: 'weapon', sets: [Set.cleaning, Set.frost], shape: '1x2', price: 12, tags: ['melee'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, arcDeg: W.arcDeg, wet: WET_STATUS.duration },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Spray Bottle', blurb: 'Pssht pssht pssht. Hits everything in front.', rules: 'Every {cooldown|s} sprays a {arcDeg|deg} cone ({range} reach) for {damage} damage to every enemy inside (each once per spray) and makes them Wet for {wet|s}.', star3: '★3: The spray also washes enemy shots inside the cone out of the air.' },
    de: { name: 'Sprühflasche', blurb: 'Pssht pssht pssht. Trifft alles davor.', rules: 'Sprüht alle {cooldown|s} einen {arcDeg|deg}-Kegel ({range} Reichweite) und macht {damage} Schaden an jedem Gegner darin (je einmal pro Sprühstoß) und macht sie {wet|s} lang nass.', star3: '★3: Der Sprühstoß spült auch gegnerische Geschosse im Kegel aus der Luft.' },
  },
  hooks: {
    'pattern:cone'(ev, ctx) {
      const st = ev.stats;
      if (st.type !== Item.spray || !hasStar3(st.tier)) return; // the Leaf Blower blasts the same pattern
      const half = (st.arcDeg / 2) * (Math.PI / 180);
      for (const shot of ctx.enemyShots()) {
        const dx = shot.x - ev.x, dy = shot.y - ev.y;
        if (!shot.active || dx * dx + dy * dy > st.range * st.range || Math.abs(wrapAngle(Math.atan2(dy, dx) - ev.angle)) > half) continue;
        ctx.fx.spark(shot.x, shot.y - 20, 4, 0xcff3ff);
        ctx.killShot(shot);
      }
    },
  },
});
