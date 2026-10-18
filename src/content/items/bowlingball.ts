import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.bowlingball, kind: 'passive', sets: [Set.tools, Set.blast], shape: '2x2', price: 18,
  // Dash damage per occupied cart cell per ★ (1 x TIER.mult); the slow per cell and the knockback bonus are flat.
  tune: { perCell: [1, 1.5, 2], slow: 0.005, knock: 0.5 },
  text: {
    en: { name: 'Bowling Ball', blurb: 'Heavy. Strikes are the plan.', rules: 'The Space dash deals {perCell|+n} damage per occupied cart cell and {knock|+pct} knockback. You move {slow|pct1} slower per occupied cell (does not stack).' },
    de: { name: 'Bowlingkugel', blurb: 'Schwer. Strikes sind der Plan.', rules: 'Der Leertasten-Dash richtet {perCell|+n} Schaden pro belegter Wagenzelle an und hat {knock|+pct} Rückstoß. Du bist {slow|pct1} langsamer pro belegter Zelle (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Dash damage per cell', de: 'Dash-Schaden pro Zelle' }, key: 'perCell', fmt: '+n' }],
  build: {
    // Before the Tools set's x2 (order 200) like Boot, so the weight damage doubles with it. Best copy counts once.
    phase: 'final',
    player(b, c) {
      const t = c.tune();
      const w = c.weight;
      b.shoveDamage += t.perCell * w.cells;
      b.shoveKnockMult += t.knock;
      b.moveSpeedMult *= 1 - t.slow * w.slow;
    },
  },
});
