import { defineSim } from './_sim';

// Element soft counters, frost: the Fizz Cannon (frost only) with an Ice Pack, so every hit also slows. The groups walk, so the slow times show.
export default defineSim({
  id: 'affinity-frost',
  notes: 'Fizz Cannon ★3 (frost) with an Ice Pack: a cap hits for 13 (12 plus a small bundle bonus) and slows. Banana Bandit and Bubble Gum are weak to frost: 17 per hit, and the slow lasts 1.5x as long. Frozen Turkey resists frost: 9 per hit and half the slow time. The Melon Slice has no affinity: 13. They all walk at you: watch who keeps crawling and who recovers first.',
  cart: [
    { id: 'ice', tier: 3, at: [1, 1] },
    { id: 'fizz', tier: 3, at: [2, 1] },
  ],
  enemies: [
    { id: 'banana', count: 3, spread: 'cluster', at: [900, 300] },
    { id: 'turkey', count: 3, spread: 'cluster', at: [900, 470] },
    { id: 'gum', count: 3, spread: 'cluster', at: [900, 640] },
    { id: 'slice', count: 3, spread: 'cluster', at: [420, 470] },
  ],
});
