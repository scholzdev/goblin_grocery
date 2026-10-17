import { defineSim } from './_sim';

// Enemy: gum. Sandbox with a neutral cart (a pan and a toaster, both ★2) and a handful of them; god mode is on, so you can watch the behaviour. Mortal where the behaviour needs a death.
export default defineSim({
  id: 'enemy-gum',
  notes: 'Bubble Gum (26 HP): drops a sticky puddle every 1.5 s (up to 6 per gum, 6 s each) that slows your walk by 30%, never your dash. Popped, it leaves a bigger trap. Four immortal gums keep trailing, three mortal ones show the trap.',
  cart: [
    { id: 'pan', tier: 2, at: [1, 1] },
    { id: 'toaster', tier: 2, at: [3, 2] },
  ],
  enemies: [
    { id: 'gum', count: 4 },
    { id: 'gum', count: 3, immortal: false },
  ],
});
