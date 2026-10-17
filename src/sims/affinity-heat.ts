import { defineSim } from './_sim';

// Element soft counters, heat: a heat-only cart (the Frying Pan; the Toaster would add electric) against four still groups placed around it.
export default defineSim({
  id: 'affinity-heat',
  notes: 'Frying Pan ★3 (heat): a swing hits for 18. Baguette (up left) and Frozen Turkey (up right) are weak to heat: 23 per hit, the number tinted orange. Bubble Gum (down left) resists heat: 13, a dim grey number. The Melon Slice (down right) has no affinity: 18. A burn would last 1.5x as long on the first two, half as long on the gum.',
  cart: [
    { id: 'pan', tier: 3, at: [2, 1] },
  ],
  enemies: [
    { id: 'baguette', count: 3, still: true, spread: 'cluster', at: [530, 440] },
    { id: 'turkey', count: 3, still: true, spread: 'cluster', at: [750, 440] },
    { id: 'gum', count: 3, still: true, spread: 'cluster', at: [530, 580] },
    { id: 'slice', count: 3, still: true, spread: 'cluster', at: [750, 580] },
  ],
});
