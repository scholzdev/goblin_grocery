import { describe, expect, it, vi } from 'vitest';

// ui/ui.ts and the modules it loads read `location`, `window` and `matchMedia`, and vitest runs in node.
vi.hoisted(() => { Object.assign(globalThis, { location: { search: '' }, window: globalThis, matchMedia: () => ({ matches: true }) }); });

import { endHtml } from '../src/ui/ui';
import { createRun } from '../src/state/run';
import { store } from '../src/state/store';
import { flow } from '../src/flow';
import { computeBuild } from '../src/systems/synergies';
import { recordHit } from '../src/systems/damageStats';
import type { RunState } from '../src/types';
import { build } from './golden/carts';

// The run-end receipt can outgrow the screen (many unlocks, a long damage recap), so only its body may scroll:
// the score and every button sit in the foot below it, where they stay on screen.

const run = (phase: RunState['phase'], lab = false): void => {
  const s = createRun(1);
  s.inventory = build([{ type: 'toaster' }, { type: 'pan' }]);
  s.build = computeBuild(s.inventory);
  s.phase = phase;
  s.lab = lab;
  s.stats.damageByWeapon = { [s.inventory.placed[0].uid]: 300 };
  s.stats.damage.byType.heat = 300;
  recordHit(s.stats, { how: 'contact', by: 'milk' }, 26);
  store.state = s;
  flow.lastResult = { score: 5830, newBest: true, shown: true, fresh: { unlocks: [], recipes: [], enemies: phase === 'victory' ? ['milk'] : [] }, near: [], loyalty: { before: 2, gained: 1, card: false } };
};
const parts = (html: string) => {
  const body = html.indexOf('class="endbody"'), foot = html.indexOf('class="endfoot"');
  expect(body, 'the receipt has a body').toBeGreaterThan(-1);
  expect(foot, 'the foot follows the body').toBeGreaterThan(body);
  return { body: html.slice(body, foot), foot: html.slice(foot) };
};
const acts = (html: string) => [...html.matchAll(/data-act="([^"]+)"/g)].map((m) => m[1]);

describe('the run-end receipt', () => {
  it.each([
    ['victory', false, ['overtime', 'again', 'end-catalog', 'quit']],
    ['defeat', false, ['again', 'end-catalog', 'quit']],
    ['defeat', true, ['lab-back', 'quit']],
  ] as const)('%s (lab %s) keeps the score and every button out of the scrolling body', (phase, lab, buttons) => {
    run(phase, lab);
    const { body, foot } = parts(endHtml());
    expect(acts(body), 'no button scrolls away with the body').toEqual([]);
    expect(acts(foot)).toEqual(buttons);
    expect(foot).toContain('5830 pts');
  });

  it('a defeat leads the side column with the hit that ended the run, a win with the unlocks', () => {
    run('defeat');
    const lost = parts(endHtml()).body;
    expect(lost.indexOf('Wiped out by'), 'the killing hit is in the side column').toBeGreaterThan(lost.indexOf('class="endr"'));
    expect(lost.indexOf('class="endr"')).toBeGreaterThan(-1);
    run('victory');
    const won = parts(endHtml()).body;
    const side = won.slice(won.indexOf('class="endr"'));
    expect(side.indexOf('Newly unlocked'), 'the unlocks open the side column').toBeGreaterThan(-1);
    expect(side.indexOf('Newly unlocked')).toBeLessThan(side.indexOf('Damage taken'));
  });
});
