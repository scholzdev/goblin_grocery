import type { Pattern } from './types';

/** Blender: every tick, each enemy inside the radius is hit once. The blade ring (drawn by the arsenal) spins while fighting. */
export const aura: Pattern = {
  id: 'aura',
  tick(h, w, dt, firing) {
    if (!w.blades) return;
    const look = h.looks.get(w.stats.uid), p = h.sc.player;
    w.blades.setPosition(p.x, p.y - 4).setVisible(firing);
    w.blades.rotation += dt * (look?.bladeSpin ?? 12);
    if (look?.bladeTint !== undefined) w.blades.setTint(look.bladeTint);
  },
  fire(h, w) {
    const sc = h.sc;
    const p = sc.player;
    const st = w.stats;
    let hit = false;
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > st.range + e.def.radius) continue;
      hit = true;
      sc.damageEnemy(e, st.damage, st, { kb: 20, kbX: (e.x - p.x) / (d || 1), kbY: (e.y - p.y) / (d || 1), quiet: true });
    }
    if (hit) h.sound('blender');
    if (sc.hooks['pattern:aura'].length) sc.hooks.emit('pattern:aura', { stats: st, x: p.x, y: p.y, range: st.range, hit }); // Smoothie Shield shreds enemy shots here
  },
};
