import { cells, defineItem, weaponBase } from '../../engine/define';

// Pattern `laser` (engine/patterns/laser.ts): one beam down the line that crosses the most groceries. Legendary: one tier, scalar tune, no shop rows. Price Check and Power
// Surge hook `pattern:beam`.
const W = weaponBase({ pattern: 'laser', damage: 20, cooldown: 1.6, range: 620 });

export default defineItem({
  id: 'laser', kind: 'weapon', sets: ['checkout'], shape: cells('.#.', '###', '.#.'), price: 40, tags: ['ranged'], electrical: true, elements: ['electric'], legendary: true,
  weapon: W,
  tune: { damage: W.damage, cooldown: W.cooldown, range: W.range },
  text: {
    en: { name: 'Self-Checkout Laser', blurb: 'Unexpected item in the bagging area. ZAP.', rules: 'Every {cooldown|s} fires a barcode beam ({range} long) that hits every enemy in the line once for {damage} damage. Electrical.' },
    de: { name: 'Selbstscan-Laser', blurb: 'Unerwarteter Artikel im Gepäckbereich. ZACK.', rules: 'Feuert alle {cooldown|s} einen Barcode-Strahl ({range} lang), der jeden Gegner auf der Linie einmal für {damage} Schaden trifft. Elektrisch.' },
  },
});
