import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.bubblewrap, kind: 'passive', sets: [Set.checkout], shape: '3x1', price: 10,
  tune: { armor: [1, 2, 3], minDamage: 1, invuln: 0.25, charges: 1, popInvuln: 1.5, popDamage: [10, 15, 20], popRadius: 80 }, // flat damage soaked per hit = the tier (also above ★3: Gold Star's ★4 soaks 4), but a hit always deals `minDamage`; extra i-frames in seconds
  text: {
    en: { name: 'Bubble Wrap', blurb: 'Pop-proof padding for your cart.', rules: 'Take {armor} less damage from every hit (minimum {minDamage}) and +{invuln|s} invulnerability after being hit (does not stack). Active (E, {charges} per aisle): Pop, {popInvuln|s} invulnerable and a {popDamage} damage blast around you.' },
    de: { name: 'Luftpolsterfolie', blurb: 'Platzsichere Polsterung für deinen Wagen.', rules: 'Nimm {armor} Schaden weniger pro Treffer (mindestens {minDamage}) und +{invuln|s} Unverwundbarkeit nach einem Treffer (stapelt sich nicht). Aktiv (E, {charges} pro Gang): Platzen, {popInvuln|s} unverwundbar und eine Druckwelle mit {popDamage} Schaden um dich.' },
  },
  rows: [{ label: { en: 'Armor', de: 'Rüstung' }, key: 'armor' }, { label: { en: 'Pop damage', de: 'Platz-Schaden' }, key: 'popDamage' }],
  active: {
    // Pop: long i-frames and a blast around the goblin. The passive armor above is untouched.
    use(ctx, c) {
      const t = c.tune(), p = ctx.player;
      p.invulnT = Math.max(p.invulnT, t.popInvuln);
      ctx.damageArea(p, t.popRadius, t.popDamage, null, { label: 'Pop' });
      ctx.fx.ring('fx_pulse', p.x, p.y, t.popRadius * 2.4, 320);
      ctx.fx.confetti(p.x, p.y - 20, 10);
      ctx.sound('bubble', { rate: 1.3 });
    },
  },
  hooks: {
    // Runs in hurtPlayer after the i-frame / guard checks, before the hp is taken: the armor used to be applied in `run.damagePlayer`
    // (`max(1, amount - armor)`), the i-frame bonus in hurtPlayer itself. Every hit on the goblin goes through hurtPlayer.
    onPlayerHit(ev, _ctx, c) {
      const t = c.tune();
      ev.dmg = Math.max(t.minDamage, ev.dmg - t.armor);
      ev.invuln += t.invuln;
    },
  },
});
