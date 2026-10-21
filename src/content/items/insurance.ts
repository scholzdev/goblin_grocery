import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.insurance, kind: 'passive', sets: [Set.checkout], shape: '2x1', price: 35, legendary: true,
  tune: { floor: 1, invuln: 3 },
  text: {
    en: { name: 'Loyalty Life Insurance', blurb: 'Your continued shopping matters to us.', rules: 'Once per run, survive a fatal hit at {floor} HP and become invulnerable for {invuln|s}. Shared by all copies; buying or re-equipping cannot renew it.' },
    de: { name: 'Treue-Lebensversicherung', blurb: 'Dein weiterer Einkauf liegt uns am Herzen.', rules: 'Einmal pro Run: Überlebe einen tödlichen Treffer mit {floor} LP und werde für {invuln|s} unverwundbar. Alle Kopien teilen die Nutzung; Kaufen oder erneutes Ausrüsten erneuert sie nicht.' },
  },
  rows: [],
  hooks: {
    order: 100,
    onPlayerHit(ev, ctx, c) {
      if (ctx.run.hp <= 0 || ev.dmg < ctx.run.hp || !ctx.useRunOnce(Item.insurance)) return;
      ev.dmg = Math.max(0, ctx.run.hp - c.tune().floor);
      ev.invuln = Math.max(ev.invuln, c.tune().invuln);
      ctx.fx.ring('fx_pulse', ctx.player.x, ctx.player.y, 150, 500, 0xf5bd45);
      ctx.fx.label(ctx.player.x, ctx.player.y - 90, ctx.t('tankInsured'), '#F5BD45');
      ctx.sound('ding');
    },
  },
});
