import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.sample, kind: 'passive', sets: [Set.kitchen], shape: '1x1', price: 10,
  unlock: 'starting',
  tune: { heal: [1, 1.5, 2], cap: 2 }, // HP healed per crit per ★ (1 base x TIER.mult); `cap` = HP per (whole) second, flat
  text: {
    en: { name: 'Free Sample', blurb: 'Just a taste. Every crit is a snack.', rules: 'Every crit heals {heal|+n} HP, at most {cap} HP per second (does not stack). Needs a crit source like the Price Gun or Fortune Cookie.' },
    de: { name: 'Kostprobe', blurb: 'Nur zum Probieren. Jeder Krit ist ein Häppchen.', rules: 'Jeder Krit heilt {heal|+n} LP, höchstens {cap} LP pro Sekunde (stapelt sich nicht). Braucht eine Kritquelle wie Preisauszeichner oder Glückskeks.' },
  },
  rows: [{ label: { en: 'HP per crit', de: 'LP pro Krit' }, key: 'heal', fmt: '+n' }],
  hooks: {
    // Crits heal, capped per whole second so fast area weapons can't out-heal everything. `c.state` is fresh every aisle (it replaces the
    // scene's `critHealSec` / `critHealed` fields). Runs inside the crit branch of damageEnemy, before the Clearance Sale coin.
    onCrit(ev, ctx, c) {
      if (ctx.player.dead) return;
      const t = c.tune(), sec = Math.floor(ev.now);
      if (sec !== c.state.sec) { c.state.sec = sec; c.state.healed = 0; }
      const h = Math.min(t.heal, t.cap - c.state.healed, ctx.run.maxHp - ctx.run.hp);
      if (h > 0) {
        ctx.heal(h);
        c.state.healed += h;
        ctx.fx.spark(ctx.player.x, ctx.player.y - 46, 2, 0x8fcb57);
      }
    },
  },
});
