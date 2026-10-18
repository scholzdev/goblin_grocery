import { describe, expect, it } from 'vitest';
import freshBread from '../../../src/content/combos/freshBread';
import { arena, at, bare, describeCombo } from './helpers';

describeCombo('freshBread', freshBread, ['Fresh Bread', 'Frisches Brot']);

describe('Fresh Bread: build', () => {
  const pierceAt = (tier: number) => arena([at('toaster'), at('sourdough', tier)]).stats.pierce;
  it('adds one pierce at Sourdough ★1 and ★2, two once it has fully risen (★3 and above)', () => {
    const base = bare('toaster').pierce;
    expect([1, 2, 3, 4].map(pierceAt)).toEqual([base + 1, base + 1, base + 2, base + 2]);
  });
});
