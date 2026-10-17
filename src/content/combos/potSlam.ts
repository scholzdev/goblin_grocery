import { defineCombo } from '../../engine/define';

// Pressure Cooker + Slam Bumper: every dash ends in a full pot explosion at the landing spot (`pattern:explode` fires, so Pressure Point
// and Shrapnel follow). Runs right after the Bumper's shockwave and before Express Checkout (order 0 vs 10), as the dash code did.
export default defineCombo({
  id: 'potSlam', requires: ['cooker', 'bumper'],
  text: {
    en: {
      name: 'Pot Slam', short: 'Dash landing = pot blast',
      summary: 'Pressure Cooker touching a Slam Bumper: the dash lands with a pot blast.',
      detail: 'Every dash ends in a full Pressure Cooker explosion at the landing spot (damage, radius and knockback of the cooker). Fires every dash, independent of the cooker timer.',
    },
    de: {
      name: 'Topf-Slam', short: 'Dash-Landung = Topfknall',
      summary: 'Schnellkochtopf berührt Rammschutz: der Dash landet mit einem Topfknall.',
      detail: 'Jeder Dash endet mit einer vollen Schnellkochtopf-Explosion am Landepunkt (Schaden, Radius und Rückstoß des Topfs). Löst bei jedem Dash aus, unabhängig vom Topf-Timer.',
    },
  },
  hooks: {
    onDashEnd(ev, ctx, c) {
      for (const w of ctx.build.weapons) if (c.touches(w.uid)) ctx.explode(w.uid, ev.x, ev.y);
    },
  },
});
