import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'expired', behavior: 'teleporter', tell: 0.6, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0, hp: 28, speed: 66, contactDamage: 6, coins: 2, radius: 17, scale: 0.78, tune: { interval: 4, tell: 0.6, ringDist: 110, clearance: 60 }, name: 'Expired Milk', blurb: 'Flickers, then blinks right next to you. Watch for the dashed ring.' };

describe('Expired Milk (expired)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.expired).toEqual({ ...OLD, weak: { cleaning: 0.3 }, resist: { poison: 0.3 } });
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('expired')).toEqual({ name: 'Expired Milk', blurb: 'Flickers, then blinks right next to you. Watch for the dashed ring.' });
    setLang('de');
    expect(enemyT('expired')).toEqual({ name: 'Abgelaufene Milch', blurb: 'Flackert und blinkt dann direkt neben dich. Achte auf den gestrichelten Ring.' });
  });

  it('has its element affinity (weak and resist magnitudes)', () => {
    const c = contentEnemy('expired')!;
    expect(c.weak).toEqual({ cleaning: 0.3 });
    expect(c.resist).toEqual({ poison: 0.3 });
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('expired')!.hpBar ?? false).toBe(true);
  });
});
