import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.peas, kind: 'passive', sets: [Set.snacks, Set.frost], shape: '1x1', price: 10,
  tune: { reduction: [0.3, 0.35, 0.4], duration: 2 },
  text: {
    en: { name: 'Frozen Peas', blurb: 'For bumps, bruises and bad decisions.', rules: 'After losing HP to a hit, take {reduction|pct} less damage for {duration|s}. Further hits refresh the protection. Does not stack.' },
    de: { name: 'Tiefkühlerbsen', blurb: 'Für Beulen, blaue Flecken und schlechte Ideen.', rules: 'Nach LP-Verlust durch einen Treffer nimmst du für {duration|s} {reduction|pct} weniger Schaden. Weitere Treffer erneuern den Schutz. Stapelt sich nicht.' },
  },
  rows: [{ label: { en: 'Damage reduction', de: 'Schadensreduktion' }, key: 'reduction', fmt: 'pct' }],
  hooks: {
    order: -20,
    onPlayerHit(ev, ctx, c) { if (ctx.now() < (c.state.until ?? 0)) ev.dmg *= 1 - c.tune().reduction; },
    afterPlayerHit(_ev, ctx, c) { if (ctx.run.hp > 0) c.state.until = ctx.now() + c.tune().duration; },
    onTick(_dt, ctx, c) { ctx.setLine(Item.peas, ctx.now() < (c.state.until ?? 0) ? ctx.t('tankChilled') : null, 8); },
  },
});
