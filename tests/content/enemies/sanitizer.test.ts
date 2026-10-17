import { afterEach, describe, expect, it } from 'vitest';
import { ENEMIES } from '../../../src/data/enemies';
import { contentEnemy } from '../../../src/engine/registry';
import { enemyT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { affinityRowsHtml } from '../../../src/ui/affinity';

afterEach(() => setLang('en'));

describe('Hand Sanitizer (sanitizer)', () => {
  it('has the stats, sprite scale and tune of its file', () => {
    expect(ENEMIES.sanitizer).toMatchObject({ id: 'sanitizer', behavior: 'chase', scale: 0.82, hp: 60, speed: 44, contactDamage: 4, coins: 3, radius: 22, tune: { cleanseRadius: 120, cleanseInterval: 1 }, weak: { blast: 0.3 }, resist: { poison: 0.3 } });
  });

  it('is a slow walker, slower than the average of the regular groceries, with modest contact damage', () => {
    const regular = Object.values(ENEMIES).filter((d) => d.behavior !== 'boss' && d.id !== 'sanitizer');
    const avg = regular.reduce((a, d) => a + d.speed, 0) / regular.length;
    expect(ENEMIES.sanitizer.speed).toBeLessThan(avg);
    expect(ENEMIES.sanitizer.contactDamage).toBeLessThanOrEqual(5);
  });

  it('is weak to blast and resists poison; shows a health bar', () => {
    const c = contentEnemy('sanitizer')!;
    expect(c.weak).toEqual({ blast: 0.3 });
    expect(c.resist).toEqual({ poison: 0.3 });
    expect(c.hpBar ?? false).toBe(true);
  });

  it('its codex card shows the weak and resist chips', () => {
    const html = affinityRowsHtml('sanitizer');
    expect(html).toContain('blast');
    expect(html).toContain('poison');
  });

  it('shows its name and blurb in English and German', () => {
    expect(enemyT('sanitizer').name).toBe('Hand Sanitizer');
    expect(enemyT('sanitizer').blurb).toContain('burn, poison, shred, wet and weaken');
    setLang('de');
    expect(enemyT('sanitizer').name).toBe('Desinfektionsmittel');
    expect(enemyT('sanitizer').blurb).toContain('Brand, Gift, Aufreißen, Nässe und Schwächung');
  });
});
