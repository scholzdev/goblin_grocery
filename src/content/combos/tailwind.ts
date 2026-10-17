import { defineCombo } from '../../engine/define';
import { pushStack, tailwindFeedsSugar } from '../../engine/stacks';
import { Combo, Item } from '../../engine/ids';

// Leaf Blower + Desk Fan + Running Boots: each blast pushes the cart (+`boost` move speed for `boostTime` s, only while moving; the
// `speedMods` entry reads `c.state.windUntil`). With Sugar Rush active a blast also adds one of its stacks (`c.stateOf`), at most once per
// `sugarIcd` s.
export default defineCombo({
  id: Combo.tailwind, requires: [Item.leafblower, Item.fan, Item.boot],
  tune: { boost: 0.3, boostTime: 0.4, sugarIcd: 1.5 },
  text: {
    en: {
      name: 'Tailwind', short: 'Blasts push the cart forward',
      summary: 'Leaf Blower touching a Desk Fan AND Running Boots: ride your own breeze.',
      detail: 'Each blower blast gives the cart a short forward push: +{boost|pctn}% move speed for {boostTime|s} while you are moving. With Sugar Rush also active, every blast adds a Sugar Rush stack ({sugarIcd|s} internal cooldown).',
    },
    de: {
      name: 'Rückenwind', short: 'Böen schieben den Wagen vor',
      summary: 'Laubbläser berührt Tischventilator UND Rennstiefel: reite auf deinem eigenen Wind.',
      detail: 'Jede Bläser-Böe gibt dem Wagen einen kurzen Schub nach vorn: +{boost|pctn}% Bewegungstempo für {boostTime|s}, solange du dich bewegst. Ist auch Zuckerschock aktiv, gibt jede Böe einen Zuckerschock-Stapel ({sugarIcd|s} interne Abklingzeit).',
    },
  },
  hooks: {
    'pattern:cone'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune(), now = ctx.now(), p = ctx.player;
      ctx.player.speedMods.tailwind ??= (at) => (at < (c.state.windUntil ?? 0) ? 1 + c.tune().boost : 1);
      if (Math.hypot(p.vx, p.vy) > 1) c.state.windUntil = now + t.boostTime; // no push while standing still
      const sugar = c.stateOf(Combo.sugarRush);
      if (sugar && tailwindFeedsSugar(true, now, c.state.fed ?? -Infinity, t.sugarIcd)) {
        const s = c.tuneOf(Combo.sugarRush);
        pushStack(sugar.stacks ??= [], now, s.duration, s.max);
        c.state.fed = now;
      }
    },
  },
});
