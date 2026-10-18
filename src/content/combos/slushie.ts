import { defineCombo } from '../../engine/define';
import { Combo, Item, Tag } from '../../engine/ids';
import type { CombatEnemy, RuntimeCtx } from '../../engine/ctx';
import type { HookCtx } from '../../engine/hooks';

// Fizz Cannon + Ice Pack: each cap hit after the first slows `perBounce` harder (capped at the Ice Pack's cap), and the last hit of a cap freezes the enemy
// unless Slushie froze it within `cooldown` s. `pattern:shotHit` fires on every hit including the last, unlike `pattern:bounce`; the hit count is the shot's tracker.
// A cap that finds no next target also ends there: `pattern:bounce` fires right after that hit with `next: null`, so the lone-target fight still freezes.
export default defineCombo({
  id: Combo.slushie, requires: [Item.fizz, Item.ice],
  tune: { perBounce: 0.1, freeze: 0.5, cooldown: 2.5 },
  text: {
    en: {
      name: 'Slushie', short: 'Bounces slow more, last hit freezes',
      summary: 'Fizz Cannon touching an Ice Pack: the soda turns to slush.',
      detail: 'Each hit of a cap after the first slows {perBounce|pctn}% more. A cap\'s last hit freezes the enemy for {freeze|s} ({cooldown|s} cooldown per enemy).',
    },
    de: {
      name: 'Slush', short: 'Abpraller bremsen mehr, letzter Treffer friert',
      summary: 'Sprudelkanone berührt Kühlakku: die Limo wird zu Slush.',
      detail: 'Jeder Treffer eines Kronkorkens nach dem ersten bremst {perBounce|pctn}% stärker. Der letzte Treffer eines Kronkorkens friert den Gegner {freeze|s} lang ein ({cooldown|s} Abklingzeit pro Gegner).',
    },
  },
  hooks: {
    'pattern:shotHit'(ev, ctx, c) {
      const e = ev.enemy, st = ev.stats;
      if (!c.touches(st.uid) || !e.alive) return;
      const t = c.tune(), hits = ev.shot.tracker.hits.size;
      if (hits > 1 && st.slow) {
        const cap = c.tuneOf(Item.ice, 1).cap;
        ctx.slow(e, { pct: Math.min(cap, st.slow.pct + t.perBounce * (hits - 1)), duration: st.slow.duration });
      }
      if (hits >= 1 + st.bounces + st.pierce) freeze(e, ctx, c);
      else c.state.lastHit = { shot: ev.shot, e };
    },
    'pattern:bounce'(ev, ctx, c) {
      const last = c.state.lastHit;
      c.state.lastHit = null;
      if (!ev.next && last?.shot === ev.shot && c.touches(ev.stats.uid)) freeze(last.e, ctx, c);
    },
  },
});

function freeze(e: CombatEnemy, ctx: RuntimeCtx, c: HookCtx): void {
  const t = c.tune(), now = ctx.now(), last: Record<number, number> = (c.state.frozen ??= {});
  if (!e.alive || now - (last[e.id] ?? -Infinity) < t.cooldown) return;
  const frozen = ctx.stun(e, t.freeze, Tag.frost);
  if (e.alive && frozen > 0) {
    last[e.id] = now;
    e.frozenT = frozen;
    ctx.fx.frostBurst(e.x, e.y - 20, 6);
    ctx.sound('frost', { rate: 1.3, volume: 0.5 });
  }
}
