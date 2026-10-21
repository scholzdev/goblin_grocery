import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.thermos, kind: 'passive', sets: [Set.kitchen], shape: '1x2', price: 14,
  tune: { cap: [15, 23, 30] },
  text: {
    en: { name: 'Thermos', blurb: 'Keeps the good stuff for later.', rules: 'Excess healing becomes a shield, up to {cap} HP. Absorbs damage after armor. Shield lasts between aisles but is lost when unequipped. Does not stack.' },
    de: { name: 'Thermoskanne', blurb: 'Bewahrt das Gute für später.', rules: 'Überschüssige Heilung wird zu einem Schild mit bis zu {cap} LP. Fängt Schaden nach der Rüstung ab. Bleibt zwischen Gängen erhalten, geht beim Ablegen verloren. Stapelt sich nicht.' },
  },
  rows: [{ label: { en: 'Shield capacity', de: 'Schildkapazität' }, key: 'cap' }],
  build: { phase: 'final', player(b, c) { b.overhealShieldCap = c.tune().cap; } },
  hooks: {
    order: 50,
    onPlayerHit(ev, ctx) { ev.dmg = ctx.absorbShield(ev.dmg); },
    onTick(_dt, ctx) { const shield = ctx.run.shield ?? 0; ctx.setLine(Item.thermos, shield > 0 ? ctx.t('tankShield', { hp: Math.ceil(shield) }) : null, 7); },
  },
});
