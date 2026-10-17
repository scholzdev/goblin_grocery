import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.tinfoilhat, kind: 'passive', sets: [Set.tools], shape: '1x1', price: 9,
  tune: { mult: [1.5, 1.5 * 1.5, 1.5 * 2], grace: 0.1 }, // reflected damage x per ★ (1.5 x TIER.mult); the post-dash grace in seconds is flat
  text: {
    en: { name: 'Tin Foil Hat', blurb: 'Blocks the signal. And the soda.', rules: 'While dashing (and {grace|s} after), enemy shots that touch you are reflected back at the groceries for {mult|x} of their damage instead of hurting you. Combos: Sparks Fly with Microwave + Battery; Ray Gun with Nail Gun + Battery + Magnet.' },
    de: { name: 'Aluhut', blurb: 'Blockt das Signal. Und die Limo.', rules: 'Beim Dashen (und {grace|s} danach) werden Gegnerschüsse, die dich berühren, mit {mult|x} ihres Schadens auf die Gegner zurückgeworfen, statt dich zu treffen. Combos: Funkenflug mit Mikrowelle + Batterie; Strahlenkanone mit Nagelpistole + Batterie + Magnet.' },
  },
  rows: [{ label: { en: 'Reflected damage', de: 'Reflektierter Schaden' }, key: 'mult', fmt: 'x' }],
  hooks: {
    // `player.reflectT` (> 0 while dashing and for `grace` s after) used to be set by the dash code. Same frame semantics here:
    // onDashStart opens it, onTick (emitted right after updatePlayer) keeps it at `grace` for every frame that began mid-dash
    // (`c.state.dashing` stays true through the dash's last frame, like the old `if (shoveT > 0)` at the top of the frame) and counts
    // it down afterwards.
    onDashStart(_ev, ctx, c) {
      c.state.dashing = true;
      ctx.player.reflectT = c.tune().grace;
    },
    onTick(dt, ctx, c) {
      const p = ctx.player;
      if (c.state.dashing) {
        p.reflectT = c.tune().grace;
        if (p.shoveT <= 0) c.state.dashing = false;
      } else {
        p.reflectT -= dt;
      }
    },
    // An enemy shot that touches the goblin: turned around instead of hurting. The mult is the best copy's (does not stack).
    onEnemyShotTouch(ev, ctx, c) {
      if (ctx.player.reflectT <= 0) return;
      ctx.reflectShot(ev.shot, c.tune().mult);
      ev.handled = true;
    },
  },
});
