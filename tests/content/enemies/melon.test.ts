import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'melon', behavior: 'splitter', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0.5, hp: 60, speed: 50, contactDamage: 6, coins: 3, radius: 30, scale: 0.9, tune: { slices: 3 }, name: 'Watermelon', blurb: 'Bursts into three fast slices when it dies. Mind the mess.' };

describe('Watermelon (melon)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.melon).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('melon')).toEqual({ name: 'Watermelon', blurb: 'Bursts into three fast slices when it dies. Mind the mess.' });
    setLang('de');
    expect(enemyT('melon')).toEqual({ name: 'Wassermelone', blurb: 'Platzt beim Tod in drei flinke Scheiben. Vorsicht, Matsch.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('melon')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('melon')!.hpBar ?? false).toBe(true);
  });
});
