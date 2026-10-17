import { describe, expect, it } from 'vitest';
import { BOSS_BY_THEME, BOSS_IDS, BOSS_KITS, BOSS_SPECIAL, CODEX_ENEMIES, ENEMIES, SHOW_HP_BAR, bossFor, enemyFrame, isBossId } from '../../../src/data/enemies';
import { AFFINITY_TAGS, ENEMY_ORDER, defineEnemy } from '../../../src/engine/define';
import { contentEnemies, contentEnemy, contentEnemyTune, registry, validateContent } from '../../../src/engine/registry';

// The real registry validates itself at load (a bad file throws on import); these tests pin what it loaded and prove the validation on fixtures.

const OLD_ORDER = ['milk', 'banana', 'soda', 'spitter', 'baguette', 'egg', 'melon', 'turkey', 'beans', 'cereal', 'honey', 'giftcard', 'expired', 'gum', 'slice', 'boss', 'boss_frozen', 'boss_bakery', 'boss_electronics', 'boss_checkout'];

describe('enemy registry', () => {
  it('loads one file per enemy, in ENEMY_ORDER, the order the table always had', () => {
    expect([...ENEMY_ORDER]).toEqual(OLD_ORDER);
    expect(Object.keys(ENEMIES)).toEqual(OLD_ORDER);
    expect(contentEnemies().map((c) => c.id).sort()).toEqual([...OLD_ORDER].sort());
    for (const id of ENEMY_ORDER) expect(contentEnemy(id)?.id).toBe(id);
    expect(registry.enemy('nope')).toBeUndefined();
  });

  it('derives the boss tables from the boss files', () => {
    expect(BOSS_IDS).toEqual(['boss', 'boss_frozen', 'boss_bakery', 'boss_electronics', 'boss_checkout']);
    expect(BOSS_BY_THEME).toEqual({ main: 'boss', frozen: 'boss_frozen', bakery: 'boss_bakery', electronics: 'boss_electronics', checkout: 'boss_checkout' });
    expect(Object.keys(BOSS_KITS)).toEqual(BOSS_IDS);
    expect(Object.keys(BOSS_SPECIAL).sort()).toEqual(['belt', 'lanes', 'ring', 'slush']);
    expect(bossFor('electronics')).toBe('boss_electronics');
    expect(bossFor('boss')).toBe('boss'); // unknown theme: the Manager
    expect(isBossId('boss_bakery')).toBe(true);
    expect(isBossId('milk')).toBe(false);
    expect(enemyFrame('boss_frozen', 'tell')).toBe('boss_frozen_tell');
    expect(enemyFrame('milk')).toBe('enemy_milk_a');
  });

  it('shows health bars on the same enemies as before, and every enemy is in the codex once', () => {
    expect([...SHOW_HP_BAR].sort()).toEqual(['milk', 'banana', 'soda', 'baguette', 'spitter', 'egg', 'melon', 'slice', 'turkey', 'beans', 'cereal', 'honey', 'expired', 'gum'].sort());
    expect([...CODEX_ENEMIES].sort()).toEqual([...OLD_ORDER].sort());
  });

  it('reads an enemy tune by id', () => {
    expect(contentEnemyTune('spitter')).toEqual({ shots: 3, spreadDeg: 22 });
    expect(contentEnemyTune('milk')).toEqual({});
  });

  it('leaves every affinity empty until step 2 fills it in', () => {
    for (const c of contentEnemies()) { expect(c.weak, c.id).toBeUndefined(); expect(c.resist, c.id).toBeUndefined(); }
    expect([...AFFINITY_TAGS]).toEqual(['heat', 'frost', 'electric', 'blast', 'cleaning', 'poison', 'mark']);
  });
});

// ---- validation on fixtures (inline definitions, not files in src/content) ----------------------------------------------

const enemy = (over: Record<string, unknown> = {}) => defineEnemy({
  id: 'spitter', behavior: 'spitter', scale: 0.78, hpBar: true,
  stats: { hp: 18, speed: 64, contactDamage: 4, coins: 2, radius: 18, tell: 0.45, attackCooldown: 2.6, attackRange: 420, attackDamage: 5, projectileSpeed: 125, projectileLife: 4, preferredDistance: 270 },
  tune: { shots: 3, spreadDeg: 22 },
  text: {
    en: { name: 'Detergent Spitter', blurb: 'Fires {shots} bubbles.' },
    de: { name: 'Spülmittel-Spucker', blurb: 'Feuert {shots} Blasen.' },
  },
  ...over,
} as never);
const boss = (over: Record<string, unknown> = {}) => defineEnemy({
  id: 'boss_bakery', behavior: 'boss', scale: 0.95,
  stats: { hp: 1450, speed: 58, contactDamage: 14, coins: 30, radius: 46, knockbackResist: 1 },
  tune: { shots: 14, speed: 150, life: 6, halfExtra: 4 },
  text: { en: { name: 'The Industrial Oven', blurb: 'Hot.' }, de: { name: 'Der Industrieofen', blurb: 'Heiß.' } },
  boss: { theme: 'bakery', kit: { cycle: ['volley', 'special'], shot: 'proj_toast', special: 'ring', moves: { volleyCount: 5, summonTypes: ['baguette', 'banana'] } } },
  ...over,
} as never);
const errors = (files: Record<string, unknown>, opts?: Parameters<typeof validateContent>[1]) => validateContent({ enemies: files as never }, opts).join('\n');

describe('validateContent: enemies', () => {
  it('accepts valid enemies, with and without affinity', () => {
    expect(validateContent({ enemies: { 'enemies/spitter.ts': enemy() } })).toEqual([]);
    expect(validateContent({ enemies: { 'enemies/spitter.ts': enemy({ weak: { heat: 1.5 }, resist: { frost: 0.5, blast: 0.8 } }) } })).toEqual([]);
    expect(validateContent({ enemies: { 'enemies/boss_bakery.ts': boss() } })).toEqual([]);
  });

  it('rejects duplicate ids and a filename that is not the id', () => {
    expect(errors({ 'enemies/spitter.ts': enemy(), 'enemies/x/spitter.ts': enemy() })).toMatch(/duplicate enemy id "spitter" \(also in enemies\/spitter\.ts\)/);
    expect(errors({ 'enemies/gum.ts': enemy() })).toMatch(/filename must match the id "spitter"/);
  });

  it('keeps the order list complete in both directions', () => {
    expect(errors({ 'enemies/spitter.ts': enemy() }, { enemyOrder: ['spitter', 'milk'] })).toMatch(/ENEMY_ORDER lists "milk", which has no content file \(src\/content\/enemies\/milk\.ts\)/);
    expect(errors({ 'enemies/spitter.ts': enemy() }, { enemyOrder: ['milk'] })).toMatch(/"spitter" is missing from ENEMY_ORDER \(src\/engine\/define\.ts\)/);
    expect(validateContent({ enemies: { 'enemies/spitter.ts': enemy() } }, { enemyOrder: ['spitter'] })).toEqual([]);
  });

  it('rejects a bad behavior, scale, stat name or stat value', () => {
    expect(errors({ 'enemies/spitter.ts': enemy({ behavior: 'dance' }) })).toMatch(/unknown behavior "dance"/);
    expect(errors({ 'enemies/spitter.ts': enemy({ scale: 0 }) })).toMatch(/scale must be a positive number/);
    expect(errors({ 'enemies/spitter.ts': enemy({ stats: { hp: 18, speed: 64, contactDamage: 4, coins: 2, radius: 18, speeed: 3 } }) })).toMatch(/stats\.speeed is not an enemy stat/);
    expect(errors({ 'enemies/spitter.ts': enemy({ stats: { hp: 0, speed: 64, contactDamage: 4, coins: 2, radius: 18 } }) })).toMatch(/stats\.hp must be a positive number/);
    expect(errors({ 'enemies/spitter.ts': enemy({ stats: { hp: 18, speed: 64, contactDamage: 4, coins: 2, radius: 18, knockbackResist: 1.5 } }) })).toMatch(/stats\.knockbackResist must be a number from 0 to 1/);
    expect(errors({ 'enemies/spitter.ts': enemy({ stats: { hp: 18, speed: 64, contactDamage: 4, radius: 18 } }) })).toMatch(/stats\.coins is required/);
    expect(errors({ 'enemies/spitter.ts': enemy({ stats: { hp: 18, speed: 64, contactDamage: 4, coins: 2, radius: 18, shield: 1 } }) })).toMatch(/stats\.shield must be a boolean/);
  });

  it('rejects a per-tier tune (an enemy has no tiers)', () => {
    expect(errors({ 'enemies/spitter.ts': enemy({ tune: { shots: [1, 2, 3] } }) })).toMatch(/tune\.shots is per-tier, but this content has no tiers/);
  });

  it('checks the text: both languages, same placeholders, keys from the tune or the numeric stats, known formatters', () => {
    expect(errors({ 'enemies/spitter.ts': enemy({ text: { en: { name: 'A', blurb: 'Fires {shots} bubbles.' } } }) })).toMatch(/text needs both "en" and "de"/);
    expect(errors({ 'enemies/spitter.ts': enemy({ text: { en: { name: 'A', blurb: 'Fires {shots} bubbles.' }, de: { name: 'B', blurb: 'Feuert Blasen.' } } }) })).toMatch(/different placeholders/);
    expect(errors({ 'enemies/spitter.ts': enemy({ text: { en: { name: 'A', blurb: 'Fires {nope}.' }, de: { name: 'B', blurb: 'Feuert {nope}.' } } }) })).toMatch(/uses \{nope\} but tune has no "nope"/);
    expect(errors({ 'enemies/spitter.ts': enemy({ text: { en: { name: 'A', blurb: 'Fires {shots|zzz}.' }, de: { name: 'B', blurb: 'Feuert {shots|zzz}.' } } }) })).toMatch(/unknown formatter "zzz"/);
    // A stat can be named too: Canned Beans write their armor in the blurb.
    expect(validateContent({ enemies: { 'enemies/spitter.ts': enemy({ text: { en: { name: 'A', blurb: 'Soaks {attackDamage}.' }, de: { name: 'B', blurb: 'Schluckt {attackDamage}.' } } }) } })).toEqual([]);
    expect(errors({ 'enemies/spitter.ts': enemy({ text: { en: { name: 'A', blurb: '' }, de: { name: 'B', blurb: 'x' } } }) })).toMatch(/text\.en\.blurb must be a non-empty string/);
  });

  it('checks the affinity tags and multipliers', () => {
    expect(errors({ 'enemies/spitter.ts': enemy({ weak: { lava: 2 } }) })).toMatch(/weak\.lava is not an affinity tag/);
    expect(errors({ 'enemies/spitter.ts': enemy({ resist: { heat: 0 } }) })).toMatch(/resist\.heat must be a positive multiplier/);
    expect(errors({ 'enemies/spitter.ts': enemy({ weak: { heat: 1.5 }, resist: { heat: 0.5 } }) })).toMatch(/"heat" is both weak and resist/);
  });

  it('needs a kit on bosses only, with a valid theme, cycle, special and summon list', () => {
    expect(errors({ 'enemies/boss_bakery.ts': boss({ boss: undefined }) })).toMatch(/a boss \(behavior "boss"\) needs `boss: \{ theme, kit \}`/);
    expect(errors({ 'enemies/spitter.ts': enemy({ boss: { theme: 'main', kit: { cycle: ['volley'], shot: 'x', moves: {} } } }) })).toMatch(/only bosses .* have a `boss` kit/);
    const kit = (over: object) => boss({ boss: { theme: 'bakery', kit: { cycle: ['volley', 'special'], shot: 'proj_toast', special: 'ring', moves: {}, ...over } } });
    expect(errors({ 'enemies/boss_bakery.ts': boss({ boss: { theme: 'aisle9', kit: { cycle: ['volley'], shot: 'x', moves: {} } } }) })).toMatch(/boss\.theme must be one of/);
    expect(errors({ 'enemies/boss_bakery.ts': kit({ cycle: [] }) })).toMatch(/cycle must be a non-empty list/);
    expect(errors({ 'enemies/boss_bakery.ts': kit({ cycle: ['volley', 'dance'] }) })).toMatch(/unknown move "dance"/);
    expect(errors({ 'enemies/boss_bakery.ts': kit({ cycle: ['volley'] }) })).toMatch(/special and a "special" entry in the cycle go together/);
    expect(errors({ 'enemies/boss_bakery.ts': kit({ special: undefined }) })).toMatch(/special and a "special" entry in the cycle go together/);
    expect(errors({ 'enemies/boss_bakery.ts': kit({ special: 'tornado' }) })).toMatch(/unknown boss\.kit\.special "tornado"/);
    expect(errors({ 'enemies/boss_bakery.ts': boss({ tune: { shots: 14 } }) })).toMatch(/special "ring" needs tune\.speed/);
    expect(errors({ 'enemies/boss_bakery.ts': kit({ shot: '' }) })).toMatch(/shot must be a texture key/);
    expect(errors({ 'enemies/boss_bakery.ts': kit({ moves: { volleyCount: 0 } }) })).toMatch(/moves\.volleyCount must be a positive number/);
    expect(errors({ 'enemies/boss_bakery.ts': kit({ moves: { lunge: 3 } }) })).toMatch(/moves\.lunge is not a move number/);
    expect(errors({ 'enemies/boss_bakery.ts': kit({ moves: { summonTypes: ['ghost'] } }) }, { enemyOrder: ['boss_bakery', 'baguette'] })).toMatch(/summonTypes names unknown enemy "ghost"/);
  });

  it('gives each theme one boss', () => {
    expect(errors({ 'enemies/boss_bakery.ts': boss(), 'enemies/boss_frozen.ts': boss({ id: 'boss_frozen' }) })).toMatch(/duplicate boss theme id "bakery"/);
  });
});
