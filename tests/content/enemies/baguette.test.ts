import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'baguette', behavior: 'swiper', tell: 0.55, attackCooldown: 2.2, attackRange: 92, attackDamage: 7, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 110, knockbackResist: 0.3, hp: 34, speed: 68, contactDamage: 5, coins: 2, radius: 19, scale: 0.8, tune: {  }, name: 'Baguette Bruiser', blurb: 'Swings a wide crusty arc when you get close. Back off or break it.' };

describe('Baguette Bruiser (baguette)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.baguette).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('baguette')).toEqual({ name: 'Baguette Bruiser', blurb: 'Swings a wide crusty arc when you get close. Back off or break it.' });
    setLang('de');
    expect(enemyT('baguette')).toEqual({ name: 'Baguette-Rabauke', blurb: 'Schwingt einen breiten, knusprigen Bogen, wenn du zu nah kommst. Geh weg oder brich ihn.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('baguette')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('baguette')!.hpBar ?? false).toBe(true);
  });
});
