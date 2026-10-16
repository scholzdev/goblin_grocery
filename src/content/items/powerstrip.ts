import { defineItem } from '../../engine/define';

// Legendary (★1 only, never lifted by Gold Star): every electrical weapon in the cart attacks faster; the ones touching it even more.
// The code divides the cooldown by `all` / `adjacent`; the text shows the matching gains (`all - 1`, `adjacent - 1`).
const ALL = 1.2, ADJACENT = 1.4;

export default defineItem({
  id: 'powerstrip', kind: 'module', sets: ['tools'], shape: '3x1', price: 32, electrical: true, legendary: true,
  tune: { all: ALL, adjacent: ADJACENT, allGain: ALL - 1, adjacentGain: ADJACENT - 1 },
  text: {
    en: { name: 'Power Strip', blurb: 'Plugs the whole cart in at once.', rules: 'Every electrical weapon in the cart gains {allGain|+pct} attack rate; electrical weapons touching it gain {adjacentGain|+pct} instead.' },
    de: { name: 'Steckdosenleiste', blurb: 'Steckt den ganzen Wagen auf einmal ein.', rules: 'Jede elektrische Waffe im Wagen erhält {allGain|+pct} Angriffstempo; elektrische Waffen, die sie berühren, stattdessen {adjacentGain|+pct}.' },
  },
  build: {
    // Right after Sourdough's damage (both are global-mod): legacy ran the Sourdough loop, then this line, then the set bonuses.
    // Cart-wide, so it runs for every weapon while a strip is in the cart; two strips never stack (touching one is the better case).
    phase: 'global-mod', order: 20,
    weapon(w, c) {
      if (!c.def(w.type).electrical) return;
      const t = c.tune();
      w.cooldown /= c.touches(w) ? t.adjacent : t.all;
    },
  },
});
