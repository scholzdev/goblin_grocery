import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { armorDamage } from '../../../src/systems/combat';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'beans', behavior: 'chase', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0.4, hp: 40, speed: 52, contactDamage: 5, coins: 2, radius: 20, armor: 3, scale: 0.78, tune: { minShare: 0.3 }, name: 'Canned Beans', blurb: 'Dented, dense and armored: direct hits lose 3 damage. Burn, puddles and auras ignore the tin.' };

describe('Canned Beans (beans)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.beans).toEqual({ ...OLD, weak: { electric: 0.3 } });
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('beans')).toEqual({ name: 'Canned Beans', blurb: 'Dented, dense and armored: direct hits lose 3 damage. Burn, puddles and auras ignore the tin.' });
    setLang('de');
    expect(enemyT('beans')).toEqual({ name: 'Dosenbohnen', blurb: 'Verbeult, dicht und gepanzert: direkte Treffer verlieren 3 Schaden. Brand, Pfützen und Auren ignorieren die Dose.' });
  });

  it('has its element affinity (weak and resist magnitudes)', () => {
    const c = contentEnemy('beans')!;
    expect(c.weak).toEqual({ electric: 0.3 });
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('beans')!.hpBar ?? false).toBe(true);
  });

  it('armor soaks flat damage but never more than 70% of a hit (minShare)', () => {
    expect(armorDamage(10, 3)).toBe(7);
    expect(armorDamage(4, 3)).toBe(2); // ceil(4 x 0.3)
    expect(armorDamage(10, 0)).toBe(10);
  });
});
