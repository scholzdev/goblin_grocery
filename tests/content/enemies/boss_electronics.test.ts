import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES, BOSS_BY_THEME, BOSS_KITS, BOSS_SPECIAL } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'boss_electronics', behavior: 'boss', tell: 0.8, attackCooldown: 2.3, attackRange: 0, attackDamage: 9, projectileSpeed: 240, projectileLife: 4, lungeSpeed: 500, lungeTime: 0.7, preferredDistance: 0, arcDeg: 0, knockbackResist: 1, hp: 1500, speed: 34, contactDamage: 12, coins: 30, radius: 50, scale: 0.95, tune: { count: 3, gap: 170, width: 76 }, name: 'The Smart-TV Wall', blurb: 'Zaps lanes of live cable across the floor, fires wide fast fans and boots up spitters.' };

describe('The Smart-TV Wall (boss_electronics)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.boss_electronics).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('boss_electronics')).toEqual({ name: 'The Smart-TV Wall', blurb: 'Zaps lanes of live cable across the floor, fires wide fast fans and boots up spitters.' });
    setLang('de');
    expect(enemyT('boss_electronics')).toEqual({ name: 'Die Smart-TV-Wand', blurb: 'Zappt Bahnen aus Starkstromkabeln über den Boden, feuert breite schnelle Fächer und startet Spucker.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('boss_electronics')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows no health bar (it only does for elites)', () => {
    expect(contentEnemy('boss_electronics')!.hpBar ?? false).toBe(false);
  });

  it('keeps its kit, cycle and special tuning', () => {
    expect(BOSS_KITS.boss_electronics).toEqual({ cycle: ['special', 'volley', 'summon', 'special', 'charge', 'volley'], shot: 'proj_cap', special: 'lanes', moves: { volleyCount: 9, volleySpreadDeg: 100, summonCount: 3, summonTypes: ['spitter', 'beans'] } });
    expect(BOSS_SPECIAL.lanes).toEqual({ count: 3, gap: 170, width: 76 });
    expect(BOSS_BY_THEME.electronics).toBe('boss_electronics');
  });
});
