import { defineItem } from '../../engine/define';
import { Item, Set, Tag } from '../../engine/ids';

// A cursed item: heat hits and burns hit harder, and every hit you take sets YOU on fire. The burn is state of this owner (`c.state`, fresh per
// aisle): `left` seconds of burn remaining and `acc` toward the next tick. Each tick is `ctx.drain`: no hurt reaction, no i-frames, never below 1 HP.
export default defineItem({
  id: Item.ghostpepper, kind: 'passive', sets: [Set.kitchen, Set.heat], shape: '1x1', price: 14,
  tune: { heat: [0.5, 0.65, 0.8], dps: 1.5, duration: 2, tick: 0.5, floor: 1 }, // bonus heat damage per ★; the self-burn is flat and refreshes, never stacks
  text: {
    en: { name: 'Ghost Pepper', blurb: 'Hot. Regrettably, for everyone.', rules: 'Heat hits and burn deal {heat|+pct} damage. When you get hit you burn for {dps|ps} over {duration|s} (refreshes, never stacks). The burn cannot take you below {floor} HP.' },
    de: { name: 'Geisterpaprika', blurb: 'Scharf. Leider für alle.', rules: 'Hitzetreffer und Brand richten {heat|+pct} Schaden an. Wenn du getroffen wirst, brennst du mit {dps|ps} für {duration|s} (erneuert sich, stapelt sich nie). Der Brand lässt dich nie unter {floor} LP fallen.' },
  },
  rows: [{ label: { en: 'Heat damage', de: 'Hitzeschaden' }, key: 'heat', fmt: '+pct' }],
  hooks: {
    modifyDamage(hit, _ctx, c) { if (hit.tags.includes(Tag.heat)) hit.dmg *= 1 + c.tune().heat; },
    onPlayerHit(_ev, ctx, c) {
      c.state.left = c.tune().duration; // refresh: the tick clock keeps running, so re-burning never speeds the ticks up
      c.state.acc ??= 0;
      ctx.setLine(Item.ghostpepper, 'BURNING', 5);
    },
    onTick(dt, ctx, c) {
      if (!(c.state.left > 0)) return;
      const t = c.tune(), step = Math.min(dt, c.state.left);
      c.state.left -= step;
      c.state.acc += step;
      while (c.state.acc >= t.tick - 1e-9) {
        c.state.acc -= t.tick;
        ctx.drain(t.dps * t.tick, Item.ghostpepper);
        ctx.fx.flame(ctx.player.x, ctx.player.y - 50);
      }
      if (c.state.left <= 1e-9) { c.state.left = 0; c.state.acc = 0; ctx.setLine(Item.ghostpepper, null); }
    },
  },
});
