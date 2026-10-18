import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Once per run (systems/shortcut.ts): the door screen after a shop gets a "Staff Only" door while the key is unused. It skips the next aisle (no fight,
// no clear bonus, no shop), heals to full and never skips aisle 4 or 8. State/run.ts `chooseDoor` does the skipping; the key turns into a Spent Key.
export default defineItem({
  id: Item.shortcut, kind: 'passive', sets: [Set.tools], shape: '1x1', price: 12,
  tune: { mini: 4, boss: 8 }, // the aisles it never skips (MINI_BOSS.aisle, BOSS_WAVE): pinned against them in tests/shortcut.test.ts
  text: {
    en: { name: 'Shortcut Key', blurb: 'Staff only. You did not see us.', rules: 'Once per run: a Staff Only door appears after a shop. It skips the next aisle (no fight, no coins, no shop) and heals you fully. Never skips aisle {mini} or aisle {boss}.' },
    de: { name: 'Abkürzungsschlüssel', blurb: 'Nur für Personal. Wir haben uns nie gesehen.', rules: 'Einmal pro Run: Nach einem Shop erscheint eine Personaltür. Sie überspringt den nächsten Gang (kein Kampf, keine Münzen, kein Shop) und heilt dich voll. Überspringt nie Gang {mini} oder Gang {boss}.' },
  },
});
