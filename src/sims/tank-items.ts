import { defineSim } from './_sim';
import { Enemy, Item } from '../engine/ids';

export default defineSim({
  id: 'tank-items',
  notes: 'Tank items: god mode is OFF. Walk into groceries to test armor, Frozen Peas and the Emergency Sandwich. Thermos stores excess regen as a shield. Insurance saves one fatal hit per run. F8: swap any of the nine items from the shelf. F9: fresh test.',
  god: false,
  cart: [
    { id: Item.tomato, at: [0, 0] },
    { id: Item.helmet, at: [2, 0] },
    { id: Item.peas, at: [5, 0] },
    { id: Item.sandwich, at: [2, 2] },
    { id: Item.thermos, at: [5, 2] },
  ],
  shelf: [
    { id: Item.ovenmitts }, { id: Item.soup }, { id: Item.blanket },
    { id: Item.rubberboots }, { id: Item.insurance },
  ],
  enemies: [
    { id: Enemy.milk, count: 6, spread: 'ring', still: true },
    { id: Enemy.spitter, at: [1000, 400], still: false },
    { id: Enemy.gum, at: [900, 650], still: false },
  ],
});
