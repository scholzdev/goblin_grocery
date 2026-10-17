import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES, BOSS_BY_THEME, BOSS_KITS, BOSS_SPECIAL } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'boss_bakery', behavior: 'boss', tell: 0.75, attackCooldown: 2.2, attackRange: 0, attackDamage: 8, projectileSpeed: 215, projectileLife: 4.5, lungeSpeed: 540, lungeTime: 0.65, preferredDistance: 0, arcDeg: 0, knockbackResist: 1, hp: 1450, speed: 58, contactDamage: 14, coins: 30, radius: 46, scale: 0.95, tune: { shots: 14, speed: 150, life: 6, halfExtra: 4 }, name: 'The Industrial Oven', blurb: 'Tight fans of hot toast, ring bursts of fire and a steady supply of baguettes.' };

describe('The Industrial Oven (boss_bakery)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.boss_bakery).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('boss_bakery')).toEqual({ name: 'The Industrial Oven', blurb: 'Tight fans of hot toast, ring bursts of fire and a steady supply of baguettes.' });
    setLang('de');
    expect(enemyT('boss_bakery')).toEqual({ name: 'Der Industrieofen', blurb: 'Enge Toast-Fächer, Feuerringe und ein stetiger Nachschub an Baguettes.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('boss_bakery')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows no health bar (it only does for elites)', () => {
    expect(contentEnemy('boss_bakery')!.hpBar ?? false).toBe(false);
  });

  it('keeps its kit, cycle and special tuning', () => {
    expect(BOSS_KITS.boss_bakery).toEqual({ cycle: ['volley', 'special', 'summon', 'charge', 'special', 'volley'], shot: 'proj_toast', special: 'ring', moves: { volleyCount: 5, volleySpreadDeg: 50, summonCount: 4, summonTypes: ['baguette', 'banana'] } });
    expect(BOSS_SPECIAL.ring).toEqual({ shots: 14, speed: 150, life: 6, halfExtra: 4 });
    expect(BOSS_BY_THEME.bakery).toBe('boss_bakery');
  });
});
