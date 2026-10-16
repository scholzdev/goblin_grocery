import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'energy', kind: 'passive', sets: ['snacks'], shape: '1x1', price: 8,
  tune: { speed: [0.12, 0.18, 0.24] }, // movement speed bonus per ★ (the legacy 12% base x TIER.mult)
  text: {
    en: { name: 'Energy Drink', blurb: 'Zoom zoom. Faster cart.', rules: '{speed|+pct} movement speed (does not stack).' },
    de: { name: 'Energydrink', blurb: 'Wruum wruum. Schnellerer Wagen.', rules: '{speed|+pct} Bewegungstempo (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Move speed', de: 'Lauftempo' }, key: 'speed', fmt: '+pct' }],
  build: {
    // Player-only. A multiplier on top of the starter perk's (Line Cook x0.95, Night Shift x1.08); linear in the tier (Gold Star ★4: +30%).
    phase: 'final',
    player(b, c) { b.moveSpeedMult *= 1 + c.tune().speed; },
  },
});
