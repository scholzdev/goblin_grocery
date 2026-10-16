import { defineSim } from './_sim';

// One elite per affix (on cereal) against a three-star toaster. Mortal on purpose: the splitter has to die to split, the pickpocket to drop its loot.
export default defineSim({
  id: 'elites',
  notes: 'Swift, Tough, Splitter and Pickpocket cereal. They can die.',
  cart: [{ id: 'toaster', tier: 3, at: [1, 1] }],
  enemies: [
    { id: 'cereal', affix: 'swift', immortal: false },
    { id: 'cereal', affix: 'tough', immortal: false },
    { id: 'cereal', affix: 'splitter', immortal: false },
    { id: 'cereal', affix: 'pickpocket', immortal: false },
  ],
});
