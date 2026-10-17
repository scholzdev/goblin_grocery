import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES, BOSS_BY_THEME, BOSS_KITS, BOSS_SPECIAL } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'boss_frozen', behavior: 'boss', tell: 0.9, attackCooldown: 2.7, attackRange: 0, attackDamage: 9, projectileSpeed: 170, projectileLife: 5.5, lungeSpeed: 440, lungeTime: 0.9, preferredDistance: 0, arcDeg: 0, knockbackResist: 1, hp: 1700, speed: 40, contactDamage: 14, coins: 30, radius: 52, scale: 1, tune: { spots: 3, radius: 62, scatter: 140, life: 7, rMult: 1.8 }, name: 'The Walk-In Freezer', blurb: 'Slow, huge and cold. Its cold snaps freeze the floor into slowing slush, and its charge slides on.' };

describe('The Walk-In Freezer (boss_frozen)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.boss_frozen).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('boss_frozen')).toEqual({ name: 'The Walk-In Freezer', blurb: 'Slow, huge and cold. Its cold snaps freeze the floor into slowing slush, and its charge slides on.' });
    setLang('de');
    expect(enemyT('boss_frozen')).toEqual({ name: 'Der Kühlraum', blurb: 'Langsam, riesig und eiskalt. Seine Kälteeinbrüche machen den Boden zu bremsendem Matsch, und sein Ansturm rutscht weiter.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('boss_frozen')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows no health bar (it only does for elites)', () => {
    expect(contentEnemy('boss_frozen')!.hpBar ?? false).toBe(false);
  });

  it('keeps its kit, cycle and special tuning', () => {
    expect(BOSS_KITS.boss_frozen).toEqual({ cycle: ['special', 'volley', 'charge', 'summon', 'special', 'charge'], shot: 'proj_bubble', special: 'slush', moves: { volleyCount: 6, volleySpreadDeg: 80, summonCount: 3, summonTypes: ['expired', 'milk'] } });
    expect(BOSS_SPECIAL.slush).toEqual({ spots: 3, radius: 62, scatter: 140, life: 7, rMult: 1.8 });
    expect(BOSS_BY_THEME.frozen).toBe('boss_frozen');
  });
});
