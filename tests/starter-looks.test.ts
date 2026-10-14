import { describe, expect, it } from 'vitest';
import { PLAYER, STARTER_LOOKS } from '../src/data/items';
import { SVG_ASSETS } from '../src/data/assets';

describe('starter looks', () => {
  it('every starter has a look whose assets exist', () => {
    const keys = new Set(SVG_ASSETS.map((a) => a.key));
    for (const id of Object.keys(PLAYER.starters) as (keyof typeof PLAYER.starters)[]) {
      const look = STARTER_LOOKS[id];
      expect(look, id).toBeTruthy();
      for (const k of [look.head, look.torso]) if (k) expect(keys.has(k), k).toBe(true);
    }
  });
});
