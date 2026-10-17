import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES, BOSS_BY_THEME, BOSS_KITS } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'boss', behavior: 'boss', tell: 0.8, attackCooldown: 2.4, attackRange: 0, attackDamage: 9, projectileSpeed: 200, projectileLife: 5, lungeSpeed: 520, lungeTime: 0.7, preferredDistance: 0, arcDeg: 0, knockbackResist: 1, hp: 1500, speed: 55, contactDamage: 14, coins: 30, radius: 48, scale: 0.95, tune: {  }, name: 'The Store Manager', blurb: 'Volleys, charges and summons. Gets cranky if you take too long.' };

describe('The Store Manager (boss)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.boss).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('boss')).toEqual({ name: 'The Store Manager', blurb: 'Volleys, charges and summons. Gets cranky if you take too long.' });
    setLang('de');
    expect(enemyT('boss')).toEqual({ name: 'Der Filialleiter', blurb: 'Salven, Ansturm und Verstärkung. Wird ungemütlich, wenn du zu lange brauchst.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('boss')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows no health bar (it only does for elites)', () => {
    expect(contentEnemy('boss')!.hpBar ?? false).toBe(false);
  });

  it('keeps its kit, cycle and special tuning', () => {
    expect(BOSS_KITS.boss).toEqual({ cycle: ['volley', 'charge', 'summon', 'charge', 'volley', 'summon'], shot: 'proj_receipt', moves: {  } });
    expect(BOSS_BY_THEME.main).toBe('boss');
  });
});
