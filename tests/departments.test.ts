import { describe, expect, it } from 'vitest';
import { DEPARTMENTS, THEMES } from '../src/data/departments';
import { AFFIX } from '../src/data/enemies';
import { OBSTACLES } from '../src/data/obstacles';
import { ITEMS } from '../src/data/items';
import { createRun } from '../src/state/run';
import { mulberry32 } from '../src/systems/rng';
import { rollOffers } from '../src/systems/shop';

describe('departments', () => {
  it('are the five themes and the boss aisle: Clearance is a door modifier only, no department', () => {
    expect(Object.keys(DEPARTMENTS).sort()).toEqual([...THEMES, 'boss'].sort());
    expect(Object.keys(OBSTACLES)).toEqual(['boss']);
  });

  it('the Pickpocket affix has no dead pull speed', () => {
    expect(Object.keys(AFFIX.pickpocket).sort()).toEqual(['absorbRadius', 'color', 'radius']);
  });
});

describe('Frozen Foods shop bias', () => {
  it('favors heat items (the aisle is cold; the answer is fire), not the frost kit', () => {
    expect(DEPARTMENTS.frozen.shopBias).toEqual(['fuel', 'toaster', 'hotsauce']);
    for (const id of DEPARTMENTS.frozen.shopBias) expect(ITEMS[id].element, id).toBe('heat');
  });

  it('makes those items turn up more often in the next shop', () => {
    const s = createRun(1);
    const seen = (bias: typeof DEPARTMENTS.frozen.shopBias) => {
      let n = 0;
      for (let seed = 0; seed < 300; seed++) n += rollOffers(s, mulberry32(seed), 2, false, { bias }).filter((o) => DEPARTMENTS.frozen.shopBias.includes(o.type)).length;
      return n;
    };
    expect(seen(DEPARTMENTS.frozen.shopBias)).toBeGreaterThan(seen([]) * 1.05);
    expect(seen(DEPARTMENTS.frozen.shopBias)).toBeLessThan(seen([]) * 1.5);
  });
});
