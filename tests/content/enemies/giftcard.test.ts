import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'giftcard', behavior: 'thief', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0, hp: 30, speed: 120, contactDamage: 1, coins: 2, radius: 16, scale: 0.74, tune: { escapeAfter: 8, coinMult: 8 }, name: 'Gift Card', blurb: 'Runs from you and escapes after 8 seconds. Catch it for a jackpot of coins.' };

describe('Gift Card (giftcard)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.giftcard).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('giftcard')).toEqual({ name: 'Gift Card', blurb: 'Runs from you and escapes after 8 seconds. Catch it for a jackpot of coins.' });
    setLang('de');
    expect(enemyT('giftcard')).toEqual({ name: 'Geschenkkarte', blurb: 'Rennt vor dir weg und entwischt nach 8 Sekunden. Schnapp sie dir für einen Münz-Jackpot.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('giftcard')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows no health bar (it only does for elites)', () => {
    expect(contentEnemy('giftcard')!.hpBar ?? false).toBe(false);
  });
});
