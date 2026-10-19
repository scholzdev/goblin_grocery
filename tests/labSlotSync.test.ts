import { describe, expect, it, vi } from 'vitest';

// flow reads `location` when src/lab.ts loads, and vitest runs in node.
vi.hoisted(() => { (globalThis as { location?: unknown }).location = { search: '' }; });

import { labAddItem, labClear } from '../src/state/run';
import { captureSlot } from '../src/state/lab';
import { flow } from '../src/flow';
import { store } from '../src/state/store';
import type { LabOpts } from '../src/types';

const base: LabOpts = { aisle: 3, dept: 'frozen', shift: 0, starter: 'toaster', weapon: 'toaster', money: 500, cart: [4, 4], shelf: 4, shopLevel: 1, god: false, event: 'random', mod: 'none', sandbox: true };

describe('loading a slot keeps Setup and the cart in step', () => {
  const fakeGame = { scene: { getScene: () => ({ scene: { restart: () => {} } }) } };

  it('the slot\'s cart and shelf size become the live setup', () => {
    flow.init(fakeGame as never);
    flow.startLab({ ...base, cart: [5, 4], shelf: 6 });
    const s = store.state;
    labClear(s);
    labAddItem(s, 'fan', 1, 'cart');
    const slot = captureSlot(s);
    flow.labTune({ cart: [4, 4], shelf: 4 });
    expect(flow.labSetup).toMatchObject({ cart: [4, 4], shelf: 4 });
    expect(flow.labLoad(slot)).toBe(true);
    expect([s.inventory.cols, s.inventory.rows, s.inventory.shelf.length]).toEqual([5, 4, 6]);
    expect(flow.labSetup).toMatchObject({ cart: [5, 4], shelf: 6 });
    expect(s.inventory.placed[0]?.type).toBe('fan');
    expect(s.build.weapons.length + s.inventory.placed.length).toBeGreaterThan(0);
  });

  it('a later setup edit does not undo the loaded cart', () => {
    flow.init(fakeGame as never);
    flow.startLab({ ...base, cart: [5, 4], shelf: 6 });
    const s = store.state;
    labClear(s);
    labAddItem(s, 'fan', 1, 'cart');
    const slot = captureSlot(s);
    flow.labTune({ cart: [4, 4], shelf: 4 });
    flow.labLoad(slot);
    flow.labTune({ god: true });
    expect([s.inventory.cols, s.inventory.rows]).toEqual([5, 4]);
    expect(s.inventory.placed[0]?.type).toBe('fan');
  });
});
