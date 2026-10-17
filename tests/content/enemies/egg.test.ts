import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'egg', behavior: 'exploder', tell: 0.7, attackCooldown: 0, attackRange: 70, attackDamage: 8, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0, hp: 30, speed: 60, contactDamage: 3, coins: 2, radius: 20, scale: 0.78, tune: { radius: 90, enemyDamage: 12 }, name: 'Egg Carton', blurb: 'Waddles close and explodes. Pop it first.' };

describe('Egg Carton (egg)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.egg).toEqual({ ...OLD, weak: { blast: 0.3 } });
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('egg')).toEqual({ name: 'Egg Carton', blurb: 'Waddles close and explodes. Pop it first.' });
    setLang('de');
    expect(enemyT('egg')).toEqual({ name: 'Eierkarton', blurb: 'Watschelt heran und explodiert. Platz ihn zuerst.' });
  });

  it('has its element affinity (weak and resist magnitudes)', () => {
    const c = contentEnemy('egg')!;
    expect(c.weak).toEqual({ blast: 0.3 });
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('egg')!.hpBar ?? false).toBe(true);
  });
});
