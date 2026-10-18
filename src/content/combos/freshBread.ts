import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Toaster + Sourdough Starter: the toast pierces `pierce` more enemies, `maxPierce` once the Sourdough has fully risen (★3). Reads `c.owned` (the best Sourdough
// in the cart), as a combo has no touching instance of its own.
export default defineCombo({
  id: Combo.freshBread, requires: [Item.toaster, Item.sourdough],
  tune: { pierce: 1, maxPierce: 2, risen: 3 },
  text: {
    en: {
      name: 'Fresh Bread', short: 'Sourdough lets toast pierce',
      summary: 'Toaster touching a Sourdough Starter: a risen loaf is hard to stop.',
      detail: 'Toast pierces {pierce} extra enemy, {maxPierce} once the Sourdough has fully risen.',
    },
    de: {
      name: 'Frisches Brot', short: 'Sauerteig lässt Toast durchschlagen',
      summary: 'Toaster berührt Sauerteig-Ansatz: ein aufgegangener Laib ist kaum zu stoppen.',
      detail: 'Toast durchschlägt {pierce} weiteren Gegner, {maxPierce}, sobald der Sauerteig ganz aufgegangen ist.',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) { const t = c.tune(); w.pierce += c.owned(Item.sourdough) >= t.risen ? t.maxPierce : t.pierce; },
  },
});
