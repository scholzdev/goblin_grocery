import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';
import { isWet } from '../../engine/wet';
import type { CombatEnemy } from '../../engine/ctx';
import type { WeaponStats } from '../../types';

// Mop + Battery: every `every` s the puddles zap up to `targets` Wet enemies that stood in them within `memory` s, for `damageMult` x the puddle tick damage. The puddle
// has no enemy list, so `pattern:puddleEnter` records each visit. The zap is `quiet` with no electric tag and no chain: an electric hit would trigger Conduct and
// consume the Wet it needs.
interface Visit { e: CombatEnemy; t: number; stats: WeaponStats }

export default defineCombo({
  id: Combo.liveWire, requires: [Item.mop, Item.battery],
  tune: { every: 1, targets: 3, damageMult: 1, memory: 0.6 },
  text: {
    en: {
      name: 'Live Wire', short: 'Puddles zap Wet enemies',
      summary: 'Mop touching a Battery: the soapy floor is live.',
      detail: 'Every {every|s} the puddles zap up to {targets} Wet enemies that just stood in them for {damageMult|pct} puddle damage. The zap does not use up Wet.',
    },
    de: {
      name: 'Stromschlag', short: 'Pfützen zappen nasse Gegner',
      summary: 'Wischmopp berührt Batterie: der Seifenboden steht unter Strom.',
      detail: 'Alle {every|s} zappen die Pfützen bis zu {targets} nasse Gegner, die gerade darin standen, für {damageMult|pct} Pfützenschaden. Der Blitz verbraucht die Nässe nicht.',
    },
  },
  hooks: {
    'pattern:puddleEnter'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      (c.state.visits ??= {})[ev.enemy.id] = { e: ev.enemy, t: ctx.now(), stats: ev.stats } satisfies Visit;
    },
    onTick(dt, ctx, c) {
      const t = c.tune(), visits: Record<number, Visit> | undefined = c.state.visits;
      c.state.acc = Math.min(t.every, (c.state.acc ?? 0) + dt);
      if (!visits || c.state.acc < t.every) return;
      c.state.acc -= t.every;
      const now = ctx.now();
      let zapped = 0;
      for (const v of Object.values(visits)) {
        if (now - v.t > t.memory || !v.e.alive) { delete visits[v.e.id]; continue; }
        if (zapped >= t.targets || !isWet(v.e.status, now)) continue;
        zapped++;
        ctx.boltFx(v.e.x, v.e.y, true);
        ctx.damage(v.e, v.stats.damage * t.damageMult, v.stats, { quiet: true });
      }
      if (zapped) ctx.sound('zap', { rate: 1.3, volume: 0.5 });
    },
  },
});
