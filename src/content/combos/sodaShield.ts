import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Fizz Cannon + Bubble Wrap: the padded can buys a little extra recovery after a hit.
export default defineCombo({
  id: Combo.sodaShield, requires: [Item.fizz, Item.bubblewrap],
  tune: { invuln: 0.15 },
  text: {
    en: {
      name: 'Soda Shield', short: 'More invulnerability after hits',
      summary: 'Fizz Cannon touching Bubble Wrap: padded cans cushion the goblin.',
      detail: 'Taking a hit grants an extra {invuln|s} of invulnerability.',
    },
    de: {
      name: 'Limo-Schild', short: 'Mehr Unverwundbarkeit nach Treffern',
      summary: 'Sprudelkanone berührt Luftpolsterfolie: gepolsterte Dosen schützen den Goblin.',
      detail: 'Nach einem Treffer erhältst du zusätzlich {invuln|s} Unverwundbarkeit.',
    },
  },
  hooks: {
    onPlayerHit(ev, _ctx, c) { ev.invuln += c.tune().invuln; },
  },
});
