import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES, BOSS_BY_THEME, BOSS_KITS, BOSS_SPECIAL } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'boss_checkout', behavior: 'boss', tell: 0.8, attackCooldown: 2.3, attackRange: 0, attackDamage: 9, projectileSpeed: 195, projectileLife: 5, lungeSpeed: 560, lungeTime: 0.7, preferredDistance: 0, arcDeg: 0, knockbackResist: 1, hp: 1550, speed: 50, contactDamage: 14, coins: 30, radius: 46, scale: 0.95, tune: { speed: 170, time: 2.4 }, name: 'The Self-Checkout Kiosk', blurb: 'Runs the conveyor against you, then charges. Bags in gum and gift cards.' };

describe('The Self-Checkout Kiosk (boss_checkout)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.boss_checkout).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('boss_checkout')).toEqual({ name: 'The Self-Checkout Kiosk', blurb: 'Runs the conveyor against you, then charges. Bags in gum and gift cards.' });
    setLang('de');
    expect(enemyT('boss_checkout')).toEqual({ name: 'Die Selbstbedienungskasse', blurb: 'Lässt das Fließband gegen dich laufen und rammt dich dann. Holt Kaugummis und Geschenkkarten dazu.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('boss_checkout')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows no health bar (it only does for elites)', () => {
    expect(contentEnemy('boss_checkout')!.hpBar ?? false).toBe(false);
  });

  it('keeps its kit, cycle and special tuning', () => {
    expect(BOSS_KITS.boss_checkout).toEqual({ cycle: ['special', 'charge', 'volley', 'summon', 'charge', 'special'], shot: 'proj_receipt', special: 'belt', moves: { volleyCount: 7, volleySpreadDeg: 70, summonCount: 4, summonTypes: ['gum', 'giftcard'] } });
    expect(BOSS_SPECIAL.belt).toEqual({ speed: 170, time: 2.4 });
    expect(BOSS_BY_THEME.checkout).toBe('boss_checkout');
  });
});
