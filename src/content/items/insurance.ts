import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.insurance, kind: 'passive', sets: [Set.checkout], shape: '2x1', price: 35, legendary: true,
  tune: { health: 0.5, invuln: 3 },
  text: {
    en: { name: 'Loyalty Life Insurance', blurb: 'Your continued shopping matters to us.', rules: 'Once per run, a fatal hit revives you with {health|pct} max HP and makes you invulnerable for {invuln|s}. Shared by all copies; buying or re-equipping cannot renew it.' },
    de: { name: 'Treue-Lebensversicherung', blurb: 'Dein weiterer Einkauf liegt uns am Herzen.', rules: 'Einmal pro Run: Ein tödlicher Treffer belebt dich mit {health|pct} deiner Max.-LP wieder und macht dich für {invuln|s} unverwundbar. Alle Kopien teilen die Nutzung; Kaufen oder erneutes Ausrüsten erneuert sie nicht.' },
  },
  rows: [],
  hooks: {
    order: 100,
    onPlayerHit(ev, ctx, c) {
      if (ctx.run.hp <= 0 || ev.dmg < ctx.run.hp || !ctx.useRunOnce(Item.insurance)) return;
      const hp = Math.max(1, Math.ceil(ctx.run.maxHp * c.tune().health));
      // Resolve before damagePlayer can end the run. Healing alone never revives a dead player.
      ctx.heal(Math.max(0, hp - ctx.run.hp));
      ev.dmg = Math.max(0, ctx.run.hp - hp);
      ev.invuln = Math.max(ev.invuln, c.tune().invuln);
      ctx.fx.ring('fx_pulse', ctx.player.x, ctx.player.y, 150, 500, 0xf5bd45);
      ctx.healFx(ctx.player.x, ctx.player.y);
      ctx.fx.label(ctx.player.x, ctx.player.y - 90, ctx.t('tankInsured'), '#F5BD45');
      ctx.sound('ding');
    },
  },
});
