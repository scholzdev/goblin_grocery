import { defineCombo } from '../../engine/define';
import type { RuntimeCtx } from '../../engine/ctx';
import type { HookCtx } from '../../engine/hooks';
import { countStacks, pushStack } from '../../engine/stacks';
import { Combo, Item } from '../../engine/ids';

// Energy Drink next to Running Boots (a cart combo: no weapon): every dash adds a stack, +`perStack` move speed for `duration` s each, up
// to `max` (at the cap the oldest stack is refreshed). The stacks are `c.state.stacks` (expiry times; Tailwind adds to them through
// `c.stateOf`). The speed is a `speedMods` entry the hook registers on the first tick; the "SUGAR ###" text is a `setLine`.

const show = (ctx: RuntimeCtx, c: HookCtx): void => {
  const mods = ctx.player.speedMods;
  mods.sugarRush ??= (now) => 1 + c.tune().perStack * countStacks(c.state.stacks ?? [], now);
  const n = countStacks(c.state.stacks ?? [], ctx.now()), text = n ? `SUGAR ${'#'.repeat(n)}` : null;
  if (text !== (c.state.text ?? null)) { c.state.text = text; ctx.setLine(Combo.sugarRush, text, 0); }
};

export default defineCombo({
  id: Combo.sugarRush, requires: [Item.energy, Item.boot], cart: true,
  tune: { perStack: 0.08, duration: 3, max: 5 },
  text: {
    en: {
      name: 'Sugar Rush', short: 'Each dash: +{perStack|pctn}% speed (x{max})',
      summary: 'Energy Drink touching Running Boots: every dash fuels a sugar high.',
      detail: 'Each dash adds a stack: +{perStack|pctn}% move speed for {duration|s}, up to {max} stacks (each stack expires on its own).',
    },
    de: {
      name: 'Zuckerschock', short: 'Jeder Dash: +{perStack|pctn}% Tempo (x{max})',
      summary: 'Energydrink berührt Rennstiefel: jeder Dash löst einen Zuckerrausch aus.',
      detail: 'Jeder Dash fügt einen Stapel hinzu: +{perStack|pctn}% Bewegungstempo für {duration|s}, bis zu {max} Stapel (jeder Stapel läuft einzeln ab).',
    },
  },
  hooks: {
    onDashStart(_ev, ctx, c) {
      const t = c.tune();
      pushStack(c.state.stacks ??= [], ctx.now(), t.duration, t.max);
      show(ctx, c);
    },
    // Registers the speed multiplier once, and keeps the text in step with the stacks as they expire (one setLine per change).
    onTick(_dt, ctx, c) { show(ctx, c); },
  },
});
