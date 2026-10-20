import { afterEach, describe, expect, it } from 'vitest';
import { itemRules } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { arsenal, at } from '../helpers';

afterEach(() => setLang('en'));

// The goblin stands at (0, 0) facing right, so every puddle lands on (-40, 4): the enemy below sits in each one.
function inPuddles(specs: Parameters<typeof arsenal>[0], frames: number) {
  const { a, fake } = arsenal(specs);
  const e = fake.spawnEnemy({ x: -40, y: 4, hp: 100000 });
  a.run(frames, 0.05);
  return { stuns: fake.callsOf('stun').filter((c) => c.enemy === e.id), slides: fake.callsOf('slide').length };
}

describe('Snow Cone Machine: ★3 freeze', () => {
  it('adds the ★3 line to the rules from ★3 on, EN and DE', () => {
    expect([1, 2].map((t) => itemRules('snowcone', t).includes('★3'))).toEqual([false, false]);
    expect(itemRules('snowcone', 3)).toMatch(/Ice Sheet\. ★3: The first time an enemy steps into a puddle it freezes for 0\.5 s\.$/);
    setLang('de');
    expect(itemRules('snowcone', 3)).toMatch(/Eisfläche\. ★3: Tritt ein Gegner zum ersten Mal in eine Pfütze, friert er 0,5 s lang fest\.$/);
  });

  it('from ★3 (★4 too) an enemy freezes once on its first tick in a puddle: a 0.5 s frost stun; at ★2 it does not', () => {
    expect(inPuddles([at('snowcone', 2)], 14).stuns).toEqual([]);
    for (const tier of [3, 4]) {
      const { stuns } = inPuddles([at('snowcone', tier)], 14);
      expect(stuns.map((c) => [c.seconds, c.tag]), `★${tier}`).toEqual([[0.5, 'frost']]);
    }
  });

  it('every new puddle freezes it again, and the freeze never sends the still-soaked enemy sliding', () => {
    const { stuns, slides } = inPuddles([at('snowcone', 3)], 90); // puddles at 0.4, 2.0 and 3.6 s
    expect(stuns).toHaveLength(3);
    expect(slides).toBe(0);
  });

  it("a ★3 machine touching a ★3 Mop freezes on its own puddles only, not on the Mop's", () => {
    expect(inPuddles([at('mop', 3), at('snowcone', 3)], 20).stuns).toHaveLength(1);
  });
});
