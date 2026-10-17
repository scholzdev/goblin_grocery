import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';

afterEach(() => setLang('en'));

// The numbers and texts below are the pre-refactor values (src/data/enemies.ts, the constants of data/enemies.ts and scenes/enemies.ts, the German table of i18n/data-de.ts at b2eb850), hardcoded on purpose: moving the enemy into a content file changed none of them.
const OLD = { id: 'gum', behavior: 'chase', tell: 0, attackCooldown: 0, attackRange: 0, attackDamage: 0, projectileSpeed: 0, projectileLife: 0, lungeSpeed: 0, lungeTime: 0, preferredDistance: 0, arcDeg: 0, knockbackResist: 0, hp: 26, speed: 70, contactDamage: 4, coins: 2, radius: 17, trail: true, scale: 0.76, tune: { interval: 1.5, maxPerGum: 6, life: 6, radius: 34, slow: 0.3, trapRadiusMult: 1.6 }, name: 'Bubble Gum', blurb: 'Chews after you, leaving sticky pink puddles that slow your walk. Bursts into a trap when popped.' };

describe('Bubble Gum (gum)', () => {
  it('has the stats, sprite scale and tune it had as a table row', () => {
    expect(ENEMIES.gum).toEqual({ ...OLD, weak: { frost: 0.3 }, resist: { heat: 0.3 } });
  });

  it('shows its name and blurb unchanged in English and German', () => {
    expect(enemyT('gum')).toEqual({ name: 'Bubble Gum', blurb: 'Chews after you, leaving sticky pink puddles that slow your walk. Bursts into a trap when popped.' });
    setLang('de');
    expect(enemyT('gum')).toEqual({ name: 'Kaugummi', blurb: 'Kaut hinter dir her und hinterlässt klebrige rosa Pfützen, die dich verlangsamen. Platzt zur Falle.' });
  });

  it('has its element affinity (weak and resist magnitudes)', () => {
    const c = contentEnemy('gum')!;
    expect(c.weak).toEqual({ frost: 0.3 });
    expect(c.resist).toEqual({ heat: 0.3 });
  });

  it('shows a health bar once damaged', () => {
    expect(contentEnemy('gum')!.hpBar ?? false).toBe(true);
  });
});
