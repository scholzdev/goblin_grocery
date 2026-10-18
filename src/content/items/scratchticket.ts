import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// A cursed item: at the start of every aisle, one roll on the combat rng (seeded by run seed + aisle). A win pays coins, a loss costs
// `lose` of max HP (through `ctx.drain`, so it can't kill).
export default defineItem({
  id: Item.scratchticket, kind: 'passive', sets: [Set.checkout], shape: '1x1', price: 8,
  tune: { chance: 0.2, coins: [30, 45, 60], lose: 0.1, floor: 1 }, // the win scales with the ★ (30 x TIER.mult); the odds and the loss are flat
  text: {
    en: { name: 'Scratch Ticket', blurb: 'Feeling lucky? The aisle will tell.', rules: 'Each aisle starts with a {chance|pctn}% chance of {coins} coins. Otherwise you lose {lose|pctn}% of your max HP (never below {floor} HP).' },
    de: { name: 'Rubbellos', blurb: 'Glück gehabt? Der Gang verrät es.', rules: 'Jeder Gang beginnt mit {chance|pctn} % Chance auf {coins} Münzen. Sonst verlierst du {lose|pctn} % deiner Max.-LP (nie unter {floor} LP).' },
  },
  rows: [{ label: { en: 'Win', de: 'Gewinn' }, key: 'coins' }],
  hooks: {
    onAisleStart(_ev, ctx, c) {
      const t = c.tune();
      if (ctx.rng() < t.chance) {
        ctx.addCoins(t.coins, ctx.t('coinScratch'));
        ctx.fx.number(ctx.player.x, ctx.player.y - 90, t.coins, '#F5BD45', 22);
        ctx.sound('coin');
      } else {
        ctx.drain(Math.round(ctx.run.maxHp * t.lose));
        ctx.sound('hurt', { volume: 0.5 });
      }
    },
  },
});
