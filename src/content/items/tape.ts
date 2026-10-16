import { defineItem, PROJECTILE_PATTERNS } from '../../engine/define';

export default defineItem({
  id: 'tape', kind: 'module', sets: ['tools'], shape: '1x1', price: 9, buff: 'tape',
  // pierce is +1 / +1 / +2 per ★ (not linear: Gold Star's effective ★4 stays at `maxPierce`), arc degrees and radius scale linearly
  // (the legacy 30° / 20% base x TIER.mult)
  tune: { pierce: [1, 1, 2], maxPierce: 2, arc: [30, 45, 60], radius: [0.2, 0.3, 0.4] },
  text: {
    en: { name: 'Duct Tape', blurb: 'Fixes everything. Makes it bigger, too.', rules: 'Any adjacent weapon: projectiles pierce {pierce|+int}, sweeps and cones {arc|+deg} arc, areas {radius|+pct} radius, beams {radius|+pct} length.' },
    de: { name: 'Panzertape', blurb: 'Hält alles zusammen. Macht es auch größer.', rules: 'Jede angrenzende Waffe: Projektile durchschlagen {pierce|+int}, Schwünge und Kegel {arc|+deg} Bogen, Flächen {radius|+pct} Radius, Strahlen {radius|+pct} Länge.' },
  },
  rows: [
    { label: { en: 'Pierce', de: 'Durchschlag' }, key: 'pierce', fmt: '+int' },
    { label: { en: 'Swing arc', de: 'Schwungbogen' }, key: 'arc', fmt: '+deg' },
    { label: { en: 'Radius', de: 'Radius' }, key: 'radius', fmt: '+pct' },
  ],
  build: {
    phase: 'module', order: 70,
    weapon(w, c) {
      const t = c.tune();
      if (PROJECTILE_PATTERNS.has(w.pattern)) w.pierce += Math.min(t.pierce, t.maxPierce);
      else if (w.pattern === 'sweep' || w.pattern === 'cone') w.arcDeg += t.arc;
      else if (w.pattern === 'zap' || w.pattern === 'mortar') w.aoe *= 1 + t.radius;
      else w.range *= 1 + t.radius; // pulse, aura, puddle, laser
    },
  },
});
