import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'soda', behavior: 'tank', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0.8, hp: 48, speed: 46, contactDamage: 6, coins: 2, radius: 25, scale: 0.72, tune: {  }, name: 'Soda Six-Pack', blurb: 'Six cans, one grudge. Slow and fizzy-tough; barely flinches at dashes.' };

describe('Soda Six-Pack (soda)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.soda).toEqual({ ...OLD, weak: { electric: 0.3 } });
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('soda')).toEqual({ name: 'Soda Six-Pack', blurb: 'Six cans, one grudge. Slow and fizzy-tough; barely flinches at dashes.' });
    setLang('de');
    expect(enemyT('soda')).toEqual({ name: 'Limo-Sixpack', blurb: 'Sechs Dosen, ein Groll. Langsam und sprudelzäh; zuckt kaum bei Dashes.' });
  });

  it('has its element affinity (weak and resist magnitudes)', () => {
    const c = contentEnemy('soda')!;
    expect(c.weak).toEqual({ electric: 0.3 });
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('soda')!.hpBar ?? false).toBe(true);
  });
});
