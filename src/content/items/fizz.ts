import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `ricochet` (engine/patterns/ricochet.ts): caps that bounce to `bounces` more enemies (the bounce is in engine/patterns/projectile.ts), and from ★3
// (`killBounce`) once more after a cap's first knockout. Confetti Cannon and Clearance Sale hook `pattern:bounce`.
const W = weaponBase({ pattern: 'ricochet', damage: 6, cooldown: 1.0, range: 420, projectileSpeed: 620, bounces: 2 });

export default defineItem({
  id: Item.fizz, kind: 'weapon', sets: [Set.snacks, Set.frost], shape: '2x1', price: 14, tags: ['ranged'],
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, bounces: W.bounces, killBounce: [0, 0, 1] },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Fizz Cannon', blurb: 'Shaken soda fires ricocheting bottle caps.', rules: 'Fires a bottle cap for {damage} damage every {cooldown|s} that bounces to {bounces} more enemies (never the same one twice). {range} range.', star3: '★3: A cap\'s first knockout earns it one more bounce.' },
    de: { name: 'Sprudelkanone', blurb: 'Geschüttelte Limo schießt abprallende Kronkorken.', rules: 'Feuert alle {cooldown|s} einen Kronkorken für {damage} Schaden, der auf {bounces} weitere Gegner abprallt (nie zweimal auf denselben). {range} Reichweite.', star3: '★3: Der erste Abschuss eines Kronkorkens bringt ihm einen weiteren Abprall.' },
  },
});
