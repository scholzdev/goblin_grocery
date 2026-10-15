import { describe, expect, it, vi } from 'vitest';
import { adjacentPairs, canPlace, footprint, normalizeRotation, rotatedSize, rotateCells } from '../src/systems/inventory';
import { computeBuild, tierScaling } from '../src/systems/synergies';
import { armorDamage, healTargets, shieldBlocks, killCoins, pickRicochetTarget, rollCrit, applyBurn, applySlow, isSpent, newHitTracker, newStatus, slowFactor, tickBurn, tryHit } from '../src/systems/combat';
import { inflation, rollDoors, waveSpawnPlan, currentRerollCost, rerollCost, rollOffers, sellPrice } from '../src/systems/shop';
import { profile, noteEnemy, recordRun, recordOvertime, shiftUnlocked, starterUnlocked } from '../src/state/profile';
import { mulberry32 } from '../src/systems/rng';
import { rollEvent, outageDuration } from '../src/systems/events';
import { EVENTS } from '../src/data/events';
import { cart } from './cart';
import { setLevels } from '../src/data/sets';
import { RECIPES } from '../src/data/recipes';
import { DEPARTMENTS, DEPT_TUNING, THEMES } from '../src/data/departments';
import { DOOR_POOL, MODIFIERS, ROOM_DOORS } from '../src/data/modifiers';
import { BOSS_WAVE, ECONOMY, OVERTIME, SHIFTS, SHOP_LEVELS, WAVES, waveDef, bossTuning, eliteChance, enemyAppears } from '../src/data/waves';
import { BOSS, THEME_SUMMONS, CODEX_ENEMIES, ELITE, ELITE_EXCLUDED, ENEMIES } from '../src/data/enemies';
import { DATA_DE } from '../src/i18n/data-de';
import { BUFFS, ITEMS, PLAYER, STARTER_WEAPONS, TIER } from '../src/data/items';
import { UNLOCKS } from '../src/data/unlocks';
import { createLabRun, labAddItem, labDoor, cartUpgradeCost, shelfUpgradeCost, upgradeCart, upgradeShelf, chooseDoor, finishWave, leaveShop, startNextWave, buyOffer, mergeTargetFor, createRun, damagePlayer, mergeItems, moveItem, openShop, previewMerge, previewMove, repair, reroll, sellItem, upgradeCost, upgradeItem, upgradeShop } from '../src/state/run';
import { OBSTACLES, hazardRects } from '../src/data/obstacles';
import { zonesOf } from '../src/data/zones';
import { ARENA, ENTRIES, PLAYER_START, edgeSolids } from '../src/data/arena';
import { pushOutCapsule, pushOutCircle, segmentHitsRect, steerAround } from '../src/systems/obstacles';
import type { Rect } from '../src/systems/obstacles';
import type { Inventory, ItemInstance, ItemTypeId, Rotation, RunState } from '../src/types';

let n = 0;
const it_ = (type: ItemTypeId, x: number, y: number, rot: Rotation = 0): ItemInstance => ({ uid: `t${String(++n).padStart(3, '0')}`, type, x, y, rot });
const inv = (...placed: ItemInstance[]): Inventory => ({ cols: 5, rows: 4, placed, shelf: [null, null, null, null] });
// Fixture: toaster starter (i1 at 1,1) plus a pan (i2 at 4,0), the two-weapon cart many tests were written against.
const shopRun = (): RunState => {
  const s = createRun(1);
  s.inventory.placed.push({ uid: 'i2', type: 'pan', x: 4, y: 0, rot: 0 });
  s.nextUid = 3;
  s.build = computeBuild(s.inventory);
  openShop(s, mulberry32(1));
  return s;
};
const w0 = (i: Inventory) => computeBuild(i).weapons[0];
/** Battery attack-rate factor for normal / electric weapons at ★1. */
const batE = 1 + (BUFFS.battery.rateMult - 1) * BUFFS.battery.electricMult;

describe('footprints', () => {
  it('1x3 pan rot1 is 3x1', () => {
    expect(rotatedSize('pan', 0)).toEqual({ w: 1, h: 3 });
    expect(rotatedSize('pan', 1)).toEqual({ w: 3, h: 1 });
  });
  it('2x2 cooker is a Z: 3x2, rot1 2x3, rot2 is a distinct S-less repeat', () => {
    expect(rotatedSize('cooker', 0)).toEqual({ w: 3, h: 2 });
    expect(rotatedSize('cooker', 1)).toEqual({ w: 2, h: 3 });
    expect(normalizeRotation('cooker', 2)).toBe(0);
    expect(normalizeRotation('cooker', 3)).toBe(1);
  });
  it('T vacuum rotates through 4 distinct footprints', () => {
    expect(rotatedSize('vacuum', 0)).toEqual({ w: 3, h: 2 });
    expect(rotatedSize('vacuum', 1)).toEqual({ w: 2, h: 3 });
    expect([0, 1, 2, 3].map((r) => normalizeRotation('vacuum', r as Rotation))).toEqual([0, 1, 2, 3]);
  });
  it('plus laser is fully symmetric 3x3', () => {
    expect(rotatedSize('laser', 1)).toEqual({ w: 3, h: 3 });
    expect(normalizeRotation('laser', 3)).toBe(0);
  });
  it('odd shapes nest: S microwave tucks its notch under a Z cooker', () => {
    const inv = { cols: 6, rows: 4, placed: [{ uid: 'a', type: 'microwave', x: 0, y: 0, rot: 0 }], shelf: [] } as unknown as Inventory;
    expect(canPlace(inv, 'microwave', 1, 0, 0).ok).toBe(false); // overlaps
    expect(canPlace(inv, 'cooker', 0, 1, 0).ok).toBe(false); // Z bar hits S bottom row
    expect(canPlace(inv, 'cooker', 3, 0, 0).ok).toBe(true); // fits beside S
    expect(canPlace(inv, 'laser', 4, 2, 0).ok).toBe(false); // plus sticks out of cart
    expect(canPlace(inv, 'laser', 3, 1, 0).ok).toBe(true);
  });
  it('normalizeRotation maps 180/270 on lines', () => {
    expect(normalizeRotation('pan', 2)).toBe(0);
    expect(normalizeRotation('pan', 3)).toBe(1);
    expect(normalizeRotation('toaster', 2)).toBe(0);
    expect(normalizeRotation('battery', 3)).toBe(0);
  });
  it('rotateCells normalizes and footprint offsets by origin', () => {
    expect(rotateCells([{ x: 0, y: 0 }, { x: 0, y: 1 }], 1).sort((a, b) => a.x - b.x)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(footprint(it_('pan', 2, 1, 1)).map((c) => `${c.x},${c.y}`).sort()).toEqual(['2,1', '3,1', '4,1']);
  });
});

describe('placement', () => {
  it('rejects out of bounds', () => {
    expect(canPlace(inv(), 'toaster', 4, 0, 0)).toEqual({ ok: false, reason: "Doesn't fit there" });
    expect(canPlace(inv(), 'pan', 0, 2, 0).ok).toBe(false);
    expect(canPlace(inv(), 'pan', -1, 0, 0).ok).toBe(false);
    expect(canPlace(inv(), 'pan', 4, 1, 0).ok).toBe(true);
  });
  it('rejects overlap with a named reason, honors ignoreUid', () => {
    const f = it_('fuel', 1, 0);
    const i = inv(f);
    expect(canPlace(i, 'battery', 1, 1, 0)).toEqual({ ok: false, reason: 'Overlaps Fuel Can' });
    expect(canPlace(i, 'battery', 1, 1, 0, f.uid).ok).toBe(true);
  });
});

describe('adjacency', () => {
  it('diagonal / corner contact does not count', () => {
    expect(adjacentPairs([it_('battery', 0, 0), it_('hotsauce', 1, 1)])).toEqual([]);
  });
  it('shared edges dedupe to one pair, uid sorted', () => {
    const a = it_('toaster', 0, 0), b = it_('fan', 0, 1, 1); // fan 2x1 under toaster: 2 shared edges
    expect(adjacentPairs([b, a])).toEqual([[a.uid, b.uid]]);
  });
  it('double-edge contact does not double the buff', () => {
    const t = it_('toaster', 0, 0), h = it_('hotsauce', 0, 1), h2 = it_('hotsauce', 1, 1);
    expect(w0(inv(t, h)).damage).toBeCloseTo(9 * 1.25 * 1.06 * 1.1);
    expect(w0(inv(t, h, h2)).damage).toBeCloseTo(9 * 1.25 * 1.06 * 1.1);
    expect(w0(inv(it_('toaster', 0, 0), it_('fan', 0, 1, 1))).projectileSpeed).toBeCloseTo(540 * 1.3);
  });
  it('two identical fans on one toaster apply fan once', () => {
    const w = w0(inv(it_('toaster', 1, 1), it_('fan', 0, 1), it_('fan', 3, 1)));
    expect(w.buffs).toEqual(['fan']);
    expect(w.projectileSpeed).toBeCloseTo(540 * 1.3);
    expect(w.range).toBeCloseTo(455 * 1.3);
  });
});

describe('recipes', () => {
  // toaster (1,1)-(2,1); fan (0,1)-(0,2) left; fuel (3,1)-(3,2) right
  const toaster = () => it_('toaster', 1, 1);
  it('toastMode needs both fan and fuel adjacent to the toaster', () => {
    const b = computeBuild(inv(toaster(), it_('fan', 0, 1), it_('fuel', 3, 1)));
    const w = b.weapons[0];
    expect(w.recipes).toContain('toastMode');
    expect(w.count).toBe(3);
    expect(w.spreadDeg).toBe(22);
    expect(w.damage).toBeCloseTo(9 * 1.12 * 0.75);
    expect(w.burn).toEqual({ dps: 2.5, duration: 3, tick: 0.5 });
    expect(w.projectileSpeed).toBeCloseTo(540 * 1.3);
    expect(b.recipes).toHaveLength(1);
    expect(b.recipes[0].supportUids).toHaveLength(2);
  });
  it('toast mode with hot sauce = 7*1.25*bundle*0.6', () => {
    const w = w0(inv(toaster(), it_('fan', 0, 1), it_('fuel', 3, 1), it_('hotsauce', 1, 2)));
    expect(w.recipes).toContain('toastMode');
    expect(w.damage).toBeCloseTo(9 * 1.25 * 1.18 * 0.75 * 1.1);
  });
  it('only one support touching the toaster: no recipe even if supports touch each other', () => {
    // fan (0,1)-(0,2); fuel rotated horizontal at (0,3)-(1,3): touches fan, not the toaster
    const w = w0(inv(toaster(), it_('fan', 0, 1), it_('fuel', 0, 3, 1)));
    expect(w.recipes).toEqual([]);
    expect(w.count).toBe(1);
    expect(w.burn).toBeNull();
  });
  it('diagonal support gives no recipe', () => {
    const w = w0(inv(toaster(), it_('fan', 0, 1), it_('fuel', 3, 2)));
    expect(w.recipes).toEqual([]);
  });
  it('removing a support removes bonus and recipe', () => {
    const s = shopRun();
    s.inventory.placed = [it_('toaster', 1, 1), it_('fan', 0, 1), it_('fuel', 3, 1)];
    expect(moveItem(s, s.inventory.placed[2].uid, { where: 'shelf', slot: 0 }).ok).toBe(true);
    expect(s.build.weapons[0].recipes).toEqual([]);
    expect(s.build.weapons[0].burn).toBeNull();
    expect(sellItem(s, s.inventory.placed[1].uid).ok).toBe(true);
    expect(s.build.weapons[0].buffs).toEqual([]);
  });
  it('cold storage replaces ice slow with exactly 0.5', () => {
    const w = w0(inv(it_('vacuum', 0, 0), it_('ice', 2, 0)));
    expect(w.recipes).toContain('coldStorage');
    expect(w.frostRing).toBe(true);
    expect(w.slow).toEqual({ pct: 0.5, duration: 1.5 });
    expect(w0(inv(it_('pan', 0, 0), it_('ice', 1, 0))).slow).toEqual({ pct: 0.25, duration: 1 });
  });
  it('nailstorm and express checkout', () => {
    const nl = w0(inv(it_('nailgun', 1, 1), it_('magnet', 0, 1), it_('battery', 3, 1)));
    expect(nl.recipes).toContain('nailstorm');
    expect(nl.pierce).toBe(1);
    expect(nl.homing).toBe(true);
    expect(nl.cooldown).toBeCloseTo(1.1 / batE / 1.08);
    const p = w0(inv(it_('pan', 0, 0), it_('bell', 1, 0)));
    expect(p.recipes).toContain('expressCheckout');
    expect(p.expressSweep).toBe(true);
  });
  it('running boot scales dash distance and damage by tier', () => {
    const t = (tier: number) => computeBuild(inv({ ...it_('boot', 0, 0), tier } as ItemInstance));
    expect(t(1).shoveDistMult).toBeCloseTo(1.35); expect(t(2).shoveDistMult).toBeCloseTo(1.525);
    expect(t(1).shoveDamage).toBe(12); expect(t(2).shoveDamage).toBe(15);
  });
  it('supports shared across weapons and globals do not stack', () => {
    const b = computeBuild(inv(it_('pan', 0, 0), it_('bell', 1, 1), it_('pan', 2, 0), it_('bell', 4, 0), it_('lunchbox', 0, 3), it_('magnet', 4, 3), it_('vacuum', 2, 2)));
    expect(b.weapons.filter((w) => w.recipes.includes('expressCheckout'))).toHaveLength(2);
    expect(b.shoveCooldown).toBe(2.5);
    expect(b.maxHp).toBe(55);
    expect(b.pickupRadius).toBe(70 + 60 + 60);
  });
  it('shelf items give nothing', () => {
    const i = inv(it_('toaster', 0, 0));
    i.shelf[0] = it_('lunchbox', 0, 0);
    expect(computeBuild(i).maxHp).toBe(40);
  });
});

describe('run state ops', () => {
  it('createRun defaults: one starter weapon', () => {
    const s = createRun(5);
    expect(s.inventory.placed.map((p) => [p.uid, p.type])).toEqual([['i1', 'toaster']]);
    expect(s.inventory.shelf).toEqual([null, null, null, null]);
    expect(s.build.weapons).toHaveLength(1);
    expect(s.hp).toBe(40);
    expect(s.weapon).toBe('toaster');
    const p = createRun(5, 'pan', 0, 'pan');
    expect(p.inventory.placed.map((i) => [i.type, i.x, i.y])).toEqual([['pan', STARTER_WEAPONS.pan.x, STARTER_WEAPONS.pan.y]]);
    expect([p.starter, p.weapon]).toEqual(['pan', 'pan']);
    const lc = createRun(5, 'pan');
    expect([lc.starter, lc.weapon, lc.inventory.placed[0].type, lc.build.maxHp]).toEqual(['pan', 'toaster', 'toaster', PLAYER.maxHp + 5]);
  });
  it('shop 1 guarantees the starting weapon\'s two suggested items', () => {
    for (const [weapon, want] of [['toaster', ['fan', 'fuel']], ['pan', ['bell', 'hotsauce']]] as const) {
      expect(STARTER_WEAPONS[weapon].guarantee).toEqual(want);
      const s = createRun(1, 'coupon', 0, weapon);
      const types = rollOffers(s, mulberry32(3), 1).map((o) => o.type);
      for (const t of want) expect(types).toContain(t);
    }
  });
  it('every character applies its perk to money and max HP, any weapon', () => {
    for (const [id, st] of Object.entries(PLAYER.starters) as [keyof typeof PLAYER.starters, (typeof PLAYER.starters)[keyof typeof PLAYER.starters]][]) {
      for (const w of Object.keys(STARTER_WEAPONS) as (keyof typeof STARTER_WEAPONS)[]) {
        const s = createRun(1, id, 0, w);
        expect(s.inventory.placed.map((p) => p.type)).toEqual([w]);
        expect(s.money).toBe(PLAYER.startMoney + (st.perk?.startMoney ?? 0));
        expect(s.build.maxHp).toBe(PLAYER.maxHp + (st.perk?.maxHp ?? 0));
        expect(s.build.moveSpeedMult).toBeCloseTo(st.perk?.moveSpeedMult ?? 1);
        expect(s.hp).toBe(s.build.maxHp);
      }
    }
    expect(createRun(1, 'coupon').build.maxHp).toBe(PLAYER.maxHp + PLAYER.starters.coupon.perk!.maxHp!);
  });
  it('frying pan hits for 9', () => {
    expect(ITEMS.pan.weapon!.damage).toBe(9);
    expect(w0(inv(it_('pan', 0, 0))).damage).toBeCloseTo(9);
  });
  it('night perk shifts the build; weapons scale by damageMult', () => {
    const perk = PLAYER.starters.night.perk!, i = inv(it_('vacuum', 1, 1));
    const base = computeBuild(i), b = computeBuild(i, perk);
    expect(b.shoveCooldown).toBeCloseTo(PLAYER.shove.cooldown + perk.shoveCooldown!);
    expect(b.shoveDamage).toBe(PLAYER.shove.damage);
    expect(b.moveSpeedMult).toBeCloseTo(perk.moveSpeedMult!);
    expect(b.weapons[0].damage).toBeCloseTo(base.weapons[0].damage * perk.damageMult!);
  });
  it('coupon priceMult lowers rolled prices', () => {
    const m = PLAYER.starters.coupon.perk!.priceMult!;
    const r = createRun(1, 'toaster'), b = rollOffers(r, mulberry32(3), 2), a = rollOffers({ ...r, starter: 'coupon' }, mulberry32(3), 2);
    expect(a.map((o) => o.type)).toEqual(b.map((o) => o.type));
    a.forEach((o, k) => expect(o.price).toBe(Math.max(1, Math.round(b[k].price * m))));
    expect(a.some((o, k) => o.price < b[k].price)).toBe(true);
  });
  it('starterUnlocked: base starters open, others gated by UNLOCKS', () => {
    expect(starterUnlocked('toaster') && starterUnlocked('pan')).toBe(true);
    const u = UNLOCKS.find((x) => x.kind === 'starter' && x.starter === 'night')!, had = profile.unlocked.includes(u.id);
    profile.unlocked = profile.unlocked.filter((x) => x !== u.id);
    expect(starterUnlocked('night')).toBe(false);
    profile.unlocked.push(u.id);
    expect(starterUnlocked('night')).toBe(true);
    if (!had) profile.unlocked = profile.unlocked.filter((x) => x !== u.id);
  });
  it('invalid move rolls back', () => {
    const s = shopRun();
    const before = structuredClone(s);
    expect(moveItem(s, 'i1', { where: 'grid', x: 4, y: 3, rot: 0 }).ok).toBe(false);
    expect(moveItem(s, 'i1', { where: 'grid', x: 3, y: 0, rot: 0 }).ok).toBe(false); // overlaps pan
    expect(moveItem(s, 'nope', { where: 'shelf', slot: 0 }).ok).toBe(false);
    expect(s).toEqual(before);
  });
  it('moving during combat is rejected', () => {
    const s = createRun(1);
    s.phase = 'combat';
    const before = structuredClone(s);
    expect(moveItem(s, 'i1', { where: 'shelf', slot: 0 })).toEqual({ ok: false, reason: "Can't rearrange during combat" });
    expect(s).toEqual(before);
  });
  it('previewMove does not mutate', () => {
    const s = shopRun();
    const before = structuredClone(s);
    const p = previewMove(s, 'i1', { where: 'shelf', slot: 0 });
    expect(p.result.ok).toBe(true);
    expect(p.build!.weapons).toHaveLength(1);
    expect(s).toEqual(before);
  });
  it('purchase deducts exactly price; blocked purchases change nothing', () => {
    const s = shopRun();
    s.shop!.offers[0].type = 'fan';
    const o = s.shop!.offers[0];
    const before = structuredClone(s);
    expect(buyOffer(s, 0)).toEqual({ ok: false, reason: `Need ${o.price} more coins` });
    expect(s).toEqual(before);
    s.money = 100;
    expect(buyOffer(s, 0).ok).toBe(true);
    expect(s.money).toBe(100 - o.price);
    expect(s.shop!.offers[0].sold).toBe(true);
    expect(s.inventory.shelf[0]!.type).toBe(o.type);
    expect(buyOffer(s, 0).ok).toBe(false);
    expect(s.money).toBe(100 - o.price);
  });
  it('buying a copy of an owned item never merges on its own: it lands on the shelf', () => {
    const s = shopRun();
    s.money = 100;
    s.shop!.offers[0] = { ...s.shop!.offers[0], type: 'toaster', tier: 1, price: 10, sold: false };
    expect(mergeTargetFor(s.inventory, 'toaster', 1)?.uid).toBe('i1'); // the shop still hints at the combine
    expect(buyOffer(s, 0).ok).toBe(true);
    expect(s.inventory.placed.find((p) => p.type === 'toaster')!.tier ?? 1).toBe(1);
    expect(s.inventory.shelf[0]).toMatchObject({ type: 'toaster', tier: 1 });
    s.inventory.shelf = [0, 1, 2, 3].map(() => it_('battery', 0, 0));
    s.shop!.offers[1] = { ...s.shop!.offers[1], type: 'pan', tier: 1, price: 10, sold: false };
    expect(buyOffer(s, 1).ok).toBe(false); // full shelf blocks even a combinable buy
  });
  it('full shelf blocks purchase', () => {
    const s = shopRun();
    s.money = 100;
    s.inventory.shelf = [0, 1, 2, 3].map(() => it_('battery', 0, 0));
    s.shop!.offers[1].type = 'fan';
    const before = structuredClone(s);
    expect(buyOffer(s, 1).ok).toBe(false);
    expect(s).toEqual(before);
  });
  it('sell = floor(price/2) and money invariant', () => {
    expect(sellPrice('pan')).toBe(5);
    expect(sellPrice('bell')).toBe(3);
    const s = shopRun();
    s.money = 10;
    expect(sellItem(s, 'i1').ok).toBe(true);
    expect(s.money).toBe(10 + Math.floor(ITEMS.toaster.price / 2));
    expect(s.build.weapons).toHaveLength(1);
    expect(sellItem(s, 'i1').ok).toBe(false);
  });
  it('reroll cost 2,4,6 then resets on a new shop', () => {
    const s = shopRun();
    s.money = 100;
    const rng = mulberry32(9);
    for (const c of [2, 4, 6]) {
      const m = s.money;
      expect(rerollCost(s.shop!.rerolls, s.shop!.shopIndex)).toBe(c);
      expect(reroll(s, rng).ok).toBe(true);
      expect(s.money).toBe(m - c);
    }
    expect(s.shop!.rerolls).toBe(3);
    s.wave = 2;
    openShop(s, rng);
    expect(rerollCost(s.shop!.rerolls, s.shop!.shopIndex)).toBe(2);
    s.money = 1;
    const before = structuredClone(s);
    expect(reroll(s, rng).ok).toBe(false);
    expect(s).toEqual(before);
  });
  it('repair once per shop', () => {
    const s = shopRun();
    s.money = 100;
    expect(repair(s)).toEqual({ ok: false, reason: 'Already at full health' });
    s.hp = 10;
    expect(repair(s).ok).toBe(true);
    expect(s.hp).toBe(20);
    expect(s.money).toBe(92);
    expect(repair(s).ok).toBe(false);
    expect(s.hp).toBe(20);
  });
  it('lunchbox exploit: never heals, clamps down', () => {
    const s = shopRun();
    s.inventory.shelf[0] = it_('lunchbox', 0, 0);
    const lb = s.inventory.shelf[0].uid;
    const put = () => moveItem(s, lb, { where: 'grid', x: 0, y: 3, rot: 0 });
    expect(put().ok).toBe(true);
    expect([s.hp, s.build.maxHp]).toEqual([40, 55]);
    moveItem(s, lb, { where: 'shelf', slot: 0 });
    expect([s.hp, s.build.maxHp]).toEqual([40, 40]);
    put();
    expect(s.hp).toBe(40);
    s.hp = 48; // damaged-then-healed past base cannot happen normally; simulate full 50 hp
    moveItem(s, lb, { where: 'shelf', slot: 0 });
    expect(s.hp).toBe(40);
  });
  it('damagePlayer sets defeat', () => {
    const s = createRun(1);
    expect(damagePlayer(s, 10)).toBe(false);
    expect(damagePlayer(s, 100)).toBe(true);
    expect([s.hp, s.phase]).toEqual([0, 'defeat']);
  });
});

describe('shop rolls', () => {
  it('shop 1 has fan + fuel and 4 distinct types', () => {
    for (let seed = 0; seed < 50; seed++) {
      const types = rollOffers(createRun(1), mulberry32(seed), 1).map((o) => o.type);
      expect(types).toHaveLength(4);
      expect(types).toContain('fan');
      expect(types).toContain('fuel');
      expect(new Set(types).size).toBe(4);
    }
  });
  it('no duplicate types across 200 seeded rolls', () => {
    const s = createRun(1);
    for (let seed = 0; seed < 200; seed++) {
      const o = rollOffers(s, mulberry32(seed), 2 + (seed % 5));
      expect(o).toHaveLength(4);
      expect(new Set(o.map((x) => x.type)).size).toBe(4);
    }
  });
});

describe('hit policy', () => {
  it('toast hits once total', () => {
    const t = newHitTracker(1);
    expect(tryHit(t, 1)).toBe(true);
    expect(isSpent(t)).toBe(true);
    expect(tryHit(t, 2)).toBe(false);
  });
  it('sweep hits each enemy once per swing', () => {
    const t = newHitTracker(Infinity);
    expect(tryHit(t, 1)).toBe(true);
    expect(tryHit(t, 1)).toBe(false);
    expect(tryHit(t, 2)).toBe(true);
    expect(isSpent(t)).toBe(false);
  });
  it('pierce 1 nail hits 2 distinct enemies max', () => {
    const t = newHitTracker(1 + 1);
    expect([tryHit(t, 1), tryHit(t, 1), tryHit(t, 2), tryHit(t, 3)]).toEqual([true, false, true, false]);
  });
  it('burn: no dps stacking, fixed ticks, refresh extends', () => {
    const burn = { dps: 2, duration: 2, tick: 0.5 };
    let s = newStatus();
    applyBurn(s, burn, 0);
    let total = 0;
    for (let i = 1; i <= 50; i++) total += tickBurn(s, i / 10);
    expect(total).toBeCloseTo(4);
    s = newStatus(); total = 0;
    applyBurn(s, burn, 0);
    for (let i = 1; i <= 50; i++) {
      const t = i / 10;
      total += tickBurn(s, t);
      if (i === 10) { applyBurn(s, burn, 1); applyBurn(s, { ...burn, dps: 1 }, 1); }
    }
    expect(total).toBeCloseTo(6);
    expect(s.burnDps).toBe(2);
    expect(tickBurn(s, 100)).toBe(0);
  });
  it('slow keeps stronger pct, never sums, expires', () => {
    const s = newStatus();
    applySlow(s, { pct: 0.4, duration: 1.5 }, 0);
    applySlow(s, { pct: 0.25, duration: 1 }, 1);
    expect(s.slowPct).toBe(0.4);
    expect(slowFactor(s, 1.2)).toBeCloseTo(0.6);
    applySlow(s, { pct: 0.4, duration: 1.5 }, 1.2);
    expect(s.slowPct).toBe(0.4);
    expect(slowFactor(s, 2.6)).toBeCloseTo(0.6);
    expect(slowFactor(s, 2.8)).toBe(1);
  });
});

const mk = (type: ItemTypeId, x: number, y: number, tier: number, rot: Rotation = 0): ItemInstance => ({ ...it_(type, x, y, rot), tier });

describe('tiers', () => {
  it('L-shapes have 4 distinct rotations', () => {
    for (const t of ['mop', 'pricegun'] as ItemTypeId[]) {
      const keys = new Set([0, 1, 2, 3].map((r) => JSON.stringify(rotateCells(ITEMS[t].cells, r as Rotation).map((c) => `${c.x},${c.y}`).sort())));
      expect(keys.size).toBe(4);
      for (const r of [0, 1, 2, 3] as Rotation[]) expect(normalizeRotation(t, r)).toBe(r);
    }
  });
  it('weapon tier scales damage and cooldown; sell price uses tier', () => {
    const w = w0(inv(mk('toaster', 0, 0, 2)));
    expect(w.damage).toBeCloseTo(9 * 1.5);
    expect(w.cooldown).toBeCloseTo(ITEMS.toaster.weapon!.cooldown * 0.9);
    expect(sellPrice('toaster', 2)).toBe(12);
  });
  it('merge rejects bad pairs, state unchanged', () => {
    const s = shopRun();
    s.inventory.shelf[0] = it_('fan', 0, 0);
    s.inventory.shelf[1] = mk('fan', 0, 0, 2);
    s.inventory.shelf[2] = mk('fan', 0, 0, 3);
    s.inventory.shelf[3] = mk('fan', 0, 0, 3);
    const [a, b, c, d] = s.inventory.shelf.map((x) => x!.uid);
    const before = structuredClone(s);
    expect(mergeItems(s, 'i1', 'i2').ok).toBe(false); // different type
    expect(mergeItems(s, a, b)).toEqual({ ok: false, reason: 'Tiers must match' });
    expect(mergeItems(s, c, d)).toEqual({ ok: false, reason: 'Already max tier' });
    expect(mergeItems(s, a, a).ok).toBe(false);
    expect(s).toEqual(before);
    s.phase = 'combat';
    expect(mergeItems(s, a, b).ok).toBe(false);
  });
  it('merge frees cells, keeps target position, recomputes', () => {
    const s = shopRun();
    s.inventory.shelf[0] = it_('toaster', 0, 0);
    const sh = s.inventory.shelf[0]!.uid;
    expect(previewMerge(s, sh, 'i1').build!.weapons.find((w) => w.uid === 'i1')!.damage).toBeGreaterThan(10);
    expect(s.inventory.shelf[0]).not.toBeNull();
    expect(mergeItems(s, sh, 'i1').ok).toBe(true);
    expect(s.inventory.shelf[0]).toBeNull();
    const t = s.inventory.placed.find((p) => p.uid === 'i1')!;
    expect([t.x, t.y, t.tier]).toEqual([1, 1, 2]);
    expect(s.build.weapons.find((w) => w.uid === 'i1')!.damage).toBeCloseTo(9 * 1.5 * 1.1);
    // dragged placed item frees its cells
    const s2 = shopRun();
    s2.inventory.placed.push(it_('toaster', 0, 3));
    const dragged = s2.inventory.placed[2].uid;
    expect(mergeItems(s2, dragged, 'i1').ok).toBe(true);
    expect(canPlace(s2.inventory, 'toaster', 0, 3, 0).ok).toBe(true);
  });
  it('upgradeItem charges exactly, refuses short money / max tier, atomic', () => {
    const s = shopRun();
    s.money = 11;
    const before = structuredClone(s);
    expect(upgradeItem(s, 'i1')).toEqual({ ok: false, reason: 'Need 1 more coins' });
    expect(s).toEqual(before);
    s.money = 30;
    expect(upgradeItem(s, 'i1').ok).toBe(true);
    expect(s.money).toBe(18);
    expect(s.build.weapons.find((w) => w.uid === 'i1')!.tier).toBe(2);
    expect(upgradeCost(s.inventory.placed.find((p) => p.uid === 'i1')!)).toBe(24);
    s.money = 100;
    expect(upgradeItem(s, 'i1').ok).toBe(true);
    const b2 = structuredClone(s);
    expect(upgradeItem(s, 'i1')).toEqual({ ok: false, reason: 'Already max tier' });
    expect(s).toEqual(b2);
  });
  it('max-tier fan is +60%; highest tier module wins; no stacking', () => {
    expect(w0(inv(it_('toaster', 1, 1), mk('fan', 0, 1, 3))).projectileSpeed).toBeCloseTo(540 * 1.6);
    const w = w0(inv(it_('toaster', 1, 1), it_('fan', 0, 1), mk('fan', 3, 1, 2)));
    expect(w.projectileSpeed).toBeCloseTo(540 * 1.45);
    expect(w.buffs).toEqual(['fan']);
  });
  it('price gun crit once, ★2 = 0.225', () => {
    expect(w0(inv(it_('pan', 0, 0), it_('pricegun', 1, 0), it_('pricegun', 1, 2, 0))).critChance).toBeCloseTo(0.15);
    expect(w0(inv(it_('pan', 0, 0), mk('pricegun', 1, 0, 2))).critChance).toBeCloseTo(0.225);
  });
  it('tape pierce + nailstorm = 2; tape on laser does nothing', () => {
    const w = w0(inv(it_('nailgun', 1, 1), it_('magnet', 0, 1), it_('battery', 3, 1), it_('tape', 1, 2)));
    expect(w.recipes).toContain('nailstorm');
    expect(w.pierce).toBe(2);
    expect(w0(inv(mk('laser', 0, 0, 1), it_('tape', 2, 0))).range).toBeCloseTo(620 * 1.2);
  });
  it('brain freeze slow replaces ice (0.4)', () => {
    const w = w0(inv(it_('blender', 0, 0), it_('ice', 1, 0)));
    expect(w.recipes).toContain('brainFreeze');
    expect(w.slow).toEqual({ pct: 0.4, duration: 0.6 });
    expect(w.range).toBeCloseTo(85 * 1.25);
  });
  it('tvDinner exact', () => {
    const ok = w0(inv(it_('microwave', 1, 1), it_('lunchbox', 1, 0), it_('battery', 3, 1)));
    expect(ok.recipes).toContain('tvDinner');
    expect(ok.chain).toBe(1);
    expect(ok.cooldown).toBeCloseTo(2.4 / batE * 0.92);
    expect(w0(inv(it_('microwave', 1, 1), it_('lunchbox', 1, 0))).recipes).toEqual([]);
  });
  it('clearanceSale needs both', () => {
    const both = w0(inv(it_('fizz', 1, 1), it_('pricegun', 1, 2, 0), it_('coupon', 3, 1)));
    expect(both.recipes).toContain('clearanceSale');
    expect(both.bounces).toBe(4);
    expect(both.critCoin).toBe(true);
    expect(w0(inv(it_('fizz', 1, 1), it_('coupon', 3, 1))).recipes).toEqual([]);
  });
  it('grease fire only via recipe; toaster fuel burns 2.5', () => {
    expect(w0(inv(it_('mop', 0, 0))).burn).toBeNull();
    const mop = w0(inv(it_('mop', 0, 0), it_('fuel', 1, 0)));
    expect(mop.recipes).toContain('greaseFire');
    expect(mop.burn).toEqual({ dps: 5, duration: 2, tick: 0.5 });
    expect(w0(inv(it_('mop', 0, 0), mk('fuel', 1, 0, 3))).burn!.dps).toBeCloseTo(10);
    expect(w0(inv(it_('toaster', 0, 0), it_('fuel', 2, 0))).burn!.dps).toBe(2.5);
  });
  it('bubble wrap armor: 1 damage still deals 1', () => {
    const s = createRun(1);
    s.inventory.placed.push(it_('bubblewrap', 0, 3));
    s.build = computeBuild(s.inventory);
    expect(s.build.armor).toBe(1);
    damagePlayer(s, 1);
    expect(s.hp).toBe(39);
    damagePlayer(s, 5);
    expect(s.hp).toBe(35);
  });
  it('combat helpers', () => {
    const c = [{ id: 1, x: 10, y: 0 }, { id: 2, x: 5, y: 0 }, { id: 3, x: 50, y: 0 }];
    expect(pickRicochetTarget({ x: 0, y: 0 }, c, new Set(), 20)!.id).toBe(2);
    expect(pickRicochetTarget({ x: 0, y: 0 }, c, new Set([2]), 20)!.id).toBe(1);
    expect(pickRicochetTarget({ x: 0, y: 0 }, c, new Set([1, 2]), 20)).toBeNull();
    expect(rollCrit(0.5, () => 0.4)).toBe(true);
    expect(rollCrit(0.5, () => 0.5)).toBe(false);
    expect(rollCrit(0, () => 0)).toBe(false);
  });
});

describe('legendaries / bundle / shop levels', () => {
  it('bundle counts distinct adjacent types, goldstar +1', () => {
    // pan (0,0)-(0,2); two fans (1,0),(1,1)? fan is 1x2: one fan at (1,0)-(1,1), another at (2,.) not touching
    const two = w0(inv(it_('pan', 0, 0), it_('fan', 1, 0), it_('fan', 1, 2)));
    expect(two.bundle).toBe(1);
    const mix = w0(inv(it_('pan', 0, 0), it_('fan', 1, 0), it_('battery', 1, 2), it_('toaster', 0, 3, 0)));
    expect(mix.bundle).toBe(3);
    expect(w0(inv(it_('pan', 0, 0), it_('goldstar', 1, 0))).bundle).toBe(2);
    expect(w0(inv(it_('pan', 0, 0), it_('goldstar', 1, 0))).damage).toBeCloseTo(9 * 1.12);
    expect(w0(inv(it_('pan', 0, 0))).bundle).toBe(0);
  });
  it('powerstrip: global vs adjacent, never both, stacks with battery', () => {
    const far = computeBuild(inv(it_('toaster', 0, 0), it_('powerstrip', 0, 3), it_('powerstrip', 2, 3)));
    expect(far.weapons[0].cooldown).toBeCloseTo(ITEMS.toaster.weapon!.cooldown / BUFFS.powerstripAll);
    const near = w0(inv(it_('toaster', 0, 1), it_('powerstrip', 0, 0), it_('powerstrip', 0, 2)));
    expect(near.cooldown).toBeCloseTo(ITEMS.toaster.weapon!.cooldown / BUFFS.powerstripAdjacent);
    const bat = w0(inv(it_('toaster', 0, 1), it_('powerstrip', 0, 0), it_('battery', 2, 1)));
    expect(bat.cooldown).toBeCloseTo(ITEMS.toaster.weapon!.cooldown / BUFFS.powerstripAdjacent / batE / 1.08);
    expect(w0(inv(it_('pan', 0, 0), it_('powerstrip', 1, 0))).cooldown).toBeCloseTo(1.15);
  });
  it('goldstar boosts adjacent fan only', () => {
    const adj = w0(inv(it_('toaster', 1, 1), mk('fan', 0, 1, 3), it_('goldstar', 0, 3)));
    expect(adj.projectileSpeed).toBeCloseTo(540 * 1.75);
    const nonAdj = w0(inv(it_('toaster', 1, 1), mk('fan', 0, 1, 3), it_('goldstar', 4, 3)));
    expect(nonAdj.projectileSpeed).toBeCloseTo(540 * 1.6);
  });
  it('goldstar lunchbox hp = round(15*1.5)=23, no heal', () => {
    const s = shopRun();
    s.inventory.shelf[0] = it_('lunchbox', 0, 0);
    s.inventory.shelf[1] = it_('goldstar', 0, 0);
    expect(moveItem(s, s.inventory.shelf[0]!.uid, { where: 'grid', x: 0, y: 2, rot: 0 }).ok).toBe(true);
    expect(s.build.maxHp).toBe(55);
    expect(moveItem(s, s.inventory.shelf[1]!.uid, { where: 'grid', x: 0, y: 3, rot: 0 }).ok).toBe(true);
    expect(s.build.maxHp).toBe(40 + 23);
    expect(s.hp).toBe(40);
  });
  it('snackbag and laser', () => {
    const b = computeBuild(inv(it_('snackbag', 0, 0), it_('laser', 3, 0)));
    expect(b.maxHp).toBe(60);
    expect(b.regen).toBe(0.25);
    expect(b.weapons[0].pattern).toBe('laser');
    expect(w0(inv(it_('laser', 0, 0), it_('fan', 2, 0))).projectileSpeed).toBe(0);
  });
  it('legendary cannot upgrade or merge', () => {
    const s = shopRun();
    s.money = 999;
    s.inventory.shelf[0] = it_('laser', 0, 0);
    s.inventory.shelf[1] = it_('laser', 0, 0);
    const [a, b] = [s.inventory.shelf[0]!.uid, s.inventory.shelf[1]!.uid];
    const before = structuredClone(s);
    expect(upgradeItem(s, a)).toEqual({ ok: false, reason: "Legendaries can't be upgraded" });
    expect(mergeItems(s, a, b).ok).toBe(false);
    expect(upgradeCost(s.inventory.shelf[0]!)).toBeNull();
    expect(s).toEqual(before);
  });
  it('upgradeShop costs exactly, refused at max / short, atomic', () => {
    const s = shopRun();
    s.money = 19;
    const before = structuredClone(s);
    expect(upgradeShop(s).ok).toBe(false);
    expect(s).toEqual(before);
    s.money = 150;
    for (const c of [20, 35, 55]) { const m = s.money; expect(upgradeShop(s).ok).toBe(true); expect(s.money).toBe(m - c); }
    expect(s.shopLevel).toBe(4);
    const b2 = structuredClone(s);
    expect(upgradeShop(s).ok).toBe(false);
    expect(s).toEqual(b2);
  });
  it('level 4 rolls: legendaries only from shop 2, unique, priced by tier', () => {
    const s = createRun(1);
    s.shopLevel = 4;
    let legends = 0, t3 = 0;
    for (let seed = 0; seed < 300; seed++) {
      for (const idx of [1, 2, 5]) {
        const o = rollOffers(s, mulberry32(seed), idx);
        expect(new Set(o.map((x) => x.type)).size).toBe(4);
        for (const x of o) {
          const base = Math.round(TIER.value(ITEMS[x.type].price, x.tier) * inflation(s, idx));
          expect(x.price).toBe(x.double ? Math.round(base * ECONOMY.doublePackPriceMult) : base); // double pack: x1.5 on the rounded price
          if (ITEMS[x.type].legendary) { legends++; expect(idx).toBeGreaterThanOrEqual(2); expect(x.tier).toBe(1); }
          if (x.tier === 3) t3++;
        }
        if (idx === 1) expect(o.slice(0, 2).map((x) => [x.type, x.tier])).toEqual([['fan', 1], ['fuel', 1]]);
      }
    }
    expect(legends).toBeGreaterThan(0);
    expect(t3).toBeGreaterThan(0);
  });
  it('all 25 types: no duplicates across 200 rolls', () => {
    const s = createRun(1);
    for (let seed = 0; seed < 200; seed++) expect(new Set(rollOffers(s, mulberry32(seed), 3).map((o) => o.type)).size).toBe(4);
  });
  it('free reroll once per shop at level 3+', () => {
    const s = shopRun();
    s.shopLevel = 3;
    s.money = 10;
    expect(currentRerollCost(s)).toBe(0);
    const rng = mulberry32(3);
    expect(reroll(s, rng).ok).toBe(true);
    expect([s.money, s.shop!.rerolls, s.shop!.freeRerollUsed]).toEqual([10, 0, true]);
    expect(currentRerollCost(s)).toBe(2);
    expect(reroll(s, rng).ok).toBe(true);
    expect([s.money, s.shop!.rerolls]).toEqual([8, 1]);
    s.shopLevel = 1;
    const s1 = shopRun();
    expect(currentRerollCost(s1)).toBe(2);
  });
});

describe('departments and routes', () => {
  const shopAt = (wave: number, mod: RunState['modifier'] = 'none', lv = 1, theme: RunState['theme'] = 'main'): RunState => {
    const s = createRun(1, 'toaster', 0, 'toaster', theme);
    s.wave = wave; s.modifier = mod; s.shopLevel = lv;
    openShop(s, mulberry32(1));
    return s;
  };
  it('aisle 1 is the chosen theme with no modifier', () => {
    expect([createRun(3).department, createRun(3).route, createRun(3).mods, createRun(3).doors]).toEqual(['main', ['main'], ['none'], null]);
    const s = createRun(3, 'toaster', 0, 'toaster', 'bakery');
    expect([s.theme, s.department, s.modifier, s.route, s.mods]).toEqual(['bakery', 'bakery', 'none', ['bakery'], ['none']]);
  });
  it('doors are distinct modifiers from the pool; 2 vs 3 by loyalty', () => {
    for (let seed = 0; seed < 300; seed++) {
      const a = rollDoors(shopAt(2 + (seed % 4), 'none', 2), mulberry32(seed));
      const b = rollDoors(shopAt(2 + (seed % 4), 'none', 3), mulberry32(seed));
      expect(a).toHaveLength(2); expect(b).toHaveLength(3);
      expect(new Set(a).size).toBe(2); expect(new Set(b).size).toBe(3);
      for (const d of [...a, ...b]) expect([...DOOR_POOL, 'clearance', ...ROOM_DOORS]).toContain(d);
    }
  });
  it('clearance: never before shop 3, at most once, never after clearance, sometimes appears', () => {
    let seen = 0;
    for (let seed = 0; seed < 300; seed++) {
      for (const wave of [1, 2]) expect(rollDoors(shopAt(wave, 'none', 3), mulberry32(seed))).not.toContain('clearance');
      const d = rollDoors(shopAt(4, 'rush', 3), mulberry32(seed));
      expect(d.filter((x) => x === 'clearance').length).toBeLessThanOrEqual(1);
      if (d.includes('clearance')) seen++;
      expect(rollDoors(shopAt(4, 'clearance', 3), mulberry32(seed))).not.toContain('clearance');
    }
    expect(seen).toBeGreaterThan(30);
    expect(seen).toBeLessThan(130);
  });
  it('after shop 7 only the boss; same seed same doors; no mutation', () => {
    const s = shopAt(7, 'rush', 1, 'bakery');
    const before = structuredClone(s);
    expect(rollDoors(s, mulberry32(1))).toEqual(['boss']);
    expect(s).toEqual(before);
    const s2 = shopAt(4, 'none', 3);
    expect(rollDoors(s2, mulberry32(77))).toEqual(rollDoors(s2, mulberry32(77)));
  });
  it('leaveShop/chooseDoor flow; rejects bad ids and phases atomically', () => {
    const s = shopAt(2);
    const rng = mulberry32(5);
    const cd0 = structuredClone(s);
    expect(chooseDoor(s, 'rush').ok).toBe(false);
    expect(s).toEqual(cd0);
    expect(leaveShop(s, rng).ok).toBe(true);
    expect(s.phase).toBe('route');
    expect(s.doors).toHaveLength(2);
    expect(leaveShop(s, rng).ok).toBe(false);
    const before = structuredClone(s);
    expect(chooseDoor(s, 'boss').ok).toBe(false);
    expect(chooseDoor(s, 'frozen' as never).ok).toBe(false);
    expect(s).toEqual(before);
    const pick = s.doors![1];
    expect(chooseDoor(s, pick).ok).toBe(true);
    expect([s.department, s.modifier, s.route, s.mods, s.doors]).toEqual(['main', pick, ['main', 'main'], ['none', pick], null]);
    const t = createRun(1, 'toaster', 0, 'toaster', 'frozen');
    Object.assign(t, { phase: 'route', doors: ['boss'] });
    expect(chooseDoor(t, 'boss').ok).toBe(true);
    expect([t.department, t.modifier, t.route.at(-1), t.mods.at(-1)]).toEqual(['boss', 'none', 'boss', 'none']);
    startNextWave(s);
    expect([s.phase, s.wave]).toEqual(['combat', 3]);
  });
  it('forceLegendary guarantees a legendary at Lv1 / shop 3, incl. via the clearance modifier', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = createRun(1);
      s.wave = 3; s.modifier = 'clearance';
      openShop(s, mulberry32(seed));
      expect(s.shop!.forceLegendary).toBe(true);
      const o = s.shop!.offers;
      expect(o.some((x) => ITEMS[x.type].legendary)).toBe(true);
      expect(new Set(o.map((x) => x.type)).size).toBe(4);
    }
    const early = createRun(1);
    early.modifier = 'clearance';
    early.wave = 1;
    openShop(early, mulberry32(2));
    const t = early.shop!.offers.map((x) => x.type);
    expect(t).toContain('fan'); expect(t).toContain('fuel');
    expect(t.some((x) => ITEMS[x].legendary)).toBe(true);
  });
  it('bias and legendaryBonus carried by shop and rerolls', () => {
    const s = shopAt(3, 'none', 1, 'electronics');
    s.department = 'electronics';
    openShop(s, mulberry32(1));
    expect(s.shop!.bias).toContain('battery');
    expect(s.shop!.legendaryBonus).toBe(0.03);
    expect(s.shop!.forceLegendary).toBe(false);
    s.money = 100;
    expect(reroll(s, mulberry32(1)).ok).toBe(true);
    expect(s.shop!.bias).toContain('battery');
  });
  it('bias raises frequency of biased items', () => {
    const count = (bias: ItemTypeId[]) => {
      let n = 0;
      const s = createRun(1);
      for (let seed = 0; seed < 1500; seed++) n += rollOffers(s, mulberry32(seed), 3, false, { bias }).filter((o) => o.type === 'ice').length;
      return n;
    };
    expect(count(['ice'])).toBeGreaterThan(count([]) * 1.3);
  });
  it('killCoins mean ≈ base*mult', () => {
    for (const [base, mult] of [[1, 1.2], [2, 1.4], [1, 1.5], [2, 1]]) {
      const rng = mulberry32(42);
      let sum = 0;
      for (let i = 0; i < 5000; i++) sum += killCoins(base, mult, rng);
      expect(sum / 5000 / (base * mult)).toBeGreaterThan(0.97);
      expect(sum / 5000 / (base * mult)).toBeLessThan(1.03);
    }
    expect(killCoins(2, 1, () => 0.99)).toBe(2);
  });
  it('finishWave bonus scaled by the aisle modifier', () => {
    const s = createRun(1);
    s.modifier = 'rush';
    finishWave(s);
    expect(s.coinLog).toEqual([{ label: 'Wave clear bonus', amount: 15 }]);
    expect(s.money).toBe(15);
    const m = createRun(1);
    finishWave(m);
    expect(m.money).toBe(12);
  });
  it('themes are flat: no multipliers, rosters only reference real enemies', () => {
    expect(THEMES).toEqual(['main', 'frozen', 'bakery', 'electronics', 'checkout']);
    for (const id of THEMES) {
      const d = DEPARTMENTS[id];
      expect([d.hpMult, d.speedMult, d.countMult, d.coinMult]).toEqual([1, 1, 1, 1]);
      for (const k of Object.keys(d.mix)) expect(ENEMIES[k as keyof typeof ENEMIES]).toBeDefined();
    }
    expect(DEPARTMENTS.electronics.legendaryBonus).toBe(0.03);
    expect(enemyAppears('baguette').depts).toEqual(['bakery']);
    for (const id of CODEX_ENEMIES) expect(enemyAppears(id).depts.every((d) => THEMES.includes(d))).toBe(true);
  });
  it('waveSpawnPlan: theme roster boosts, basics stay at 1, everything else is off-theme', () => {
    const s = createRun(1);
    s.wave = 5; s.department = s.theme = 'frozen'; s.zone = null;
    const w = WAVES[4].mix, p = waveSpawnPlan(s);
    for (const [k, v] of Object.entries(w) as [keyof typeof w, number][]) {
      const boost = DEPARTMENTS.frozen.mix[k] ?? (DEPT_TUNING.basics.includes(k) ? 1 : DEPT_TUNING.offTheme);
      expect(p.mix[k]).toBeCloseTo(v * boost);
    }
    expect(DEPT_TUNING.offTheme).toBe(0.35);
    expect(p.total).toBe(WAVES[4].total);
    expect(p.hpScale).toBeCloseTo(WAVES[4].hpScale);
    s.wave = 1;
    expect(Object.keys(waveSpawnPlan(s).mix)).toEqual(['milk']);
    s.department = 'boss'; s.wave = 8;
    expect(waveSpawnPlan(s).total).toBe(6);
  });
  it('waveSpawnPlan: modifiers multiply count and hp on top', () => {
    const s = createRun(1);
    s.wave = 4;
    const base = waveSpawnPlan(s);
    s.modifier = 'rush';
    expect(waveSpawnPlan(s).total).toBe(Math.round(WAVES[3].total * 1.4));
    s.modifier = 'quiet';
    expect(waveSpawnPlan(s).total).toBe(Math.round(WAVES[3].total * 0.7));
    s.modifier = 'clearance';
    expect(waveSpawnPlan(s).hpScale).toBeCloseTo(base.hpScale * 1.15);
    expect(MODIFIERS.clearance.eliteBonus).toBe(0.15);
  });
  it('event modifier gives one free reroll in the next shop, then normal prices', () => {
    const s = createRun(1);
    s.wave = 2; s.modifier = 'event'; s.money = 100;
    openShop(s, mulberry32(1));
    expect(s.shop!.bonusFreeRerolls).toBe(1);
    expect(currentRerollCost(s)).toBe(0);
    expect(reroll(s, mulberry32(2)).ok).toBe(true);
    expect([s.money, s.shop!.bonusFreeRerolls, s.shop!.rerolls]).toEqual([100, 0, 0]);
    expect(currentRerollCost(s)).toBe(rerollCost(0, s.shop!.shopIndex));
    const n = createRun(1); n.wave = 2; openShop(n, mulberry32(1));
    expect(n.shop!.bonusFreeRerolls).toBe(0);
  });
  it('recordRun counts clearance modifier aisles as clearance clears', () => {
    profile.stats.deptClears = {};
    const s = createRun(1, 'toaster', 0, 'toaster', 'bakery');
    s.route = ['bakery', 'bakery', 'bakery']; s.mods = ['none', 'clearance', 'rush'];
    s.stats.wavesCleared = 2;
    recordRun(s, false);
    expect(profile.stats.deptClears).toEqual({ bakery: 2, clearance: 1 });
  });
  it('boss summons: themed pool exists for every theme and only uses real enemies', () => {
    for (const id of THEMES) {
      expect(THEME_SUMMONS[id]!.length).toBeGreaterThan(0);
      for (const e of THEME_SUMMONS[id]!) expect(ENEMIES[e]).toBeDefined();
    }
  });
});

describe('new enemies & boss variants', () => {
  it('egg, melon and slice have sane definitions', () => {
    expect(ENEMIES.egg.behavior).toBe('exploder');
    expect(ENEMIES.egg.tell).toBeGreaterThan(0);
    expect(ENEMIES.egg.attackDamage).toBeGreaterThan(0);
    expect(ENEMIES.melon.behavior).toBe('splitter');
    expect(ENEMIES.melon.hp).toBeGreaterThan(ENEMIES.slice.hp);
    expect(ENEMIES.slice.coins).toBe(0);
    expect(ENEMIES.slice.speed).toBeGreaterThan(ENEMIES.melon.speed);
  });
  it('wave mixes only reference defined enemies; egg/melon appear in later aisles', () => {
    for (const w of WAVES) for (const id of Object.keys(w.mix)) expect(ENEMIES[id as keyof typeof ENEMIES]).toBeDefined();
    expect(WAVES[4].mix.egg).toBeGreaterThan(0);
    expect(WAVES[5].mix.melon).toBeGreaterThan(0);
  });
  it('boss tuning: shift 0 equals BOSS, later shifts follow SHIFTS data', () => {
    expect(bossTuning(0)).toEqual(BOSS);
    expect(bossTuning(4)).toEqual({ ...BOSS, ...SHIFTS[4].boss });
    expect(bossTuning(4)).not.toEqual(BOSS);
    expect(bossTuning(4).volleyCount).toBeGreaterThan(BOSS.volleyCount);
  });
});

describe('shifts & overtime', () => {
  it('waveDef: regular waves pass through, overtime scales up and is never a boss', () => {
    expect(waveDef(1)).toBe(WAVES[0]);
    expect(waveDef(BOSS_WAVE)).toBe(WAVES[BOSS_WAVE - 1]);
    const a = waveDef(BOSS_WAVE + 3), b = waveDef(BOSS_WAVE + 4);
    expect(b.total).toBeGreaterThan(a.total);
    expect(b.hpScale).toBeGreaterThan(a.hpScale);
    expect(b.speedScale).toBeGreaterThanOrEqual(a.speedScale);
    expect(b.boss).toBe(false);
    expect(b.index).toBe(BOSS_WAVE + 4);
    expect(b.mix).toEqual(WAVES[BOSS_WAVE - 2].mix);
    expect(b.hpScale / a.hpScale).toBeCloseTo(OVERTIME.hpGrowth);
  });
  it('elites: chance table covers non-boss aisles; none early, none for boss/slice/egg', () => {
    expect(ELITE.chanceByAisle.length).toBe(WAVES.filter((w) => !w.boss).length);
    expect(ELITE.chanceByAisle[0]).toBe(0);
    expect(ELITE.chanceByAisle[1]).toBe(0);
    expect(eliteChance('milk', waveDef(3), 0)).toBe(ELITE.chanceByAisle[2]);
    expect(eliteChance('milk', waveDef(3), 2)).toBeCloseTo(ELITE.chanceByAisle[2] + 2 * ELITE.shiftBonus);
    expect(eliteChance('milk', waveDef(1), 4)).toBe(0);
    expect(eliteChance('milk', waveDef(BOSS_WAVE + 1), 0)).toBe(ELITE.overtimeChance);
    for (const id of ELITE_EXCLUDED) for (const w of [3, 6, BOSS_WAVE, BOSS_WAVE + 2]) expect(eliteChance(id, waveDef(w), 3)).toBe(0);
    expect(eliteChance('turkey', waveDef(BOSS_WAVE), 0)).toBe(0);
  });
  it('frozen turkey: tank in the later mixes only, frozen dept may boost it', () => {
    expect(ENEMIES.turkey.behavior).toBe('tank');
    expect(ENEMIES.turkey.hp).toBeGreaterThan(ENEMIES.soda.hp);
    const withTurkey = WAVES.filter((w) => w.mix.turkey).map((w) => w.index);
    expect(withTurkey.length).toBeGreaterThan(0);
    expect(Math.min(...withTurkey)).toBeGreaterThanOrEqual(4);
    expect(WAVES.filter((w) => w.boss || w.index < 4).every((w) => !w.mix.turkey)).toBe(true);
    for (const d of Object.values(DEPARTMENTS)) for (const id of Object.keys(d.mix)) expect(ENEMIES[id as keyof typeof ENEMIES]).toBeDefined();
  });
  it('waveSpawnPlan composes shift multipliers; shift 0 is neutral', () => {
    const s = createRun(1);
    s.wave = 3;
    const base = waveSpawnPlan(s);
    expect(SHIFTS[0].hpMult).toBe(1);
    s.shift = 2;
    const p = waveSpawnPlan(s), sh = SHIFTS[2];
    expect(p.hpScale).toBeCloseTo(base.hpScale * sh.hpMult);
    expect(p.speedScale).toBeCloseTo(base.speedScale * sh.speedMult);
    expect(p.total).toBe(Math.round(base.total * sh.countMult));
  });
  it('shift coin multiplier scales the wave clear bonus', () => {
    const a = createRun(1), b = createRun(1, 'toaster', SHIFTS.length - 1);
    finishWave(a); finishWave(b);
    expect(b.money - PLAYER.startMoney).toBe(Math.round(ECONOMY.waveClearBonus * SHIFTS[SHIFTS.length - 1].coinMult));
    expect(a.money - PLAYER.startMoney).toBe(ECONOMY.waveClearBonus);
  });
  it('overtime doors are never the boss; normal runs still get the boss door', () => {
    const s = createRun(1);
    s.wave = BOSS_WAVE - 1; s.phase = 'shop'; s.shop = { shopIndex: BOSS_WAVE - 1 } as never;
    expect(rollDoors(s, mulberry32(1))).toEqual(['boss']);
    s.overtime = true; s.shop = { shopIndex: BOSS_WAVE + 2 } as never;
    expect(rollDoors(s, mulberry32(1))).not.toContain('boss');
    expect(rollDoors(s, mulberry32(1)).every((d) => d in MODIFIERS)).toBe(true);
  });
  it('shift unlocks and recordRun bestShift', () => {
    profile.stats.bestShift = {};
    expect(shiftUnlocked('toaster', 0)).toBe(true);
    expect(shiftUnlocked('toaster', 1)).toBe(false);
    const s = createRun(1, 'pan', 1);
    recordRun(s, false);
    expect(profile.stats.bestShift.pan).toBeUndefined();
    s.stats.wavesCleared = BOSS_WAVE - 1;
    recordRun(s, true);
    expect(profile.stats.bestShift.pan).toBe(1);
    expect(shiftUnlocked('pan', 2)).toBe(true);
    expect(shiftUnlocked('pan', 3)).toBe(false);
    expect(shiftUnlocked('toaster', 2)).toBe(false);
    recordRun(createRun(1, 'pan', 0), true);
    expect(profile.stats.bestShift.pan).toBe(1);
    recordOvertime(3); recordOvertime(1);
    expect(profile.stats.bestOvertime).toBe(3);
  });
});

describe('aoe / multi-hit modules', () => {
  it('popper: adjacent only, tier scales', () => {
    expect(w0(inv(it_('pan', 0, 0), it_('popper', 1, 0))).popper).toEqual({ damage: 6, radius: 70 });
    expect(w0(inv(it_('pan', 0, 0), mk('popper', 1, 0, 3))).popper!.damage).toBeCloseTo(12);
    expect(w0(inv(it_('pan', 0, 0), it_('popper', 3, 3))).popper).toBeNull();
  });
  it('echo: 0.5 / 1.0, none for aura', () => {
    expect(w0(inv(it_('pan', 0, 0), it_('doublebag', 1, 0))).echo).toBe(0.5);
    expect(w0(inv(it_('pan', 0, 0), mk('doublebag', 1, 0, 2))).echo).toBe(0.75);
    expect(w0(inv(it_('pan', 0, 0), mk('doublebag', 1, 0, 3))).echo).toBe(1);
    const bl = w0(inv(it_('blender', 0, 0), it_('doublebag', 1, 0)));
    expect(bl.echo).toBe(0);
    expect(bl.buffs).not.toContain('echo');
  });
  it('multipack counts', () => {
    expect(w0(inv(it_('toaster', 1, 1), it_('multipack', 0, 1))).count).toBe(2);
    expect(w0(inv(it_('toaster', 1, 1), mk('multipack', 0, 1, 3))).count).toBe(3);
    const tm = w0(inv(it_('toaster', 1, 1), it_('fan', 0, 1), it_('fuel', 3, 1), it_('multipack', 1, 0)));
    expect(tm.recipes).toContain('toastMode');
    expect(tm.count).toBe(4);
    expect(w0(inv(it_('nailgun', 1, 1), it_('multipack', 0, 1))).count).toBe(4);
    expect(w0(inv(it_('pan', 0, 0), it_('multipack', 1, 0))).count).toBe(2);
    const lz = w0(inv(it_('laser', 0, 0), it_('multipack', 2, 0)));
    expect(lz.count).toBe(1);
    expect(lz.buffs).toContain('multipack');
    expect(lz.damage).toBeCloseTo(20 * 1.2 * 1.06);
  });
  it('fan ignores cone/mortar; tape adds arc/aoe', () => {
    const c = w0(inv(it_('cooker', 0, 0), it_('fan', 3, 0), it_('tape', 0, 1)));
    expect(c.projectileSpeed).toBe(380);
    expect(c.aoe).toBeCloseTo(90 * 1.2);
    expect(w0(inv(it_('spray', 0, 0), it_('tape', 1, 0))).arcDeg).toBe(100);
  });
  it('pressure point predicate and burn; spray + fuel gets no burn', () => {
    const w = w0(inv(it_('cooker', 0, 0), it_('fuel', 2, 0)));
    expect(w.recipes).toContain('pressurePoint');
    expect(w.firePool).toBe(true);
    expect(w.burn).toEqual({ dps: 2.5, duration: 3, tick: 0.5 });
    expect(w0(inv(it_('cooker', 0, 0))).firePool).toBe(false);
    const sp = w0(inv(it_('spray', 0, 0), it_('fuel', 1, 0)));
    expect(sp.burn!.dps).toBe(2.5); // universal fuel
    expect(sp.recipes).toEqual([]);
  });
  it('mist machine arc 120, range 238; tape +30', () => {
    const m = w0(inv(it_('spray', 0, 0), it_('fan', 1, 0)));
    expect(m.recipes).toContain('mistMachine');
    expect(m.arcDeg).toBe(120);
    expect(m.range).toBeCloseTo(170 * 1.3 * 1.4 * 1.15);
    expect(w0(inv(it_('spray', 0, 0), it_('fan', 1, 0), it_('tape', 0, 2))).arcDeg).toBe(150);
  });
  it('200 rolls over every item type: no duplicates', () => {
    const s = createRun(1);
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const o = rollOffers(s, mulberry32(seed), 2 + (seed % 6));
      expect(new Set(o.map((x) => x.type)).size).toBe(4);
      o.forEach((x) => seen.add(x.type));
    }
    expect(seen.size).toBe(Object.keys(ITEMS).length);
  });
});

describe('store services (bigger cart / shelf)', () => {
  it('cart grows 4x4 → 5x4 → 6x4 → 6x5 → 7x5, charges exactly, keeps items, then maxes out', () => {
    const s = shopRun();
    s.money = 200;
    const placed = structuredClone(s.inventory.placed);
    const sizes: [number, number][] = [];
    for (const price of ECONOMY.cartPrices) {
      const m = s.money;
      expect(cartUpgradeCost(s)).toBe(price);
      expect(upgradeCart(s).ok).toBe(true);
      expect(s.money).toBe(m - price);
      sizes.push([s.inventory.cols, s.inventory.rows]);
    }
    expect(sizes).toEqual(ECONOMY.cartSizes);
    expect(s.inventory.placed).toEqual(placed);
    expect(cartUpgradeCost(s)).toBeNull();
    const before = structuredClone(s);
    expect(upgradeCart(s).ok).toBe(false);
    expect(s).toEqual(before);
    expect(canPlace(s.inventory, 'toaster', 5, 4, 0).ok).toBe(true); // new cells are usable
  });
  it('shelf grows to 6, refuses when broke, never during combat', () => {
    const s = shopRun();
    s.money = 5;
    const before = structuredClone(s);
    expect(upgradeShelf(s).ok).toBe(false);
    expect(s).toEqual(before);
    s.money = 100;
    expect(upgradeShelf(s).ok).toBe(true);
    expect(upgradeShelf(s).ok).toBe(true);
    expect(s.inventory.shelf).toHaveLength(6);
    expect(shelfUpgradeCost(s)).toBeNull();
    expect(s.money).toBe(100 - ECONOMY.shelfPrices[0] - ECONOMY.shelfPrices[1]);
    s.phase = 'combat';
    expect(upgradeCart(s).ok).toBe(false);
  });
});

describe('meta-progression gating', () => {
  it('locked items never appear in offers (incl. legendaries)', () => {
    const allowed = ['toaster', 'pan', 'fan', 'fuel', 'battery', 'bell', 'hotsauce', 'magnet'] as ItemTypeId[];
    for (let seed = 1; seed <= 200; seed++) {
      const s = createRun(seed);
      s.unlocked = allowed;
      s.shopLevel = 4;
      for (const idx of [1, 3, 6]) for (const o of rollOffers(s, mulberry32(seed * 7 + idx), idx)) expect(allowed).toContain(o.type);
    }
  });
});

describe('universal utilities and 2 combos per weapon', () => {
  const cw = (weapon: ItemTypeId, sup: ItemTypeId[]) => computeBuild(cart(weapon, sup)).weapons[0];
  it('fuel burns on a pan; fan adds 30% reach; battery normal vs electric', () => {
    expect(cw('pan', ['fuel']).burn!.dps).toBe(2.5);
    expect(cw('pan', ['fan']).range).toBeCloseTo(ITEMS.pan.weapon!.range * 1.3);
    expect(cw('vacuum', ['fan']).range).toBeCloseTo(150 * 1.3 * 1.15);
    expect(cw('pan', ['fan']).projectileSpeed).toBe(0);
    expect(cw('pan', ['battery']).cooldown).toBeCloseTo(1.15 / BUFFS.battery.rateMult);
    expect(cw('toaster', ['battery']).cooldown).toBeCloseTo(ITEMS.toaster.weapon!.cooldown / batE);
  });
  it('a pan with bell + fuel has both combos; toaster fan+fuel+hotsauce has toastMode and fiveAlarm', () => {
    expect(cw('pan', ['bell', 'fuel']).recipes).toEqual(['expressCheckout', 'sizzlingSkillet']);
    expect(cw('toaster', ['fan', 'fuel', 'hotsauce']).recipes).toEqual(['toastMode', 'fiveAlarm']);
    expect(computeBuild(cart('pan', ['bell', 'fuel'])).recipes).toHaveLength(2);
  });
  it('every combo: positive with all supports, negative when any support is missing', () => {
    for (const r of Object.values(RECIPES)) {
      expect(cw(r.weapon, r.supports).recipes, r.id).toContain(r.id);
      for (let i = 0; i < r.supports.length; i++) {
        const rest = r.supports.filter((_, j) => j !== i);
        expect(cw(r.weapon, rest).recipes, `${r.id} without ${r.supports[i]}`).not.toContain(r.id);
      }
    }
  });
  it('grease fire burn 5 dps and bigger puddle; pressure washer arc 25, x2.5 damage', () => {
    const g = cw('mop', ['fuel']);
    expect(g.burn!.dps).toBe(5);
    expect(g.range).toBeCloseTo(60 * 1.4);
    const pw = cw('spray', ['battery']);
    expect(pw.recipes).toContain('pressureWasher');
    expect(pw.arcDeg).toBe(25);
    expect(pw.range).toBeCloseTo(340);
    expect(pw.damage).toBeCloseTo(3 * 2.5 * 1.06);
    const both = cw('spray', ['battery', 'fan']);
    expect(both.recipes).toEqual(['mistMachine', 'pressureWasher']);
    expect(both.arcDeg).toBe(25);
  });
  it('multipack on a vacuum is +20% damage and listed in buffs', () => {
    const v = cw('vacuum', ['multipack']);
    expect(v.damage).toBeCloseTo(2 * 1.2 * 1.06);
    expect(v.buffs).toContain('multipack');
    expect(v.count).toBe(1);
  });
});

describe('per-level scaling table', () => {
  it('every levelable item lists ★1/★2/★3 values; legendaries list none', () => {
    for (const [id, def] of Object.entries(ITEMS)) {
      const rows = tierScaling(id as ItemTypeId);
      if (def.legendary) expect(rows, id).toEqual([]);
      else {
        expect(rows.length, `${id} has no scaling rows`).toBeGreaterThan(0);
        for (const r of rows) expect(r.values, `${id} ${r.label}`).toHaveLength(3);
      }
    }
  });
  it('bell matches the build: −0.5 / −0.75 / −1 s', () => {
    expect(tierScaling('bell')[0].values).toEqual(['−0.5 s', '−0.75 s', '−1 s']);
    for (const t of [1, 2, 3]) expect(computeBuild(inv({ ...it_('bell', 0, 0), tier: t })).shoveCooldown).toBeCloseTo(PLAYER.shove.cooldown - 0.5 * (1 + 0.5 * (t - 1)));
  });
});

describe('Test Lab', () => {
  const opts = { aisle: 6, dept: 'frozen' as const, shift: 2, starter: 'pan' as const, weapon: 'pan' as const, money: 321, cart: ECONOMY.cartSizes[2], shelf: ECONOMY.shelfSizes[1], shopLevel: SHOP_LEVELS.length, god: true, keep: true, mod: 'rush' as const };
  it('createLabRun parks an empty run before the chosen aisle', () => {
    const s = createLabRun(1, opts);
    expect(s.wave).toBe(opts.aisle - 1);
    expect([s.inventory.cols, s.inventory.rows]).toEqual(opts.cart);
    expect(s.inventory.shelf).toHaveLength(opts.shelf);
    expect(s.inventory.placed).toEqual([]);
    expect([s.money, s.shift, s.shopLevel, s.lab, s.labGod]).toEqual([opts.money, opts.shift, opts.shopLevel, true, true]);
    expect(s.unlocked).toHaveLength(Object.keys(ITEMS).length);
    expect(s.overtime).toBeFalsy();
    expect(labDoor(s)).toBe('rush');
    expect([s.theme, s.department]).toEqual(['frozen', 'frozen']);
  });
  it('boss aisle forces the boss door; overtime aisles are overtime', () => {
    expect(labDoor(createLabRun(1, { ...opts, aisle: BOSS_WAVE }))).toBe('boss');
    const o = createLabRun(1, { ...opts, aisle: BOSS_WAVE + 2, mod: 'rush' });
    expect([o.overtime, labDoor(o), o.theme]).toEqual([true, 'rush', 'frozen']);
  });
  it('leaving a lab shop offers only the chosen modifier', () => {
    const s = createLabRun(1, opts);
    openShop(s, mulberry32(1));
    expect(leaveShop(s, mulberry32(1)).ok).toBe(true);
    expect(s.doors).toEqual(['rush']);
    chooseDoor(s, 'rush');
    startNextWave(s);
    expect([s.wave, s.department, s.modifier]).toEqual([opts.aisle, opts.dept, 'rush']);
  });
  it('labAddItem fills the first free shelf slot with the tier, fails when full, legendaries stay ★1', () => {
    const s = createLabRun(1, { ...opts, shelf: ECONOMY.shelfSlots });
    openShop(s, mulberry32(1));
    expect(labAddItem(s, 'fan', TIER.max).ok).toBe(true);
    expect(s.inventory.shelf[0]).toMatchObject({ type: 'fan', tier: TIER.max });
    const legend = Object.keys(ITEMS).find((k) => ITEMS[k as ItemTypeId].legendary) as ItemTypeId;
    labAddItem(s, legend, TIER.max);
    expect(s.inventory.shelf[1]!.tier).toBe(1);
    while (labAddItem(s, 'fan', 1).ok);
    expect(s.inventory.shelf.every(Boolean)).toBe(true);
    expect(labAddItem(s, 'fan', 1)).toEqual({ ok: false, reason: 'Staging shelf is full' });
  });
});

describe('enemy codex', () => {
  it('enemyAppears gives the first aisle', () => {
    expect(enemyAppears('milk').first).toBe(1);
    expect(enemyAppears('turkey').first).toBe(4);
    expect(enemyAppears('slice').first).toBe(enemyAppears('melon').first);
    expect(enemyAppears('boss').first).toBe(BOSS_WAVE);
    expect(enemyAppears('milk').depts).toContain('frozen');
  });
  it('every enemy has a blurb', () => {
    for (const e of Object.values(ENEMIES)) expect(e.blurb.length).toBeGreaterThan(10);
  });
  it('tracks enemies, skips lab runs, and old profiles default to {}', () => {
    const s = createRun(1);
    noteEnemy(s, 'milk');
    noteEnemy(s, 'milk', { elite: true });
    expect(profile.enemies.milk).toEqual({ seen: 1, kills: 1, elites: 1 });
    noteEnemy({ ...s, lab: true }, 'egg');
    expect(profile.enemies.egg).toBeUndefined();
  });
  it('load merges a profile without the enemies field', async () => {
    const store: Record<string, string> = { 'goblin-grocery.profile.v1': JSON.stringify({ v: 1, stats: {}, recipes: [], unlocked: [] }) };
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: () => {} });
    vi.resetModules();
    const m = await import('../src/state/profile');
    expect(m.profile.enemies).toEqual({});
    vi.unstubAllGlobals();
  });
});

describe('aisle obstacles', () => {
  const r = { x: 100, y: 100, w: 100, h: 60 }; // x 50..150, y 70..130
  const dist = (a: Rect, b: Rect) => Math.hypot(Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2), Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2));

  it('pushOutCircle slides out along the nearest side and ignores misses', () => {
    expect(pushOutCircle(300, 100, 20, r)).toBeNull();
    const top = pushOutCircle(100, 60, 20, r)!;
    expect(top.x).toBeCloseTo(100); expect(top.y).toBeCloseTo(50);
    const corner = pushOutCircle(155, 135, 20, r)!;
    expect(Math.hypot(corner.x - 150, corner.y - 130)).toBeCloseTo(20);
    const inside = pushOutCircle(140, 100, 10, r)!; // centre inside: leaves via the nearest face
    expect(inside.x).toBeCloseTo(160);
  });

  it('pushOutCapsule accounts for the cart nose and tail', () => {
    // capsule spans x-42 .. x+46 (facing right), radius 22
    expect(pushOutCapsule(-30, 100, -42, 46, 22, r)).toBeNull(); // nose ends at x=38 < 50
    const hit = pushOutCapsule(10, 100, -42, 46, 22, r)!;
    expect(hit.x).toBeCloseTo(50 - 22 - 46); // nose stops against the left face
    expect(pushOutCapsule(-100, 100, -42, 46, 22, r)).toBeNull();
    const above = pushOutCapsule(100, 60, -42, 46, 22, r)!;
    expect(above.y).toBeCloseTo(70 - 22);
  });

  it('segmentHitsRect detects crossings but not grazes', () => {
    expect(segmentHitsRect(0, 100, 200, 100, r)).toBe(true);
    expect(segmentHitsRect(0, 50, 200, 50, r)).toBe(false);
    expect(segmentHitsRect(0, 70, 200, 70, r)).toBe(false); // along the border
    expect(segmentHitsRect(0, 50, 200, 50, r, 25)).toBe(true); // grown by a radius
    expect(segmentHitsRect(0, 100, 40, 100, r)).toBe(false);
  });

  it('steerAround bends towards a corner only when blocked', () => {
    const clear = steerAround(0, 0, 100, 0, 20, [r]);
    expect(clear.x).toBeCloseTo(1);
    const bent = steerAround(0, 100, 220, 100, 20, [r]);
    expect(Math.abs(bent.y)).toBeGreaterThan(0.3);
  });
  it('steerAround walks a chaser all the way round a rect instead of stalling at a corner', () => {
    for (const [sx, sy, tx, ty] of [[100, 40, 100, 160], [20, 100, 180, 100], [100, 160, 100, 40], [30, 60, 170, 140]]) {
      let x = sx, y = sy;
      for (let i = 0; i < 400 && Math.hypot(tx - x, ty - y) > 5; i++) {
        const d = steerAround(x, y, tx, ty, 12, [r]);
        x += d.x * 3; y += d.y * 3;
        const q = pushOutCircle(x, y, 12, r);
        if (q) { x = q.x; y = q.y; }
      }
      expect(Math.hypot(tx - x, ty - y)).toBeLessThanOrEqual(5);
    }
  });

  it('clearance and boss have layouts that stay clear of start, entries, hazards and each other (themes: see zones.test.ts)', () => {
    for (const id of ['clearance', 'boss'] as const) {
      const layouts = OBSTACLES[id]!;
      expect(layouts.length, id).toBeGreaterThanOrEqual(id === 'boss' ? 1 : 2);
      for (const lay of layouts) {
        expect(lay.length, id).toBeGreaterThanOrEqual(id === 'boss' ? 1 : 2);
        expect(lay.length, id).toBeLessThanOrEqual(id === 'boss' ? 2 : 4);
        lay.forEach((a, i) => {
          const tag = `${id}:${a.kind}@${a.x},${a.y}`;
          expect(dist(a, { ...PLAYER_START, w: 0, h: 0 }), tag + ' start').toBeGreaterThanOrEqual(140);
          for (const e of ENTRIES) expect(dist(a, { ...e, w: 0, h: 0 }), tag + ' entry').toBeGreaterThanOrEqual(90);
          for (const h of hazardRects(id)) expect(dist(a, h), tag + ' hazard').toBeGreaterThan(0);
          for (const b of lay.slice(i + 1)) expect(dist(a, b), tag + ' gap').toBeGreaterThanOrEqual(140);
          // wide enough walkway between the prop and the arena edges for the cart
          expect(a.x - a.w / 2 - (ARENA.left + 11), tag + ' left').toBeGreaterThanOrEqual(70);
          expect(ARENA.right - 11 - (a.x + a.w / 2), tag + ' right').toBeGreaterThanOrEqual(70);
          expect(a.y - a.h / 2 - ARENA.top, tag + ' top').toBeGreaterThanOrEqual(70);
          expect(ARENA.bottom - (a.y + a.h / 2), tag + ' bottom').toBeGreaterThanOrEqual(55);
        });
      }
    }
  });
});

describe('edge solids', () => {
  const dist = (a: Rect, b: Rect) => Math.hypot(Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2), Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2));
  it('keep spawns, start, hazards and layout props clear', () => {
    for (const id of [...THEMES, 'boss' as const]) {
      for (const s of edgeSolids(DEPARTMENTS[id].theme.props)) {
        for (const e of ENTRIES) expect(dist(s, { ...e, w: 0, h: 0 }), `entry ${e.x},${e.y}`).toBeGreaterThan(0);
        expect(dist(s, { ...PLAYER_START, w: 0, h: 0 })).toBeGreaterThan(100);
        for (const h of hazardRects(id)) expect(dist(s, { ...h, w: 0, h: 0 }), `${id} hazard centre`).toBeGreaterThan(0); // edges may overlap, centres stay reachable
        for (const lay of [...(OBSTACLES[id] ?? []), ...zonesOf(id).flatMap((z) => z.layouts)]) for (const o of lay) expect(dist(s, o), `${id}:${o.kind}@${o.x},${o.y}`).toBeGreaterThanOrEqual(55); // cart walkway, same as the arena-bottom margin
      }
    }
  });
});

describe('aisle events', () => {
  const always = () => 0; // rng that passes every chance roll
  it('never on the boss aisle or below minAisle', () => {
    expect(rollEvent('main', BOSS_WAVE, 0, always, true)).toBeNull();
    expect(rollEvent('boss', 3, 0, always, false)).toBeNull();
    expect(rollEvent('main', 1, 0, always, false)).toBeNull();
    expect(rollEvent('electronics', EVENTS.outage.minAisle - 1, 0, always, false)?.kind).toBe('wetFloor');
    expect(rollEvent('electronics', EVENTS.outage.minAisle, 0, always, false)?.kind).toBe('outage');
    expect(rollEvent('main', 5, 0, always, false, 'wetFloor')).not.toBeNull();
    expect(rollEvent('main', 5, 0, always, true, 'outage')).toBeNull();
    expect(rollEvent('main', 5, 0, always, false, 'none')).toBeNull();
  });
  it('reads chances from data', () => {
    for (const d of ['main', 'frozen', 'electronics'] as const) {
      const c = EVENTS.wetFloor.chanceByDept[d]!;
      const just = (v: number) => () => v;
      // wet floor is rolled first outside electronics: below the chance hits, at the chance misses it
      if (d !== 'electronics') expect(rollEvent(d, 5, 0, just(c - 0.001), false)?.kind).toBe('wetFloor');
      expect(rollEvent(d, 5, 0, just(0.999), false)).toBeNull();
    }
  });
  it('outage lasts longer on later shifts and starts inside the window', () => {
    expect(outageDuration(2)).toBe(EVENTS.outage.duration + 2 * EVENTS.outage.durationPerShift);
    const r = rollEvent('electronics', 5, 2, always, false)!;
    expect(r.duration).toBe(outageDuration(2));
    expect(r.startAt).toBeGreaterThanOrEqual(EVENTS.outage.startAt[0]);
    expect(r.startAt).toBeLessThanOrEqual(EVENTS.outage.startAt[1]);
  });
  it('is deterministic for a seed', () => {
    const a = Array.from({ length: 20 }, (_, i) => rollEvent('clearance', 4, 1, mulberry32(i), false));
    const b = Array.from({ length: 20 }, (_, i) => rollEvent('clearance', 4, 1, mulberry32(i), false));
    expect(a).toEqual(b);
    expect(a.some((x) => x) && a.some((x) => !x)).toBe(true);
  });
});

describe('boss payout', () => {
  it('the Manager pays more on every harder shift (shift coin cuts do not apply)', () => {
    const pay = SHIFTS.map((_, i) => bossTuning(i).coins);
    expect(pay[0]).toBe(BOSS.coins);
    for (let i = 1; i < pay.length; i++) expect(pay[i]).toBeGreaterThan(pay[i - 1]);
  });
});

describe('enemy damage scaling', () => {
  it('enemy damage rises every aisle, keeps rising in overtime, and per shift', () => {
    const regular = WAVES.filter((w) => !w.boss);
    for (let i = 1; i < regular.length; i++) expect(regular[i].dmgScale).toBeGreaterThan(regular[i - 1].dmgScale);
    expect(waveDef(BOSS_WAVE + 2).dmgScale).toBeCloseTo(waveDef(BOSS_WAVE + 1).dmgScale * OVERTIME.dmgGrowth);
    for (let i = 1; i < SHIFTS.length; i++) expect(SHIFTS[i].dmgMult).toBeGreaterThan(SHIFTS[i - 1].dmgMult);
    const s = createRun(1); s.wave = 5; s.shift = 2;
    expect(waveSpawnPlan(s).dmgScale).toBeCloseTo(WAVES[4].dmgScale * SHIFTS[2].dmgMult);
  });
});

describe('armored / shield / healer / thief enemies', () => {
  const NEW = ['beans', 'cereal', 'honey', 'giftcard', 'expired', 'gum'] as const;
  it('armor soaks flat damage but never below 30%; no armor is a no-op', () => {
    expect(armorDamage(3, 3)).toBe(1);
    expect(armorDamage(10, 3)).toBe(7);
    expect(armorDamage(1, 3)).toBe(1);
    expect(armorDamage(10, 0)).toBe(10);
    expect(ENEMIES.beans.armor).toBe(3);
  });
  it('shield blocks shots from the front only', () => {
    // enemy faces +x (toward the player on its right); a shot flying -x hits the front.
    expect(shieldBlocks(-100, 0, 1, 0)).toBe(true);
    expect(shieldBlocks(-100, -80, 1, 0)).toBe(true);   // ~39 degrees off
    expect(shieldBlocks(0, 100, 1, 0)).toBe(false);     // side
    expect(shieldBlocks(100, 0, 1, 0)).toBe(false);     // from behind
    expect(ENEMIES.cereal.shield).toBe(true);
  });
  it('honey heal caps at max HP and skips self, boss and other honey jars', () => {
    const mk = (id: string, x: number, hp: number, maxHp = 100) => ({ x, y: 0, hp, maxHp, alive: true, def: { id } });
    const jar = mk('honey', 0, 35), milk = mk('milk', 50, 50), full = mk('milk', 60, 99), boss = mk('boss', 70, 10), other = mk('honey', 80, 10), far = mk('milk', 400, 10);
    const hits = healTargets(jar, [jar, milk, full, boss, other, far]);
    expect(hits.map((h) => h.target)).toEqual([milk, full]);
    expect(hits[0].amount).toBeCloseTo(3);
    expect(hits[1].amount).toBeCloseTo(1); // capped to the missing HP
  });
  it('new groceries are in the data, codex, German and a wave mix; gift card never elite', () => {
    for (const id of NEW) {
      expect(ENEMIES[id]).toBeDefined();
      expect(CODEX_ENEMIES).toContain(id);
      expect(DATA_DE.enemies[id].name.length).toBeGreaterThan(2);
      expect(WAVES.some((w) => (w.mix[id] ?? 0) > 0)).toBe(true);
      expect(enemyAppears(id).first).toBeGreaterThanOrEqual(2);
    }
    expect(ELITE_EXCLUDED).toContain('giftcard');
    expect(new Set(CODEX_ENEMIES).size).toBe(Object.keys(ENEMIES).length);
  });
});

describe('set bonuses', () => {
  const b = (...types: ItemTypeId[]) => computeBuild(inv(...types.map((t, i) => it_(t, i % 5, Math.floor(i / 5) * 2))));
  const bw = (...types: ItemTypeId[]) => b(...types).weapons.find((w) => w.type === types[0])!;
  it('setLevels counts distinct types, ignores duplicates and the shelf', () => {
    const sh = inv(it_('toaster', 0, 0), it_('toaster', 2, 0), it_('pan', 0, 1));
    expect(setLevels(sh.placed).kitchen).toBe(1);
    sh.shelf[0] = it_('microwave', 0, 0);
    expect(setLevels(sh.placed).kitchen).toBe(1);
    sh.placed.push(it_('hotsauce', 4, 0));
    expect(setLevels(sh.placed)).toMatchObject({ kitchen: 2, heat: 2, electric: 0, tools: 0 });
    expect(setLevels([]).kitchen).toBe(0);
  });
  it('kitchen L1 damage, cleaning L1 range, tools L1 cooldown, snacks L1 maxHp', () => {
    expect(bw('pan', 'toaster').damage).toBeCloseTo(9 * 1.1 * 1.06); // kitchen L1 x bundle (1 neighbour)
    expect(bw('mop', 'fan').range).toBeCloseTo(ITEMS.mop.weapon!.range * 1.3 * 1.15);
    expect(bw('toaster', 'tape', 'magnet').cooldown).toBeCloseTo(ITEMS.toaster.weapon!.cooldown / 1.08);
    expect(b('lunchbox', 'energy').maxHp).toBe(PLAYER.maxHp + Math.round(BUFFS.lunchboxHp) + 10);
  });
  it('heat L1 burn duration, frost L1 slow +0.1 capped at 0.6, blast L1 popper radius', () => {
    expect(w0(inv(it_('pan', 0, 0), it_('fuel', 1, 0))).burn).toEqual({ dps: 2.5, duration: 3, tick: 0.5 });
    expect(w0(inv(it_('pan', 0, 0), it_('ice', 1, 0))).slow!.pct).toBe(0.25); // frost needs 2 types
    expect(computeBuild(inv(it_('fizz', 0, 0), it_('ice', 2, 0))).weapons[0].slow!.pct).toBeCloseTo(0.35);
    expect(computeBuild(inv(it_('vacuum', 0, 0), it_('ice', 2, 0), it_('mop', 0, 3))).weapons.find((w) => w.type === 'vacuum')!.slow!.pct).toBe(0.6); // coldStorage 0.5 + 0.1, frost 2 types
    expect(computeBuild(inv(it_('toaster', 0, 0), it_('popper', 2, 0), it_('multipack', 3, 0))).weapons[0].popper!.radius).toBeCloseTo(70 * 1.15);
  });
  it('tools L2 doubles dash damage and stuns; snacks L2 regen stacks with snack bag', () => {
    const t3 = b('nailgun', 'tape', 'boot');
    expect(t3.shoveDamage).toBe((PLAYER.shove.damage + BUFFS.bootDamage) * 2);
    expect(t3.shoveStun).toBe(0.3);
    expect(b('nailgun', 'tape').shoveStun).toBe(0);
    expect(b('lunchbox', 'energy', 'fizz').regen).toBeCloseTo(0.3);
    expect(b('lunchbox', 'energy', 'snackbag').regen).toBeCloseTo(BUFFS.snackRegen + 0.3);
  });
  it('heat L2: burn dps x1.4 and heat weapons without fuel ignite', () => {
    const w = bw('toaster', 'pan', 'microwave');
    expect(w.burn).toBeNull();
    expect(w.ignite).toEqual({ chance: 0.15, burn: { dps: 2.5 * 1.4, duration: 3, tick: 0.5 } });
    expect(bw('toaster', 'pan').ignite).toBeNull();
    const f = w0(inv(it_('pan', 0, 0), it_('fuel', 1, 0), it_('toaster', 0, 3)));
    expect(f.burn).toEqual({ dps: 2.5 * 1.4, duration: 3, tick: 0.5 });
    expect(f.ignite).toBeNull();
  });
  it('electric: non-zap electrical weapons chain, microwave does not', () => {
    expect(bw('toaster', 'nailgun').chainChance).toBe(0.1);
    expect(bw('toaster', 'nailgun', 'battery').chainJumps).toBe(2);
    expect(bw('microwave', 'toaster').chainChance).toBe(0);
    expect(bw('pan', 'toaster').chainChance).toBe(0);
  });
  it('checkout L1 discounts rolled offers; L2 pays capped interest after the clear bonus', () => {
    const s = shopRun();
    s.inventory.placed.push(it_('bell', 0, 3), it_('coupon', 1, 3));
    s.build = computeBuild(s.inventory);
    expect(s.build.priceMult).toBe(0.92);
    const cheap = rollOffers(s, mulberry32(5), 1, false), full = rollOffers({ ...s, build: { ...s.build, priceMult: 1 } }, mulberry32(5), 1, false);
    expect(cheap.every((o, i) => o.price <= full[i].price)).toBe(true);
    expect(cheap.some((o, i) => o.price < full[i].price)).toBe(true);
    s.money = 0; finishWave(s);
    expect(s.coinLog.some((c) => c.label === 'Interest')).toBe(false);
    s.inventory.placed.push(it_('pricegun', 2, 3));
    s.build = computeBuild(s.inventory);
    const s2 = { ...s, coinLog: [], money: 100 } as RunState; finishWave(s2);
    expect(s2.coinLog.find((c) => c.label === 'Interest')!.amount).toBe(5);
    const s3 = { ...s, coinLog: [], money: 0 } as RunState; finishWave(s3);
    const clear = s3.coinLog.find((c) => c.label === 'Wave clear bonus')!.amount;
    expect(s3.coinLog.find((c) => c.label === 'Interest')?.amount ?? 0).toBe(Math.floor(clear / 10));
  });
});
