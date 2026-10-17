import { DEPTH } from '../../data/depth';
import { newHitTracker, pickRicochetTarget, tryHit } from '../../systems/combat';
import { wetChainBonus } from '../wet';
import type { Pattern, PatternEnemy, PatternHost } from './types';

/** The zap bolt drawn on (x, y). `small`: the lighter one chain links and Static Cling throw. Fx only (`ctx.boltFx`). */
export function boltFx(h: PatternHost, x: number, y: number, small: boolean): void {
  const sc = h.sc;
  const b = sc.add.image(x, y - 10, 'fx_zap').setOrigin(0.5, 1).setDepth(DEPTH.fx).setScale(small ? 0.6 : 1);
  sc.tweens.add({ targets: b, alpha: 0, duration: 220, onComplete: () => b.destroy() });
  sc.fx.ring('fx_zap_burst', x, y, small ? 110 : 170, 260);
  sc.fx.spark(x, y - 20, small ? 3 : 6, 0xf5bd45);
}

/** Microwave: strike the toughest enemy in range, splash around it, then chain on to `chain` more. */
export const zap: Pattern = {
  id: 'zap',
  fire(h, w) {
    const sc = h.sc;
    const st = w.stats;
    const p = sc.player;
    const pool = sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < st.range * st.range);
    if (!pool.length) return;
    const tracker = newHitTracker(Infinity);
    // Sniper role: the toughest grocery in range (Elites first, then most HP); the splash handles the small fry.
    let target: PatternEnemy | null = pool.reduce((b, e) => (e.elite !== b.elite ? (e.elite ? e : b) : e.hp > b.hp ? e : b));
    const H = sc.hooks, hooked = H['pattern:zap'].length > 0;
    const links = st.chain + wetChainBonus(target.status, sc.time.now / 1000); // Wet: +1 link when the first target is wet (once per zap)
    for (let link = 0; target && link <= links; link++) {
      const t: PatternEnemy = target;
      boltFx(h, t.x, t.y, link > 0);
      // `before`: the hooks set the damage of a chain link (TV Dinner, then Sparks Fly on its links) and Reheat lights the first target's spot.
      const zap = hooked ? { stats: st, stage: 'before' as 'before' | 'after' | 'hit', link, target: t, damageMult: 1, hits: [] as PatternEnemy[], enemy: undefined as PatternEnemy | undefined } : null;
      if (zap) H.emit('pattern:zap', zap);
      const mult = zap ? zap.damageMult : 1;
      for (const e of sc.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        if ((e.x - t.x) ** 2 + (e.y - t.y) ** 2 > (st.aoe + e.def.radius) ** 2) continue;
        if (!tryHit(tracker, e.id)) continue;
        sc.damageEnemy(e, st.damage * mult, st, { kb: 80, kbX: Math.sign(e.x - t.x), kbY: 0 });
        if (zap) { zap.hits.push(e); zap.stage = 'hit'; zap.enemy = e; H.emit('pattern:zap', zap); zap.stage = 'before'; zap.enemy = undefined; } // Sparks Fly's stun roll
      }
      if (zap) { zap.stage = 'after'; H.emit('pattern:zap', zap); }
      target = pickRicochetTarget(t, sc.enemies.filter((e) => e.alive && e.state !== 'spawn'), tracker.hits, 220);
    }
    h.sound('zap');
  },
};
