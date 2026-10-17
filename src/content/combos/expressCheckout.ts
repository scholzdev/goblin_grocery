import { defineCombo } from '../../engine/define';

// Frying Pan + Shopping Bell: a dash that hits an enemy triggers one extra pan sweep, at most once per `icd` seconds per pan. The text
// keeps the literal "1.0 s" (the `s` formatter prints "1 s"). Runs after Pot Slam's blast (order 10 vs 0), as the dash code did.
export default defineCombo({
  id: 'expressCheckout', requires: ['pan', 'bell'],
  tune: { icd: 1.0 },
  text: {
    en: {
      name: 'Express Checkout', short: 'Dash → bonus pan sweep',
      summary: 'Frying Pan touching a Shopping Bell: dash triggers a bonus sweep.',
      detail: 'A dash that hits an enemy triggers one extra pan sweep (1.0 s internal cooldown). Bell dash cooldown reduction still applies.',
    },
    de: {
      name: 'Schnellkasse', short: 'Dash → Bonus-Pfannenschwung',
      summary: 'Bratpfanne berührt Einkaufsklingel: Dash löst einen Bonusschwung aus.',
      detail: 'Ein Dash, der einen Gegner trifft, löst einen zusätzlichen Pfannenschwung aus (1,0 s interne Abklingzeit). Die Dash-Abklingzeit-Senkung der Klingel gilt weiterhin.',
    },
  },
  hooks: {
    order: 10,
    // The dash ended after connecting with something: each pan with this combo sweeps once more along the dash, unless it swept less than
    // `icd` seconds ago. `c.state.last` is the time of the last bonus sweep per pan (fresh per aisle).
    onDashEnd(ev, ctx, c) {
      if (!ev.hit) return;
      const now = ctx.now(), icd = c.tune().icd, last: Record<string, number> = (c.state.last ??= {});
      let fired = false;
      for (const w of ctx.build.weapons) {
        if (!c.touches(w.uid) || now - (last[w.uid] ?? -Infinity) < icd) continue;
        last[w.uid] = now;
        ctx.sweep(w.uid, Math.atan2(ev.dy, ev.dx), true);
        fired = true;
      }
      if (fired) {
        ctx.sound('ding');
        ctx.fx.popImage('fx_receipt_burst', ev.x + ev.dx * 50, ev.y - 50, 0.9);
      }
    },
  },
});
