import { ENEMIES } from '../../data/enemies';
import { isSpent, pickRicochetTarget, shieldBlocks, tryHit } from '../../systems/combat';
import { DEPTH } from '../../data/depth';
import type { ShotMoveEvent } from '../hooks';
import type { PatternHost, Shot } from './types';

/** The Cereal Box's shield numbers (its content tune). */
const SHIELD = ENEMIES.cereal.tune;

/**
 * Flight and impact of every player projectile (toast, nails, caps, Ray Gun bolts), shared by the projectile patterns: life, bounds, the
 * Cereal Box cardboard front, damage, `pattern:shotHit`, piercing and the ricochet bounce. Cosmetic trails come from the weapon's look.
 */
export function updateShots(h: PatternHost, dt: number): void {
  const sc = h.sc;
  const moveHooks = sc.hooks['pattern:shotMove'];
  let moving: Shot | null = null, move: ShotMoveEvent | null = null;
  for (const s of h.shots) {
    if (!s.active) continue;
    s.life -= dt;
    if (s.life <= 0) { h.kill(s); continue; }
    const st = s.stats!;
    if (s.homing && moveHooks.length) { // a hook armed this shot (Nailstorm): let it steer before the move
      move ??= {
        stats: st, shot: s, dt, hits: s.tracker.hits,
        steer(angle) { const m = moving!, sp = Math.hypot(m.vx, m.vy); m.vx = Math.cos(angle) * sp; m.vy = Math.sin(angle) * sp; m.img.setRotation(angle); },
      };
      moving = s; move.stats = st; move.shot = s; move.hits = s.tracker.hits;
      sc.hooks.emit('pattern:shotMove', move);
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x < 20 || s.x > 1260 || s.y < 120 || s.y > 800) { h.kill(s); continue; }
    s.img.setPosition(s.x, s.y - 26).setDepth(DEPTH.world + s.y);
    if (s.spin) s.img.rotation += s.spin * dt;
    s.shadow.setPosition(s.x, s.y);
    if (h.looks.size) h.looks.get(st.uid)?.trail?.(s, sc.fx); // Toast Mode's flames, Nailstorm's sparks
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const r = e.def.radius + 8;
      if (Math.abs(e.x - s.x) > r || Math.abs(e.y - s.y) > r) continue;
      if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 > r * r) continue;
      // Cereal Box: a cardboard front stops player projectiles (sweeps, blasts, puddles etc. pass).
      // The front soaks up SHIELD.blocks shots, then goes soggy for good.
      if (e.def.shield && (e.shieldBlocked ?? 0) < SHIELD.blocks * (e.elite ? SHIELD.eliteMult : 1)
        && !s.tracker.hits.has(e.id) && shieldBlocks(s.vx, s.vy, sc.player.x - e.x, sc.player.y - e.y)) {
        e.shieldBlocked = (e.shieldBlocked ?? 0) + 1;
        sc.fx.spark(s.x, s.y - 26, 4, 0xd9954a);
        h.sound('cap_ping', { rate: 0.6 });
        if (e.shieldBlocked >= SHIELD.blocks * (e.elite ? SHIELD.eliteMult : 1)) {
          sc.fx.puff(e.x, e.y - 20, 6);
        }
        h.kill(s);
        break;
      }
      if (!tryHit(s.tracker, e.id)) continue;
      const sp = Math.hypot(s.vx, s.vy) || 1;
      sc.damageEnemy(e, s.damage, st, { kb: 60, kbX: s.vx / sp, kbY: s.vy / sp });
      if (sc.hooks['pattern:shotHit'].length) sc.hooks.emit('pattern:shotHit', { stats: st, shot: s, enemy: e }); // Ray Gun splash, Frostbite Nails' freeze, Nailstorm arms the homing
      if (isSpent(s.tracker)) { h.kill(s); break; }
      if (s.ricochet) {
        const next = pickRicochetTarget(s, sc.enemies.filter((x) => x.alive && x.state !== 'spawn'), s.tracker.hits, 230);
        if (sc.hooks['pattern:bounce'].length) sc.hooks.emit('pattern:bounce', { stats: st, shot: s, x: s.x, y: s.y, next }); // Confetti Cannon's blast
        if (next) {
          const a = Math.atan2(next.y - s.y, next.x - s.x);
          s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
          s.life = Math.max(s.life, 0.6);
          h.sound('cap_ping', { rate: 1.2 + Math.random() * 0.2 });
          sc.fx.spark(s.x, s.y - 26, 2, 0xf5bd45);
        }
      }
    }
  }
}
