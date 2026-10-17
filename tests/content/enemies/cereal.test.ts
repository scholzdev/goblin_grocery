import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { shieldBlocks } from '../../../src/systems/combat';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'cereal', behavior: 'chase', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0.3, hp: 45, speed: 58, contactDamage: 5, coins: 3, radius: 23, shield: true, scale: 0.82, tune: { halfAngleDeg: 60, blocks: 6, eliteMult: 2 }, name: 'Cereal Box', blurb: 'Holds a cardboard front up: the first 6 shots bounce off, then it goes soggy. Sweeps, blasts, burn and dashes ignore it.' };

describe('Cereal Box (cereal)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.cereal).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('cereal')).toEqual({ name: 'Cereal Box', blurb: 'Holds a cardboard front up: the first 6 shots bounce off, then it goes soggy. Sweeps, blasts, burn and dashes ignore it.' });
    setLang('de');
    expect(enemyT('cereal')).toEqual({ name: 'Müslipackung', blurb: 'Hält eine Pappfront hoch: Die ersten 6 Schüsse prallen ab, dann weicht sie durch. Schwünge, Explosionen, Brand und Dashes ignorieren sie.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('cereal')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('cereal')!.hpBar ?? false).toBe(true);
  });

  it('blocks a shot flying straight at its face, within 60 degrees (halfAngleDeg), by default', () => {
    expect(shieldBlocks(-100, 0, 1, 0)).toBe(true); // coming from the face side
    expect(shieldBlocks(-100, 100 * Math.tan(0.9), 1, 0)).toBe(true); // ~52 degrees off
    expect(shieldBlocks(-100, 100 * Math.tan(1.2), 1, 0)).toBe(false); // ~69 degrees off
    expect(shieldBlocks(100, 0, 1, 0)).toBe(false); // from behind
  });
});
