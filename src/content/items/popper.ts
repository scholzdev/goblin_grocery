import { defineItem } from '../../engine/define';

export default defineItem({
  id: 'popper', kind: 'module', sets: ['snacks', 'blast'], shape: '1x1', price: 10, buff: 'popper',
  tune: { damage: [6, 9, 12], radius: 70 }, // confetti damage per ★ (6 base x TIER.mult); the radius is flat
  text: {
    en: { name: 'Party Popper', blurb: 'Every kill is a celebration.', rules: 'Enemies killed by adjacent weapons explode in confetti: {damage} damage within {radius}. Popper explosions never chain.' },
    de: { name: 'Partyknaller', blurb: 'Jeder Abschuss ist ein Fest.', rules: 'Von angrenzenden Waffen besiegte Gegner explodieren in Konfetti: {damage} Schaden im Umkreis von {radius}. Knaller-Explosionen lösen keine Kettenreaktion aus.' },
  },
  rows: [{ label: { en: 'Blast damage', de: 'Explosionsschaden' }, key: 'damage' }],
  build: {
    phase: 'module', order: 80,
    weapon(w, c) {
      const t = c.tune();
      w.popper = { damage: t.damage, radius: t.radius };
    },
  },
});
