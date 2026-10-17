import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import { setLevels, setsOf } from '../../../src/data/sets';
import { SET_ORDER } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { at, far, full } from '../helpers';

// Phase 5 moved every set into src/content/sets/<id>.ts. These tests pin that nothing set-specific is left behind in the engine,
// the scenes or the systems, and that the counting rules are data-driven.
const sources = import.meta.glob(['../../../src/**/*.ts', '!../../../src/content/**', '!../../../src/i18n/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const file = (rel: string): string => sources[`../../../src/${rel}`];

describe('no set tuning or set branches outside the content files', () => {
  it('the legacy tables and accessors are gone', () => {
    const bad = Object.entries(sources).filter(([, src]) => /\bSET_L3\b|\bsetCfg\b|\bSETS\b/.test(src)).map(([f]) => f);
    expect(bad).toEqual([]);
  });

  it('computeBuild, the scenes and the engine modules do not read set levels by name any more (except the Checkout interest in run.ts)', () => {
    const byName = /\bsets\.(kitchen|cleaning|tools|snacks|checkout|heat|frost|blast|electric)\b/;
    const hits = Object.entries(sources).filter(([f, src]) => !f.includes('/data/sets.ts') && byName.test(src)).map(([f]) => f.replace('../../../src/', ''));
    // run.ts pays the Checkout interest (the one by-name reader left: there is no run-lifecycle hook).
    expect(hits.sort()).toEqual(['state/run.ts']);
  });

  it('the arena applies the knockback multiplier the Cleaning hook left on the hit, and nothing reads build.shoveStun or build.regen of a set', () => {
    expect(file('scenes/ArenaScene.ts')).toContain('* hit.kbMult');
    expect(file('scenes/ArenaScene.ts')).not.toMatch(/shoveStun/);
    expect(file('systems/synergies.ts')).not.toMatch(/setCfg|sets\.(tools|snacks|checkout)/);
  });
});

describe('set counting is data-driven', () => {
  it('Jelly Beans take their element from the instance because their content says `flavored`', () => {
    expect(contentItem('jellybeans')?.flavored).toBe(true);
    expect(ITEMS.jellybeans.flavored).toBe(true);
    expect(file('data/sets.ts')).not.toContain('jellybeans');
    expect(setsOf('jellybeans', 'frost')).toEqual(['snacks', 'frost']);
    expect(setsOf('jellybeans')).toEqual(['snacks']);
    // No other item is flavored: everything else has a static element or none.
    expect(Object.values(ITEMS).filter((d) => d.flavored).map((d) => d.id)).toEqual(['jellybeans']);
  });

  it('levels and Build.sets list the sets in SET_ORDER (the order the shop and the goldens use)', () => {
    expect(SET_ORDER).toEqual(['kitchen', 'cleaning', 'tools', 'snacks', 'checkout', 'heat', 'frost', 'blast', 'electric']);
    expect(Object.keys(setLevels([]))).toEqual([...SET_ORDER]);
    expect(Object.keys(full([at('pan'), far('sample')]).sets)).toEqual([...SET_ORDER]);
  });
});
