import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { healTargets } from '../../../src/systems/combat';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'honey', behavior: 'healer', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 220, arcDeg: 0, knockbackResist: 0, hp: 35, speed: 56, contactDamage: 3, coins: 3, radius: 18, scale: 0.76, tune: { interval: 1, radius: 160, pct: 0.03, keepAway: 220 }, name: 'Honey Jar', blurb: 'Hangs back and heals nearby groceries 3% every second. Sticky business; pop it first.' };

describe('Honey Jar (honey)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.honey).toEqual({ ...OLD, weak: { frost: 0.3 }, resist: { poison: 0.3 } });
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('honey')).toEqual({ name: 'Honey Jar', blurb: 'Hangs back and heals nearby groceries 3% every second. Sticky business; pop it first.' });
    setLang('de');
    expect(enemyT('honey')).toEqual({ name: 'Honigglas', blurb: 'Hält sich hinten und heilt Gegner in der Nähe jede Sekunde um 3%. Klebrig; zuerst platzieren.' });
  });

  it('has its element affinity (weak and resist magnitudes)', () => {
    const c = contentEnemy('honey')!;
    expect(c.weak).toEqual({ frost: 0.3 });
    expect(c.resist).toEqual({ poison: 0.3 });
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('honey')!.hpBar ?? false).toBe(true);
  });

  it('heals allies within radius for pct of their max HP, by default', () => {
    const jar = { x: 0, y: 0, hp: 35, maxHp: 35, alive: true, def: { id: 'honey' } };
    const near = { x: 150, y: 0, hp: 10, maxHp: 100, alive: true, def: { id: 'milk' } };
    const far = { x: 170, y: 0, hp: 10, maxHp: 100, alive: true, def: { id: 'milk' } };
    const hits = healTargets(jar, [jar, near, far]);
    expect(hits).toHaveLength(1);
    expect(hits[0].amount).toBeCloseTo(3);
  });
});
