import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'slice', behavior: 'chase', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0, hp: 5, speed: 95, contactDamage: 3, coins: 0, radius: 14, scale: 0.5, tune: {  }, name: 'Melon Slice', blurb: 'A juicy little leftover. Fast, fragile, worth no coins.' };

describe('Melon Slice (slice)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.slice).toEqual(OLD);
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('slice')).toEqual({ name: 'Melon Slice', blurb: 'A juicy little leftover. Fast, fragile, worth no coins.' });
    setLang('de');
    expect(enemyT('slice')).toEqual({ name: 'Melonenscheibe', blurb: 'Ein saftiger kleiner Rest. Flink, zerbrechlich, keine Münzen wert.' });
  });

  it('has no affinity yet', () => {
    const c = contentEnemy('slice')!;
    expect(c.weak).toBeUndefined();
    expect(c.resist).toBeUndefined();
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('slice')!.hpBar ?? false).toBe(true);
  });
});
