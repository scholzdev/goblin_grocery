import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'expiredmilk', kind: 'passive', sets: ['snacks'], shape: '1x2', price: 7,
  // Poison dps per ★ (the legacy 3 x TIER.mult); the aura geometry is flat. `hpCut` is the curse: max HP x (1 - hpCut), applied to the
  // finished total (the player hook has a high `order`; the rounding stays in computeBuild).
  tune: { dps: [3, 3 * 1.5, 3 * 2], radius: 110, interval: 0.5, duration: 1, hpCut: 0.1 },
  text: {
    en: { name: 'Expired Milk', blurb: 'Cursed. Smells like a bad decision.', rules: 'Cursed: poisons enemies within {radius} of the cart: {dps|ps} poison damage (refreshes every {interval|s}, does not stack). Your max HP is reduced by {hpCut|pct}. Combo: Sour Mist with Spray Bottle + Desk Fan.' },
    de: { name: 'Abgelaufene Milch', blurb: 'Verflucht. Riecht nach einer schlechten Entscheidung.', rules: 'Verflucht: vergiftet Gegner im Umkreis von {radius} um den Wagen: {dps|ps} Giftschaden (erneuert sich alle {interval|s}, stapelt sich nicht). Deine max. LP sinken um {hpCut|pct}. Combo: Sauernebel mit Sprühflasche + Tischventilator.' },
  },
  rows: [{ label: { en: 'Poison', de: 'Gift' }, key: 'dps', fmt: 'ps' }],
  build: {
    // `Build.stinkDps` still tells the scene to draw the cloud (cartCombos); the poison itself is the onTick hook below.
    // order 100: after every hook that adds max HP (Lunchbox, Snack Bag): the curse multiplies the total. computeBuild rounds it after.
    phase: 'final', order: 100,
    player(b, c) { const t = c.tune(); b.stinkDps = t.dps; b.maxHp *= 1 - t.hpCut; },
  },
  hooks: {
    // The toxic aura: every `interval` s it refreshes `duration` s of poison on everything near the cart. `c.state.t` is the countdown
    // (fresh per aisle, so the first tick lands on the first frame, like the scene's old `stinkT = 0`). Not while the goblin is down.
    onTick(dt, ctx, c) {
      if (ctx.player.dead) return;
      const t = c.tune();
      if ((c.state.t = (c.state.t ?? 0) - dt) > 0) return;
      c.state.t = t.interval;
      for (const e of ctx.inRadius(ctx.player, t.radius)) ctx.poison(e, t.dps, t.duration);
    },
  },
});
