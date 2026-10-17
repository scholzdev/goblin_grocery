import { defineSim } from './_sim';

// Element soft counters, electric: the Laser and the Blender declare `elements: ['electric']`, so their own hits are electric; the Toaster, Microwave,
// Nail Gun and Vacuum are not. Electric L3 on a Laser, a Battery, a Blender and a Power Strip; three groups stand on the Laser's line so its beam,
// and the arcs it throws (electric too), reach all of them.
export default defineSim({
  id: 'affinity-electric',
  notes: 'Electric L3 (laser, battery, blender, power strip). The Laser and the Blender are electric themselves: the Laser beam hits every enemy on its line for 22, 29 on Soda Six-Pack and Canned Beans (weak to electric, a tinted number), 22 on Sour Milk (the beans soak some). Each hit has a 30% chance to arc to 3 more enemies for half the damage, also electric: 11 on Sour Milk, 15 on soda and beans. The groups stand in one line so the beam reaches them all.',
  cart: [
    { id: 'laser', at: [0, 0] },
    { id: 'battery', at: [2, 0] },
    { id: 'blender', at: [3, 0] },
    { id: 'powerstrip', at: [3, 2] },
  ],
  enemies: [
    { id: 'soda', count: 3, still: true, spread: 'cluster', at: [760, 500] },
    { id: 'beans', count: 3, still: true, spread: 'cluster', at: [900, 500] },
    { id: 'milk', count: 3, still: true, spread: 'cluster', at: [1040, 500] },
  ],
});
