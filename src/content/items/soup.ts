import { defineItem } from '../../engine/define';
import { Item, Set } from '../../engine/ids';

export default defineItem({
  id: Item.soup, kind: 'passive', sets: [Set.snacks], shape: '1x2', price: 11,
  tune: { hp: [20, 30, 40], heal: [15, 23, 30], every: 3 },
  text: {
    en: { name: 'Canned Soup', blurb: 'Comfort food. Reinforced packaging.', rules: '{hp|+int} max HP (does not heal on equip). Heal {heal} HP every {every} aisle clears while equipped. Does not stack.' },
    de: { name: 'Dosensuppe', blurb: 'Wohlfühlessen. Verstärkte Verpackung.', rules: '{hp|+int} max. LP (heilt beim Ausrüsten nicht). Jeder {every}. geräumte Gang stellt {heal} LP wieder her, solange ausgerüstet. Stapelt sich nicht.' },
  },
  rows: [{ label: { en: 'Max HP', de: 'Max. LP' }, key: 'hp', fmt: '+int' }, { label: { en: 'Clear healing', de: 'Heilung nach Gang' }, key: 'heal' }],
  build: { phase: 'final', player(b, c) { const t = c.tune(); b.maxHp += t.hp; b.clearHeal = { every: t.every, hp: t.heal }; } },
});
