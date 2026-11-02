import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Self-Checkout Laser + Sale Flag: the beam plants the flag's mark on every enemy in its line (before the damage, so the beam itself already hits harder).
// The mark time is the Sale Flag's own (`tuneOf`, at its tier); the damage bonus is the shared mark rule (engine/marks.ts).
export default defineCombo({
  id: Combo.barcodeFlag, requires: [Item.laser, Item.flag],
  text: {
    en: {
      name: 'Sale Scan', short: 'Beam marks like the Sale Flag',
      summary: 'Self-Checkout Laser touching a Sale Flag: scan it, tag it, discount it.',
      detail: 'Every enemy in the beam is marked as if hit by the Sale Flag, for the flag\'s mark time (they take extra damage from everything).',
    },
    de: {
      name: 'Sale-Scan', short: 'Strahl markiert wie das Sale-Fähnchen',
      summary: 'Selbstscan-Laser berührt Sale-Fähnchen: scannen, auszeichnen, reduzieren.',
      detail: 'Jeder Gegner im Strahl wird wie vom Sale-Fähnchen markiert, so lange wie dessen Markierzeit (sie erleiden mehr Schaden von allem).',
    },
  },
  hooks: {
    'pattern:beam'(ev, ctx, c) {
      if (ev.stage !== 'before' || !c.touches(ev.stats.uid)) return;
      const seconds = c.tuneOf(Item.flag, c.owned(Item.flag)).duration;
      for (const e of ev.targets) ctx.mark(e, seconds);
    },
  },
});
