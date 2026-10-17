import { defineCombo, wrapAngle } from '../../engine/define';

// Nail Gun + Magnet + Battery: piercing, curving nails. The first hit arms a nail (`pattern:shotHit` sets `shot.homing`), and from then on
// `pattern:shotMove` lets this combo steer it every frame; the teal spark trail is its `pattern:look`. Ray Gun replaces it.
export default defineCombo({
  id: 'nailstorm', requires: ['nailgun', 'magnet', 'battery'],
  tune: { extraPierce: 1, homingTurn: 7 /* rad/s */, homingRange: 200 },
  text: {
    en: {
      name: 'Nailstorm', short: 'Nails pierce and curve',
      summary: 'Nail Gun touching a Magnet AND a Battery: piercing, curving nails.',
      detail: 'Each nail pierces one extra enemy and curves toward a nearby target after its first hit. Battery attack rate still applies.',
    },
    de: {
      name: 'Nagelsturm', short: 'Nägel durchschlagen und kurven',
      summary: 'Nagelpistole berührt Magnet UND Batterie: durchschlagende, kurvende Nägel.',
      detail: 'Jeder Nagel durchschlägt einen weiteren Gegner und kurvt nach dem ersten Treffer auf ein nahes Ziel zu. Das Batterie-Angriffstempo gilt weiterhin.',
    },
  },
  build: {
    phase: 'combo',
    // `w.homing` is no longer read at runtime (the hooks below own the behavior); it stays for the golden build snapshots.
    weapon(w, c) { w.pierce += c.tune().extraPierce; w.homing = true; },
  },
  hooks: {
    'pattern:look'(ev, _ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      ev.look.trail = (s, fx) => { if (Math.random() < 0.3) fx.spark(s.x, s.y - 26, 1, 0x3fb7a6); };
    },
    'pattern:shotHit'(ev, _ctx, c) {
      if (c.touches(ev.stats.uid)) ev.shot.homing = true; // curve toward a nearby target after the first hit
    },
    'pattern:shotMove'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune(), s = ev.shot;
      const near = ctx.nearest(s, t.homingRange, ev.hits);
      if (!near) return;
      const cur = Math.atan2(s.vy, s.vx);
      const want = Math.atan2(near.y - s.y, near.x - s.x);
      const max = t.homingTurn * ev.dt;
      ev.steer(cur + Math.max(-max, Math.min(max, wrapAngle(want - cur))));
    },
  },
});
