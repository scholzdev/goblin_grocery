import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { AFFINITY_TAGS, type AffinityTag } from '../src/engine/define';
import { DAMAGE_TYPES, ELEMENT_COLORS, brighten, colorNum, damageType, numberStyle, type DamageType } from '../src/engine/damageType';
import { FakeCtx } from '../src/engine/fakeCtx';
import { Enemy, Item, Tag } from '../src/engine/ids';
import { MARK_MULT } from '../src/engine/marks';
import { hitTags } from '../src/engine/hitTags';
import { armorDamage } from '../src/systems/combat';
import { newDamageStats, recordDamage, totalDamage, type DamageSink } from '../src/systems/damageStats';
import { UI } from '../src/i18n/ui';
import { setLang } from '../src/i18n/lang';
import { affinityRowsHtml } from '../src/ui/affinity';
import { damageBreakdownHtml } from '../src/ui/damageBreakdown';
import type { WeaponStats } from '../src/types';

// Damage colors and the run-end damage breakdown (docs/item-hooks-refactor.md "Damage colors" / "Damage breakdown"): UI feedback only, so most of these
// pin the pure pieces (palette, display type, number style, accumulator) and that the FakeCtx records exactly what the pipeline dealt.

const def = (weak?: Partial<Record<AffinityTag, number>>, resist?: Partial<Record<AffinityTag, number>>) => ({ weak, resist });
const stats = (type: WeaponStats['type']) => ({ type }) as WeaponStats;
const rgb = (hex: string) => [(colorNum(hex) >> 16) & 255, (colorNum(hex) >> 8) & 255, colorNum(hex) & 255];

describe('ELEMENT_COLORS', () => {
  it('has an entry for every affinity tag and every damage type, as #RRGGBB', () => {
    for (const tag of AFFINITY_TAGS) expect(ELEMENT_COLORS[tag], tag).toMatch(/^#[0-9A-F]{6}$/);
    for (const ty of DAMAGE_TYPES) expect(ELEMENT_COLORS[ty], ty).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('every type has its own color, and cleaning is clearly apart from frost', () => {
    const all = Object.values(ELEMENT_COLORS);
    expect(new Set(all).size).toBe(all.length);
    const [a, b] = [rgb(ELEMENT_COLORS.cleaning), rgb(ELEMENT_COLORS.frost)];
    expect(ELEMENT_COLORS.cleaning).not.toBe(ELEMENT_COLORS.frost);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(80);
  });

  it('physical is white, and brighten moves a color toward white', () => {
    expect(ELEMENT_COLORS.physical).toBe('#FFFFFF');
    expect(brighten('#000000', 0.5)).toBe('#808080');
    expect(brighten(ELEMENT_COLORS.heat, 0)).toBe(ELEMENT_COLORS.heat);
    expect(brighten(ELEMENT_COLORS.heat, 1)).toBe('#FFFFFF');
  });

  it('the codex chips use the palette (one source), for the elements and poison', () => {
    const html = affinityRowsHtml(Enemy.turkey) + affinityRowsHtml(Enemy.milk);
    for (const tag of [Tag.heat, Tag.frost, Tag.blast]) expect(html).toContain(`--ec:${ELEMENT_COLORS[tag]}`);
    expect(affinityRowsHtml(Enemy.expired)).toContain(`--ec:${ELEMENT_COLORS.poison}`);
    expect(affinityRowsHtml(Enemy.expired)).toContain(`--ec:${ELEMENT_COLORS.cleaning}`);
  });
});

describe('damageType: the display type of a hit', () => {
  // [name, tags, enemy def, opts, expected]
  const table: [string, AffinityTag[], ReturnType<typeof def>, Parameters<typeof damageType>[2], DamageType][] = [
    ['no tag is physical', [], def(), {}, 'physical'],
    ['no tag, even against a weak enemy', [], def({ heat: 0.3 }), {}, 'physical'],
    ['the first weapon tag', ['frost', 'heat'], def(), {}, 'frost'],
    ['a tag the enemy is weak to beats the first tag', ['frost', 'heat'], def({ heat: 0.3 }), {}, 'heat'],
    ['the stronger of two weak tags', ['heat', 'blast'], def({ heat: 0.3, blast: 0.4 }), {}, 'blast'],
    ['a resisted tag is not special: the first tag still wins', ['frost', 'heat'], def(undefined, { frost: 0.3 }), {}, 'frost'],
    ['a burn tick is heat', ['heat'], def(), { isDot: true }, 'heat'],
    ['a poison tick is poison', ['poison'], def(), { isDot: true, poison: true }, 'poison'],
    ['a DoT tick tag beats the first weapon tag', ['frost', 'poison'], def(), { isDot: true, poison: true }, 'poison'],
    ['a weak tag beats the DoT tick tag', ['heat', 'poison'], def({ heat: 0.3 }), { isDot: true, poison: true }, 'heat'],
    ['a poison tick on an enemy weak to poison stays poison', ['poison'], def({ poison: 0.3 }), { isDot: true, poison: true }, 'poison'],
    ['the reserved reaction beats everything', ['heat'], def({ heat: 0.3 }), { reaction: true, isDot: true }, 'reaction'],
    ['a mark is never a display type', ['heat'], def({ mark: 0.4 }), {}, 'heat'],
  ];
  for (const [name, tags, d, opts, want] of table) it(name, () => expect(damageType(tags, d, opts)).toBe(want));

  it('works on real hit tags: a heat weapon, a burn tick, an explosion', () => {
    expect(damageType(hitTags(stats(Item.toaster), {}), def())).toBe('heat');
    expect(damageType(hitTags(null, { isDot: true }), def(), { isDot: true })).toBe('heat');
    expect(damageType(hitTags(null, { fromPopper: true }), def())).toBe('blast');
    expect(damageType(hitTags(null, {}), def())).toBe('physical');
  });
});

describe('numberStyle', () => {
  const base = { type: 'heat' as DamageType, crit: false, isDot: false, poison: false, weak: null, resisted: null };

  it('colors on: the type color; weak is bigger and brighter; resisted smaller at half alpha; a crit is big, outlined, never its own color', () => {
    const plain = numberStyle(base, true), weak = numberStyle({ ...base, weak: Tag.heat }, true), res = numberStyle({ ...base, resisted: Tag.heat }, true), crit = numberStyle({ ...base, crit: true }, true);
    expect(plain).toEqual({ color: ELEMENT_COLORS.heat, size: 22, alpha: 1, crit: false });
    expect(weak.size).toBeGreaterThan(plain.size);
    expect(weak.color).toBe(brighten(ELEMENT_COLORS.heat, 0.3));
    expect(res.size).toBeLessThan(plain.size);
    expect(res.alpha).toBe(0.5);
    expect(res.color).toBe(ELEMENT_COLORS.heat);
    expect(crit.crit).toBe(true);
    expect(crit.size).toBeGreaterThan(weak.size);
    expect(crit.color).toBe(ELEMENT_COLORS.heat);
    for (const ty of DAMAGE_TYPES) expect(numberStyle({ ...base, type: ty, crit: true }, true).color, ty).toBe(ELEMENT_COLORS[ty]);
  });

  it('a DoT tick is smaller, in the same type color', () => {
    const dot = numberStyle({ ...base, type: 'poison', isDot: true, poison: true }, true);
    expect(dot.color).toBe(ELEMENT_COLORS.poison);
    expect(dot.size).toBeLessThan(22);
  });

  it('colors off: the old neutral scheme (coral crit, grey resisted, poison green, burn gold, cream), no outline', () => {
    expect(numberStyle({ ...base, crit: true }, false)).toEqual({ color: '#F45F52', size: 28, alpha: 1, crit: false });
    expect(numberStyle({ ...base, resisted: Tag.heat }, false)).toMatchObject({ color: '#9C93B0', size: 19, alpha: 1 });
    expect(numberStyle({ ...base, isDot: true, poison: true }, false)).toMatchObject({ color: '#8FCB57', size: 16 });
    expect(numberStyle({ ...base, isDot: true }, false)).toMatchObject({ color: '#F5BD45', size: 16 });
    expect(numberStyle({ ...base, type: 'frost' }, false)).toMatchObject({ color: '#FFF2D5', size: 22 });
    expect(numberStyle({ ...base, weak: Tag.heat }, false)).toMatchObject({ color: ELEMENT_COLORS.heat, size: 25 });
  });
});

describe('the damage accumulator', () => {
  const sink = (): DamageSink => ({ damageByWeapon: {}, damage: newDamageStats() });
  const rec = { source: 'a', dmg: 10, type: 'heat' as DamageType, isDot: false, weak: false, resisted: false, shred: 0, mark: 0 };

  it('starts at zero for every type, reaction included', () => {
    const d = newDamageStats();
    expect(Object.keys(d.byType).sort()).toEqual([...DAMAGE_TYPES].sort());
    expect(totalDamage(d)).toBe(0);
    expect(d.byType.reaction).toBe(0);
  });

  it('sums per source and per type, DoT, weak, resisted, shred and mark', () => {
    const s = sink();
    recordDamage(s, rec);
    recordDamage(s, { ...rec, source: 'b', dmg: 5, type: 'frost', weak: true, mark: 1.5 });
    recordDamage(s, { ...rec, source: 'burn', dmg: 2, isDot: true, resisted: true });
    recordDamage(s, { ...rec, source: 'a', dmg: 3, type: 'physical', shred: 2 });
    expect(s.damageByWeapon).toEqual({ a: 13, b: 5, burn: 2 });
    expect(s.damage).toEqual({ byType: { ...newDamageStats().byType, heat: 12, frost: 5, physical: 3 }, dot: 2, weak: 5, resisted: 2, shred: 2, mark: 1.5 });
    expect(totalDamage(s.damage)).toBe(20);
  });
});

describe('the FakeCtx records the pipeline\'s final damage', () => {
  /** HP the enemy lost, what the log says it took, in total and per source. */
  const lost = (e: { hp: number }, from: number) => from - e.hp;

  it('overkill counts, like damageByWeapon always did', () => {
    const fake = new FakeCtx();
    const e = fake.spawnEnemy({ hp: 5 });
    fake.hit(e, 10, null, { label: 'x' });
    expect(fake.dmgLog.damageByWeapon).toEqual({ x: 10 });
    expect(totalDamage(fake.dmgLog.damage)).toBe(10);
    expect(fake.dmgLog.damage.byType.physical).toBe(10);
  });

  it('per source equals per type equals the hp that left the enemy, with a weak, a resisted and a neutral hit', () => {
    const fake = new FakeCtx();
    const turkey = fake.spawnReal(Enemy.turkey, { hp: 1000 }); // weak heat, resists frost
    expect(hitTags(stats(Item.toaster), {})).toContain(Tag.heat);
    fake.hit(turkey, 10, stats(Item.toaster));
    fake.hit(turkey, 10, null, { label: 'plain' });
    fake.hit(turkey, 10, null, { label: 'cold', tags: [Tag.frost] });
    const d = fake.dmgLog.damage, total = lost(turkey, 1000);
    expect(Object.values(fake.dmgLog.damageByWeapon).reduce((a, b) => a + b, 0)).toBeCloseTo(total, 9);
    expect(totalDamage(d)).toBeCloseTo(total, 9);
    // The turkey has armor 2 (the armor step comes after the affinity): each number is the affinity result, soaked by it.
    expect(d.byType.heat).toBeCloseTo(armorDamage(13, 2), 9); // weak: 10 x 1.3 = 13, shown as heat; 11 after armor
    expect(d.byType.physical).toBe(armorDamage(10, 2)); // 8
    expect(d.byType.frost).toBeCloseTo(armorDamage(7, 2), 9); // resisted: 10 x 0.7 = 7; 5 after armor
    expect(d.weak).toBeCloseTo(armorDamage(13, 2), 9);
    expect(d.resisted).toBeCloseTo(armorDamage(7, 2), 9);
    expect(d.dot).toBe(0);
  });

  it('burn and poison ticks are DoT, in the heat and poison types', () => {
    const fake = new FakeCtx();
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, null, { isDot: true });
    fake.hit(e, 2, null, { isDot: true, poison: true });
    fake.hit(e, 5, null, { label: 'x' });
    const d = fake.dmgLog.damage;
    expect(d.dot).toBe(5);
    expect(d.byType).toMatchObject({ heat: 3, poison: 2, physical: 5 });
    expect(fake.dmgLog.damageByWeapon).toEqual({ burn: 3, poison: 2, x: 5 });
  });

  it('the mark bonus is the damage after the mark minus before it', () => {
    const fake = new FakeCtx();
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.hit(e, 10, null, { label: 'x' });
    expect(fake.dmgLog.damage.mark).toBe(0);
    fake.mark(e, 5);
    fake.hit(e, 10, null, { label: 'x' });
    expect(fake.dmgLog.damage.mark).toBeCloseTo(10 * (MARK_MULT - 1), 9);
    expect(totalDamage(fake.dmgLog.damage)).toBeCloseTo(10 + 10 * MARK_MULT, 9);
    fake.advance(6); // the mark ran out
    fake.hit(e, 10, null, { label: 'x' });
    expect(fake.dmgLog.damage.mark).toBeCloseTo(10 * (MARK_MULT - 1), 9);
  });

  it('the mark bonus on a weak mark target is the bigger one (the Manager takes more)', () => {
    const fake = new FakeCtx();
    const boss = fake.spawnReal(Enemy.boss, { hp: 5000 });
    fake.mark(boss, 5);
    fake.hit(boss, 10, null, { label: 'x' });
    expect(fake.dmgLog.damage.mark).toBeCloseTo(10 * (1 + (MARK_MULT - 1) * (1 + (ENEMIES.boss.weak?.mark ?? 0)) - 1), 9);
    expect(fake.dmgLog.damage.mark).toBeGreaterThan(10 * (MARK_MULT - 1));
  });

  it('the shred bonus is what Shred added over the same hit without stacks', () => {
    const fake = new FakeCtx();
    const beans = fake.spawnReal(Enemy.beans, { hp: 1000 }); // armor 3: a 9 hit deals 6
    fake.hit(beans, 9, null, { label: 'x' });
    expect(fake.dmgLog.damage.shred).toBe(0);
    fake.shred(beans, 1); // armor 2: 7
    fake.hit(beans, 9, null, { label: 'x' });
    expect(fake.dmgLog.damage.shred).toBe(1);
    fake.shred(beans, 2); // 3 stacks: armor gone, 9
    fake.hit(beans, 9, null, { label: 'x' });
    expect(fake.dmgLog.damage.shred).toBe(1 + 3);
    const milk = fake.spawnReal(Enemy.milk, { hp: 1000 }); // no armor: 3 stacks expose it, +3 on a 9 hit
    fake.shred(milk, 3);
    fake.hit(milk, 9, null, { label: 'y' });
    expect(fake.dmgLog.damage.shred).toBe(1 + 3 + 3);
    expect(totalDamage(fake.dmgLog.damage)).toBe(6 + 7 + 9 + 12);
  });

  it('burn ticks never carry a shred bonus (armor skips them)', () => {
    const fake = new FakeCtx();
    const milk = fake.spawnReal(Enemy.milk, { hp: 1000 });
    fake.shred(milk, 3);
    fake.hit(milk, 4, null, { isDot: true });
    expect(fake.dmgLog.damage.shred).toBe(0);
  });

  it('is deterministic and does not touch the rng: the same hits deal the same with or without the log being read', () => {
    const run = () => {
      const fake = new FakeCtx({ seed: 7 });
      const e = fake.spawnReal(Enemy.turkey, { hp: 100000 });
      const crit = { type: Item.toaster, critChance: 0.5 } as WeaponStats;
      for (let i = 0; i < 50; i++) fake.hit(e, 10, crit);
      return [e.hp, totalDamage(fake.dmgLog.damage)];
    };
    const [a, b] = run();
    expect(run()).toEqual([a, b]);
    expect(100000 - a).toBeCloseTo(b, 6);
  });
});

describe('the breakdown html', () => {
  const names = { name: (k: string) => k.toUpperCase(), type: (k: string): DamageType => (k === 'a' ? 'heat' : 'physical') };
  const filled = () => {
    const s = { damageByWeapon: {}, damage: newDamageStats() } as DamageSink;
    recordDamage(s, { source: 'a', dmg: 60, type: 'heat', isDot: false, weak: true, resisted: false, shred: 4, mark: 6 });
    recordDamage(s, { source: 'burn', dmg: 40, type: 'physical', isDot: true, weak: false, resisted: true, shred: 0, mark: 0 });
    return s;
  };

  afterEach(() => setLang('en'));

  it('is empty for a run that dealt no damage', () => {
    expect(damageBreakdownHtml({ damageByWeapon: {}, damage: newDamageStats() }, names, true)).toBe('');
  });

  it('shows the source bars with their shares, the type chips and the share and bonus lines', () => {
    const html = damageBreakdownHtml(filled(), names, true);
    expect(html).toContain('>A<');
    expect(html).toContain('60<small>60%</small>');
    expect(html).toContain('Heat <b>60%</b>');
    expect(html).toContain('Physical <b>40%</b>');
    for (const row of ['Over time (burn, poison)', 'On weak hits', 'On resisted hits', 'Shred bonus', 'Price mark bonus']) expect(html).toContain(row);
    expect(html).toContain('<span>40%</span>'); // DoT share
    expect(html).toContain('<span>+4</span>');
    expect(html).toContain('<span>+6</span>');
  });

  it('colors on uses the palette (bars, stacked type bar); colors off shows none of it', () => {
    const on = damageBreakdownHtml(filled(), names, true), off = damageBreakdownHtml(filled(), names, false);
    expect(on).toContain(`background:${ELEMENT_COLORS.heat}`);
    expect(on).toContain('class="dstack"');
    expect(off).not.toContain('class="dstack"');
    expect(off).not.toMatch(/#[0-9A-F]{6}/);
  });

  it('hides zero lines and folds extra sources into "+N more"', () => {
    const s = { damageByWeapon: {}, damage: newDamageStats() } as DamageSink;
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) recordDamage(s, { source: k, dmg: 10, type: 'physical', isDot: false, weak: false, resisted: false, shred: 0, mark: 0 });
    const html = damageBreakdownHtml(s, names, true);
    expect(html).not.toContain('Shred bonus');
    expect(html).not.toContain('class="dlines"');
    expect(html).toContain('+2 more');
  });

  it('speaks German', () => {
    setLang('de');
    const html = damageBreakdownHtml(filled(), names, true);
    expect(html).toContain('Schaden pro Gegenstand');
    expect(html).toContain('Physisch');
    expect(html).toContain('Aufreiß-Bonus');
  });
});

describe('strings', () => {
  const keys = ['damageColors', 'damageByItem', 'damageByType', 'dmgPhysical', 'dmgReaction', 'dmgShareDot', 'dmgShareWeak', 'dmgShareResisted', 'dmgBonusShred', 'dmgBonusMark'] as const;
  it('every new key exists in English and German', () => {
    for (const k of keys) {
      expect(UI.en[k], k).toBeTruthy();
      expect(UI.de[k], k).toBeTruthy();
    }
    expect(UI.de.damageColors).not.toBe(UI.en.damageColors);
  });
});

describe('the "Damage colors" setting', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

  it('defaults to on and persists across a reload', async () => {
    vi.stubGlobal('localStorage', memory());
    vi.resetModules();
    const first = await import('../src/state/settings');
    expect(first.settings.damageColors).toBe(true);
    first.settings.damageColors = false;
    first.saveSettings();
    vi.resetModules();
    const second = await import('../src/state/settings');
    expect(second.settings.damageColors).toBe(false);
  });

  it('an old save without the key reads as on', async () => {
    const ls = memory();
    ls.setItem('goblin-grocery.settings.v1', JSON.stringify({ shake: false }));
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();
    const { settings } = await import('../src/state/settings');
    expect(settings.shake).toBe(false);
    expect(settings.damageColors).toBe(true);
  });
});
