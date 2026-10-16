import { defineItem } from '../../engine/define';

// No runtime hook, on purpose: the dash itself reads the two build fields below (`shoveDistMult` for reach and speed, `shoveDamage` for
// the dash hit), so Boot is a `player` hook plus its text. The fields are the contract with the dash code (like `burn` for Fuel).
export default defineItem({
  id: 'boot', kind: 'passive', sets: ['tools'], shape: '1x1', price: 9,
  // Dash reach (+35% per ★ step, the legacy 0.35 x TIER.mult) and dash hit damage (6 x TIER.mult), both linear in the tier.
  tune: { distance: [0.35, 0.35 * 1.5, 0.35 * 2], damage: [6, 9, 12] },
  text: {
    en: { name: 'Running Boot', blurb: 'Clearance-rack sprinter. Dash like you stole it.', rules: 'Space dash: {distance|+pct} distance and {damage|+n} damage.' },
    de: { name: 'Rennstiefel', blurb: 'Sprinter aus dem Wühltisch. Dash, als hättest du ihn geklaut.', rules: 'Leertasten-Dash: {distance|+pct} Distanz und {damage|+n} Schaden.' },
  },
  rows: [
    { label: { en: 'Dash distance', de: 'Dash-Distanz' }, key: 'distance', fmt: '+pct' },
    { label: { en: 'Dash damage', de: 'Dash-Schaden' }, key: 'damage', fmt: '+n' },
  ],
  build: {
    // Adds onto the literal's neutral base (1 and PLAYER.shove.damage + perk). The Tools set's x2 dash damage multiplies the finished
    // total afterwards (computeBuild), exactly like the legacy `(base + boot + perk) * toolsMult`. Best copy counts once.
    phase: 'final',
    player(b, c) { const t = c.tune(); b.shoveDistMult += t.distance; b.shoveDamage += t.damage; },
  },
});
