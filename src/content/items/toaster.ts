import { defineItem, weaponBase, weaponTiers, WEAPON_ROWS } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Pattern `toast` (engine/patterns/toast.ts): a volley of `count` toasts toward the nearest enemy, and from ★3 (`secondToast`) one more toast at the nearest
// other enemy. Toast Mode's flames and lower pop are that combo's `pattern:look`; Fan, Duct Tape and Multipack reshape the volley through the build.
const W = weaponBase({ pattern: 'toast', damage: 9, cooldown: 1.0, range: 455, projectileSpeed: 540 });

export default defineItem({
  id: Item.toaster, kind: 'weapon', sets: [Set.kitchen, Set.heat], shape: '2x1', price: 12, tags: ['ranged'], electrical: true,
  weapon: W,
  // damage and interval per ★ for the text and the shop rows (the stats themselves come from `weapon`)
  tune: { ...weaponTiers(W), range: W.range, secondToast: [0, 0, 1] },
  rows: WEAPON_ROWS,
  text: {
    en: { name: 'Toaster', blurb: 'Lobs hot toast at the nearest grocery.', rules: 'Fires toast for {damage} damage every {cooldown|s}. {range} range. Each toast hits one enemy.', star3: '★3: Also fires a toast at a second enemy.' },
    de: { name: 'Toaster', blurb: 'Schleudert heißen Toast auf den nächsten Gegner.', rules: 'Feuert alle {cooldown|s} Toast für {damage} Schaden. {range} Reichweite. Jeder Toast trifft einen Gegner.', star3: '★3: Feuert zusätzlich einen Toast auf einen zweiten Gegner.' },
  },
});
