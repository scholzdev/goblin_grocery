import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'milk', behavior: 'chase', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0, hp: 14, speed: 72, contactDamage: 4, coins: 1, radius: 17, scale: 0.78, tune: {  }, name: 'Sour Milk', blurb: 'Past its date and furious about it. Just walks at you. Repeatedly.' };

describe('Sour Milk (milk)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.milk).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('milk')).toEqual({ name: 'Sour Milk', blurb: 'Past its date and furious about it. Just walks at you. Repeatedly.' });
    setLang('de');
    expect(enemyT('milk')).toEqual({ name: 'Saure Milch', blurb: 'Über dem Datum und stinksauer darüber. Läuft einfach auf dich zu. Immer wieder.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('milk')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('milk')!.hpBar ?? false).toBe(true);
  });
});
