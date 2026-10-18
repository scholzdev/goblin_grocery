import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Perishable (`age` = aisles completed in the cart). Fresh for `freshAisles` aisles: crit for every weapon. After that it stinks for good:
// a poison aura like Expired Milk's, and shop prices +priceMult while it is in the cart. With several copies, one fresh copy is enough for the crit
// and one stale copy is enough for the stink.
export default defineItem({
  id: Item.fish, kind: 'passive', sets: [Set.kitchen], shape: '2x1', price: 12,
  age: 'cart',
  tune: { crit: [0.15, 0.2, 0.25], freshAisles: 2, priceUp: 0.2, dps: 3, radius: 110, interval: 0.5, duration: 1 },
  text: {
    en: { name: 'Fresh Fish', blurb: 'Caught this morning. Do not look at it on Thursday.', rules: 'For {freshAisles|int} aisles in the cart: all weapons gain {crit|+pct} crit chance. After that it stinks for good: it poisons enemies within {radius} of the cart ({dps|ps} poison damage) and shop prices rise by {priceUp|pct} while it is in the cart.' },
    de: { name: 'Frischer Fisch', blurb: 'Heute früh gefangen. Am Donnerstag lieber nicht mehr hinsehen.', rules: 'Für {freshAisles|int} Gänge im Wagen: Alle Waffen erhalten {crit|+pct} Kritchance. Danach stinkt er für immer: Er vergiftet Gegner im Umkreis von {radius} um den Wagen ({dps|ps} Giftschaden), und die Shop-Preise steigen um {priceUp|pct}, solange er im Wagen liegt.' },
  },
  rows: [{ label: { en: 'Crit chance', de: 'Kritchance' }, key: 'crit', fmt: '+pct' }],
  look: (i, t) => ((i.age ?? 0) >= t.freshAisles ? 'rotten' : null),
  build: {
    // post-combo like Fortune Cookie: adds to the crit chance Price Gun assigned earlier.
    phase: 'post-combo',
    weapon(w, c) { if (freshFish(c.cart.placed, c.tune().freshAisles)) w.critChance += c.tune().crit; },
  },
  extraBuild: [{
    // order 30: after Checkout (assigns priceMult at 10) and Expired Coupon (x at 20). Milk assigns stinkDps at 100, so this takes the max.
    phase: 'final', order: 30,
    player(b, c) {
      const t = c.tune();
      if (!c.cart.placed.some((p) => p.type === Item.fish && (p.age ?? 0) >= t.freshAisles)) return;
      b.priceMult *= 1 + t.priceUp;
      b.stinkDps = Math.max(b.stinkDps, t.dps);
    },
  }],
  hooks: {
    onTick(dt, ctx, c) {
      const t = c.tune();
      if (ctx.player.dead || !c.instances.some((p) => (p.age ?? 0) >= t.freshAisles)) return;
      if ((c.state.t = (c.state.t ?? 0) - dt) > 0) return;
      c.state.t = t.interval;
      for (const e of ctx.inRadius(ctx.player, t.radius)) ctx.poison(e, t.dps, t.duration);
    },
  },
});

const freshFish = (placed: readonly { type: string; age?: number }[], freshAisles: number): boolean => placed.some((p) => p.type === Item.fish && (p.age ?? 0) < freshAisles);
