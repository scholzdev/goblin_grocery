import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'banana', behavior: 'charger', tell: 0.6, attackCooldown: 2.6, attackRange: 260, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 430, lungeTime: 0.38, preferredDistance: 0, arcDeg: 0, knockbackResist: 0, hp: 12, speed: 80, contactDamage: 5, coins: 1, radius: 16, scale: 0.8, tune: {  }, name: 'Banana Bandit', blurb: 'Winds up, then slides in for a peel-out lunge. Sidestep it.' };

describe('Banana Bandit (banana)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.banana).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('banana')).toEqual({ name: 'Banana Bandit', blurb: 'Winds up, then slides in for a peel-out lunge. Sidestep it.' });
    setLang('de');
    expect(enemyT('banana')).toEqual({ name: 'Bananen-Bandit', blurb: 'Holt aus und rutscht dann zum Schlitterangriff heran. Weich aus.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('banana')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('banana')!.hpBar ?? false).toBe(true);
  });
});
