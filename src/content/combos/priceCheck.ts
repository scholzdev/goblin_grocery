import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Self-Checkout Laser + Price Gun: the beam marks every enemy it is about to hit (`before`, so the beam itself already hits harder). The
// multiplier is engine behavior shared with Sale Flag (engine/marks.ts reads `damageMult` from this tune); Sale Flag's text shows `1 +
// bonus` and a test pins them equal.
export default defineCombo({
  id: Combo.priceCheck, requires: [Item.laser, Item.pricegun],
  tune: { duration: 3, damageMult: 1.2 },
  text: {
    en: {
      name: 'Price Check', short: 'Marks: +{damageMult|pctup}% dmg',
      summary: 'Self-Checkout Laser touching a Price Gun: everything gets a sticker.',
      detail: 'Enemies hit by the beam are marked for {duration|s} and take +{damageMult|pctup}% damage from everything.',
    },
    de: {
      name: 'Preisprüfung', short: 'Markiert: +{damageMult|pctup}% Schaden',
      summary: 'Selbstscan-Laser berührt Preisauszeichner: alles bekommt einen Aufkleber.',
      detail: 'Vom Strahl getroffene Gegner sind {duration|s} lang markiert und erleiden +{damageMult|pctup}% Schaden von allem.',
    },
  },
  hooks: {
    'pattern:beam'(ev, ctx, c) {
      if (ev.stage !== 'before' || !c.touches(ev.stats.uid)) return;
      const seconds = c.tune().duration;
      for (const e of ev.targets) ctx.mark(e, seconds);
    },
  },
});
