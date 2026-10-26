import { describe, expect, it } from 'vitest';
import { MINI_BOSS, ENEMIES, BOSS_IDS, BOSS_KITS, BOSS_SPECIAL, CODEX_ENEMIES, ELITE_EXCLUDED, bossFor, enemyFrame, isBossId } from '../src/data/enemies';
import { SVG_ASSETS } from '../src/data/assets';
import { enemyT } from '../src/i18n/data';
import { setLang } from '../src/i18n/lang';
import { UI } from '../src/i18n/ui';
import { THEMES } from '../src/data/departments';
import { BOSS_WAVE } from '../src/data/waves';
import { ITEMS } from '../src/data/items';
import { createRun } from '../src/state/run';
import { rollMiniCrates } from '../src/systems/shop';
import { mulberry32 } from '../src/systems/rng';

describe('mid-shift boss', () => {
  it('sits before the final boss and has a giant for every theme', () => {
    expect(MINI_BOSS.aisle).toBeGreaterThan(1);
    expect(MINI_BOSS.aisle).toBeLessThan(BOSS_WAVE);
    expect(MINI_BOSS.variants.length).toBeGreaterThanOrEqual(2);
    for (const [vi, v] of MINI_BOSS.variants.entries()) for (const th of THEMES) {
      const id = v.byTheme[th];
      expect(id, `${vi}/${th}`).toBeDefined();
      expect(ENEMIES[id!], `${vi}/${th}`).toBeDefined();
      expect(ENEMIES[id!].behavior).not.toBe('boss');
    }
    for (const th of THEMES) {
      const ids = MINI_BOSS.variants.map((v) => v.byTheme[th]);
      expect(new Set(ids).size, th + ' variants differ').toBe(ids.length);
    }
  });

  it('variants differ in moves, and every giant has a tell sprite or falls back to its frames', () => {
    const [a, b] = MINI_BOSS.variants;
    expect(a.kit.moves).not.toEqual(b.kit.moves);
    expect(a.kit.cycle).not.toEqual(b.kit.cycle);
    for (const v of MINI_BOSS.variants) {
      expect(v.kit.cycle.length).toBeGreaterThan(1);
      expect(v.kit.cycle).not.toContain('special'); // minis have no signature move
    }
    for (const id of ['soda', 'turkey'] as const) expect(SVG_ASSETS.some((a) => a.key === `enemy_${id}_tell`), id).toBe(true);
  });

  it('crates: 3 free distinct items, one unowned legendary when unlocked, weapons otherwise', () => {
    const s = createRun(1);
    s.pool = undefined; // everything unlocked
    const offers = rollMiniCrates(s, mulberry32(7));
    expect(offers).toHaveLength(MINI_BOSS.crates);
    expect(new Set(offers.map((o) => o.type)).size).toBe(offers.length);
    expect(offers.every((o) => o.price === 0)).toBe(true);
    expect(offers.filter((o) => ITEMS[o.type].legendary)).toHaveLength(1);
    for (const o of offers.filter((o) => !ITEMS[o.type].legendary)) {
      expect(ITEMS[o.type].kind).toBe('weapon');
      expect(o.tier).toBe(MINI_BOSS.weaponTier);
    }
    s.pool = ['toaster', 'pan', 'nailgun', 'vacuum'];
    const locked = rollMiniCrates(s, mulberry32(7));
    expect(locked.some((o) => ITEMS[o.type].legendary)).toBe(false);
    expect(locked).toHaveLength(3);
  });
});

describe('per-theme final bosses', () => {
  it('every theme maps to a boss def with a kit, a codex entry and no elite roll', () => {
    expect(bossFor('main')).toBe('boss'); // the Manager keeps the Main Aisle
    expect(new Set(THEMES.map(bossFor)).size).toBe(THEMES.length);
    expect(Object.keys(BOSS_KITS).sort()).toEqual([...BOSS_IDS].sort());
    for (const th of THEMES) {
      const id = bossFor(th), d = ENEMIES[id];
      expect(isBossId(id), th).toBe(true);
      expect(d.behavior, th).toBe('boss');
      expect(d.hp, th).toBeGreaterThanOrEqual(1400);
      expect(d.hp, th).toBeLessThanOrEqual(1800);
      expect(CODEX_ENEMIES, th).toContain(id);
      expect(ELITE_EXCLUDED, th).toContain(id);
    }
  });

  it('every boss has a/b/tell/hurt sprites registered, EN + DE names and blurbs, and bark lines for each move', () => {
    const keys = new Set(SVG_ASSETS.map((a) => a.key));
    const names = new Set<string>();
    for (const id of BOSS_IDS) {
      for (const f of ['a', 'b', 'tell', 'hurt'] as const) expect(keys.has(enemyFrame(id, f)), `${id} ${f}`).toBe(true);
      expect(ENEMIES[id].name && ENEMIES[id].blurb, id).toBeTruthy();
      setLang('de');
      expect(enemyT(id).name && enemyT(id).blurb, id + ' de').toBeTruthy();
      expect(enemyT(id).name, id + ' de differs').not.toBe(ENEMIES[id].name);
      setLang('en');
      names.add(ENEMIES[id].name);
      const kit = BOSS_KITS[id];
      expect(kit.cycle.includes('special'), id + ' special').toBe(!!kit.special);
      if (kit.special) expect(BOSS_SPECIAL[kit.special], id).toBeDefined();
      if (id === 'boss') continue;
      for (const m of new Set(kit.cycle)) for (const lang of ['en', 'de'] as const) {
        expect((UI[lang] as Record<string, string>)[`bk_${id}_${m}`], `${id} ${m} ${lang}`).toBeTruthy();
      }
    }
    expect(names.size).toBe(BOSS_IDS.length);
  });

  it('the enemy tell sprites the minis rely on exist', () => {
    const keys = new Set(SVG_ASSETS.map((a) => a.key));
    for (const id of ['banana', 'spitter', 'baguette', 'egg', 'soda', 'turkey']) expect(keys.has(`enemy_${id}_tell`), id).toBe(true);
  });
});
