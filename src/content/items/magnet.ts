import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.magnet, kind: 'passive', sets: [Set.tools], shape: '1x1', price: 7,
  unlock: 'starting',
  tune: { pickup: [60, 90, 120] }, // coin pickup radius bonus per ★ (60 base x TIER.mult), rounded in the hook
  text: {
    en: { name: 'Magnet', blurb: 'Coins come to you.', rules: '{pickup|+int} coin pickup radius (does not stack). Combo: Nailstorm with Nail Gun + Battery.' },
    de: { name: 'Magnet', blurb: 'Münzen kommen zu dir.', rules: '{pickup|+int} Münz-Sammelradius (stapelt sich nicht). Combo: Nagelsturm mit Nagelpistole + Batterie.' },
  },
  rows: [{ label: { en: 'Pickup range', de: 'Einsammelreichweite' }, key: 'pickup', fmt: '+int' }],
  build: {
    // Player-only: runs after every weapon, on the cart-wide best copy (Gold Star included), so a second Magnet never adds.
    phase: 'final',
    player(b, c) { b.pickupRadius += Math.round(c.tune().pickup); },
  },
});
