import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'turkey', behavior: 'tank', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0.92, hp: 150, speed: 38, contactDamage: 9, coins: 4, radius: 34, scale: 0.8, tune: {  }, name: 'Frozen Turkey', blurb: 'Frozen solid, heavy as a brick. Takes forever to thaw out.' };

describe('Frozen Turkey (turkey)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.turkey).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('turkey')).toEqual({ name: 'Frozen Turkey', blurb: 'Frozen solid, heavy as a brick. Takes forever to thaw out.' });
    setLang('de');
    expect(enemyT('turkey')).toEqual({ name: 'Gefrorener Truthahn', blurb: 'Steinhart gefroren, schwer wie ein Ziegel. Braucht ewig zum Auftauen.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('turkey')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('turkey')!.hpBar ?? false).toBe(true);
  });
});
