import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Nail Gun + Battery + Tin Foil Hat + Magnet (replaces Nailstorm): nails become energy bolts that never pierce and splash on impact; every
// `every`th shot is the big red one. No stat changes (the Nailstorm pierce and homing are simply not applied). `pattern:fire` takes the
// nail's place and hangs the splash on the shot; `pattern:shotHit` applies it. `splashMult` / `bigMult` are fractions of the hit damage
// (the red bolt splashes for 120%); the text calls the red bolt's extra "+20% splash damage" (kept as it was). The ordinal suffix in the
// text ("3rd") is literal.
export default defineCombo({
  id: Combo.rayGun, requires: [Item.nailgun, Item.battery, Item.tinfoilhat, Item.magnet],
  tune: { splashR: 60, splashMult: 0.6, every: 3, bigR: 120, bigMult: 1.2 },
  text: {
    en: {
      name: 'Ray Gun', short: 'Energy bolts, splash, {every}rd is huge',
      summary: 'Nail Gun touching a Battery, a Tin Foil Hat AND a Magnet: pew pew.',
      detail: 'Nails become green energy bolts (no piercing) that splash {splashMult|pct} damage to enemies within {splashR}. Every {every}rd shot is a red overcharged bolt: splash radius {bigR} and +{bigMult|pctup}% splash damage. Replaces Nailstorm.',
    },
    de: {
      name: 'Strahlenkanone', short: 'Energiestrahlen, Splash, jeder {every}. riesig',
      summary: 'Nagelpistole berührt Batterie, Aluhut UND Magnet: Piu piu.',
      detail: 'Nägel werden zu grünen Energiestrahlen (ohne Durchschlag), die {splashMult|pct} Schaden auf Gegner im Umkreis von {splashR} verteilen. Jeder {every}. Schuss ist ein roter Überladungsstrahl: Splash-Radius {bigR} und +{bigMult|pctup}% Splash-Schaden. Ersetzt Nagelsturm.',
    },
  },
  replaces: [Combo.nailstorm],
  hooks: {
    'pattern:fire'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune(), st = ev.stats, shots: Record<string, number> = (c.state.shots ??= {});
      const big = (shots[st.uid] = (shots[st.uid] ?? 0) + 1) % t.every === 0;
      const s = ctx.spawnShot({ key: big ? 'proj_raybolt_red' : 'proj_raybolt', x: ev.x, y: ev.y, angle: ev.angle, speed: st.projectileSpeed, life: st.range / st.projectileSpeed, damage: st.damage, stats: st, maxHits: 1 });
      if (s) s.splash = big ? { r: t.bigR, m: t.bigMult } : { r: t.splashR, m: t.splashMult };
      if (ev.first) ctx.sound('zap', { volume: 0.5, rate: big ? 0.7 : 1.4 });
      ev.handled = true;
    },
    'pattern:shotHit'(ev, ctx, c) {
      const { shot, enemy } = ev, sp = shot.splash;
      if (!sp || !c.touches(ev.stats.uid)) return;
      ctx.fx.ring('fx_pulse', shot.x, shot.y, sp.r * 2, 300, sp.m > c.tune().splashMult ? 0xf45f52 : 0x5fd35a);
      for (const o of ctx.alive()) {
        if (o === enemy || (o.x - shot.x) ** 2 + (o.y - shot.y) ** 2 > (sp.r + o.def.radius) ** 2) continue;
        ctx.damage(o, shot.damage * sp.m, ev.stats, { quiet: true, chained: true });
      }
    },
  },
});
