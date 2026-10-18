import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

// Contract item: each aisle shows one goal drawn from the cart (data/contracts.ts, systems/contracts.ts). The effect lives in the arena (progress), the
// HUD (sticker) and state/run.ts (free reroll), so there is no build or hook here; the tier only sets the coin reward.
export default defineItem({
  id: Item.punchcard, kind: 'passive', sets: [Set.checkout], shape: '1x1', price: 10,
  tune: { coins: [5, 8, 12] },
  text: {
    en: { name: 'Punch Card', blurb: 'Ten punches and the sandwich is free.', rules: 'Each aisle gives you one goal that suits your cart. Complete it for {coins} coins and a free reroll in the next shop (does not stack).' },
    de: { name: 'Stempelkarte', blurb: 'Zehn Stempel und das Brötchen ist gratis.', rules: 'Jeder Gang stellt dir ein Ziel, das zu deinem Wagen passt. Schaffst du es, gibt es {coins} Münzen und einen Gratis-Reroll im nächsten Shop (stapelt sich nicht).' },
  },
  rows: [{ label: { en: 'Reward coins', de: 'Münzen-Belohnung' }, key: 'coins' }],
});
