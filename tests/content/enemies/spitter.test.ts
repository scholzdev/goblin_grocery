import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'spitter', behavior: 'spitter', tell: 0.45, attackCooldown: 2.6, attackRange: 420, attackDamage: 5, projectileSpeed: 125, projectileLife: 4, lungeSpeed: 0, lungeTime: 0, preferredDistance: 270, arcDeg: 0, knockbackResist: 0, hp: 18, speed: 64, contactDamage: 4, coins: 2, radius: 18, scale: 0.78, tune: { shots: 3, spreadDeg: 22 }, name: 'Detergent Spitter', blurb: 'Squirts slow blobs of detergent from afar. Close in or weave.' };

describe('Detergent Spitter (spitter)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.spitter).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('spitter')).toEqual({ name: 'Detergent Spitter', blurb: 'Squirts slow blobs of detergent from afar. Close in or weave.' });
    setLang('de');
    expect(enemyT('spitter')).toEqual({ name: 'Spülmittel-Spucker', blurb: 'Spritzt aus der Ferne langsame Spülmittelblasen. Geh ran oder weich aus.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('spitter')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('spitter')!.hpBar ?? false).toBe(true);
  });
});
