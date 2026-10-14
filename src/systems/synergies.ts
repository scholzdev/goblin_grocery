import { BUFFS, BUNDLE, ECHO, ITEMS, MULTIPACK, POPPER, PLAYER, PROJECTILE_PATTERNS, TIER } from '../data/items';
import { RECIPES, RECIPE_TUNING } from '../data/recipes';
import { SETS, setLevels } from '../data/sets';
import type { ActiveRecipe, BuffId, Build, Inventory, ItemInstance, ItemTypeId, Perk, RecipeId, WeaponStats } from '../types';
import { adjacentPairs, neighbors } from './inventory';
import { fmtNum, t } from '../i18n';
import { itemT, recipeT } from '../i18n/data';

const BUFF_ORDER: BuffId[] = ['fan', 'fuel', 'battery', 'ice', 'hotsauce', 'pricegun', 'tape', 'popper', 'echo', 'multipack'];
const tierOf = (i: ItemInstance) => i.tier ?? 1;
const bonus = (base: number, m: number) => 1 + (base - 1) * m;

export function computeBuild(inv: Inventory, perk: Perk = {}): Build {
  const placed = inv.placed;
  /** Highest tier among placed copies of a type (0 if none). */
  const gold = new Set(placed.filter((p) => p.type === 'goldstar').map((p) => p.uid));
  const touchesGold = (i: ItemInstance) => gold.size > 0 && neighbors(placed, i.uid).some((n) => gold.has(n.uid));
  /** Effective tier: goldstar-adjacent modules/passives count one higher (no chaining, never on weapons/legendaries). */
  const eff = (i: ItemInstance) => tierOf(i) + (ITEMS[i.type].kind !== 'weapon' && !ITEMS[i.type].legendary && touchesGold(i) ? 1 : 0);
  const top = (t: ItemTypeId) => Math.max(0, ...placed.filter((p) => p.type === t).map(eff));
  const gm = (t: ItemTypeId) => TIER.mult(top(t));
  const has = (t: ItemTypeId) => top(t) > 0;
  const sets = setLevels(placed);
  const weapons: WeaponStats[] = [];
  const recipes: ActiveRecipe[] = [];

  for (const w of [...placed].sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0))) {
    const def = ITEMS[w.type];
    if (!def.weapon) continue;
    const b = def.weapon;
    const tier = tierOf(w);
    const s: WeaponStats = {
      uid: w.uid, type: w.type, pattern: b.pattern, damage: b.damage * TIER.weaponDamage(tier), cooldown: b.cooldown * TIER.weaponCooldown(tier),
      range: b.range, projectileSpeed: b.projectileSpeed, count: b.count, burstInterval: b.burstInterval, spreadDeg: 0,
      arcDeg: b.arcDeg, pull: b.pull, tick: b.tick, duration: b.duration, bounces: b.bounces, chain: b.chain, aoe: b.aoe,
      popper: null, echo: 0, firePool: false, tier, bundle: 0, critChance: 0, critCoin: false, pierce: 0, homing: false, burn: null, ignite: null, chainChance: 0, chainJumps: 0, slow: null,
      frostRing: false, expressSweep: false, buffs: [], recipes: [],
    };
    const near = neighbors(placed, w.uid);
    const nearTypes = new Set(near.map((n) => n.type));
    // highest tier per buff among touching modules
    const buffTier = new Map<BuffId, number>();
    for (const n of near) {
      const id = ITEMS[n.type].buff;
      if (id) buffTier.set(id, Math.max(buffTier.get(id) ?? 0, eff(n)));
    }
    let multi = 0;
    for (const id of BUFF_ORDER) {
      const mt = buffTier.get(id);
      if (!mt) continue;
      const m = TIER.mult(mt);
      if (id === 'fan') {
        if (PROJECTILE_PATTERNS.has(b.pattern)) s.projectileSpeed *= bonus(BUFFS.fan.speedMult, m);
        s.range *= bonus(BUFFS.fan.rangeMult, m);
      } else if (id === 'fuel') s.burn = { dps: BUFFS.fuel.dps * m, duration: BUFFS.fuel.duration, tick: BUFFS.fuel.tick };
      else if (id === 'battery') s.cooldown /= bonus(BUFFS.battery.rateMult, def.electrical ? BUFFS.battery.electricMult * m : m);
      else if (id === 'ice') s.slow = { pct: Math.min(0.6, BUFFS.ice.pct * m), duration: BUFFS.ice.duration };
      else if (id === 'hotsauce') s.damage *= bonus(BUFFS.hotsauce.damageMult, m);
      else if (id === 'pricegun') s.critChance = BUFFS.pricegun.critChance * m;
      else if (id === 'popper') s.popper = { damage: POPPER.damage * m, radius: POPPER.radius };
      else if (id === 'echo') {
        if (b.pattern === 'aura' || b.pattern === 'puddle') continue;
        s.echo = Math.min(1, ECHO.fraction * m);
      } else if (id === 'multipack') {
        if (!PROJECTILE_PATTERNS.has(b.pattern) && !['sweep', 'cone', 'mortar'].includes(b.pattern)) s.damage *= 1 + 0.2 * m; // non-repeatable patterns: +20% damage instead
        else { multi = mt; continue; } // count bonus is applied AFTER recipes (Toast Mode sets count) - see below
      } else { // tape
        const r = bonus(BUFFS.tape.radiusMult, m);
        if (PROJECTILE_PATTERNS.has(b.pattern)) s.pierce += BUFFS.tape.pierce + (mt >= 3 ? 1 : 0);
        else if (b.pattern === 'sweep' || b.pattern === 'cone') s.arcDeg += BUFFS.tape.arcDeg * m;
        else if (b.pattern === 'zap' || b.pattern === 'mortar') s.aoe *= r;
        else s.range *= r; // pulse, aura, puddle, laser
      }
      s.buffs.push(id);
    }
    if (def.electrical && has('powerstrip')) s.cooldown /= nearTypes.has('powerstrip') ? BUFFS.powerstripAdjacent : BUFFS.powerstripAll;
    // Set bonuses (cart-wide, distinct types). Frost is applied after recipes, see below.
    const fam = def.family, el = def.element;
    if (fam === 'kitchen' && sets.kitchen) s.damage *= SETS.kitchen.damageMult;
    if (fam === 'cleaning') {
      if (sets.cleaning) { s.range *= SETS.cleaning.rangeMult; s.aoe *= SETS.cleaning.aoeMult; }
      if (sets.cleaning === 2 && b.pattern === 'puddle') s.duration += SETS.cleaning.puddleExtra;
    }
    if (sets.tools) s.cooldown /= SETS.tools.cooldownDiv;
    if (sets.heat && s.burn) s.burn = { ...s.burn, duration: s.burn.duration + SETS.heat.burnExtra, dps: s.burn.dps * (sets.heat === 2 ? SETS.heat.burnMult : 1) };
    if (sets.heat === 2 && el === 'heat' && !s.burn) s.ignite = { chance: SETS.heat.igniteChance, burn: { dps: BUFFS.fuel.dps * SETS.heat.igniteDpsMult, duration: BUFFS.fuel.duration + SETS.heat.igniteExtra, tick: BUFFS.fuel.tick } };
    if (sets.blast) {
      if (s.popper) s.popper = { ...s.popper, radius: s.popper.radius * SETS.blast.radiusMult };
      if (b.pattern === 'zap' || b.pattern === 'mortar') s.aoe *= SETS.blast.radiusMult;
    }
    if (sets.electric && def.electrical && b.pattern !== 'zap') { s.chainChance = SETS.electric.chance[sets.electric - 1]; s.chainJumps = SETS.electric.jumps[sets.electric - 1]; }
    s.bundle = nearTypes.size + (nearTypes.has('goldstar') ? 1 : 0);
    s.damage *= 1 + BUNDLE.perItem * s.bundle;
    const tapeArc = s.arcDeg - b.arcDeg;
    for (const r of Object.values(RECIPES)) {
      if (r.weapon !== w.type || !r.supports.every((t) => nearTypes.has(t))) continue;
      const sup = near.filter((n) => r.supports.includes(n.type));
      applyRecipe(s, r.id, tapeArc);
      s.recipes.push(r.id);
      recipes.push({ id: r.id, weaponUid: w.uid, supportUids: sup.map((n) => n.uid).sort() });
    }
    if (sets.frost && s.slow) s.slow = { ...s.slow, pct: Math.min(SETS.frost.slowCap, s.slow.pct + SETS.frost.slowBonus) }; // after recipes: coldStorage/brainFreeze set s.slow
    if (multi) {
      s.count += PROJECTILE_PATTERNS.has(b.pattern) ? MULTIPACK.extra + (multi >= 3 ? 1 : 0) : 1;
      s.buffs.push('multipack');
    }
    s.damage *= perk.damageMult ?? 1;
    weapons.push(s);
  }

  return {
    weapons, recipes, adjacency: adjacentPairs(placed),
    maxHp: PLAYER.maxHp + (sets.snacks ? SETS.snacks.maxHp : 0) + (has('lunchbox') ? Math.round(BUFFS.lunchboxHp * gm('lunchbox')) : 0) + (has('snackbag') ? BUFFS.snackHp : 0) + (perk.maxHp ?? 0),
    regen: (has('snackbag') ? BUFFS.snackRegen : 0) + (sets.snacks === 2 ? SETS.snacks.regen : 0),
    pickupRadius: PLAYER.pickupRadius + (has('magnet') ? Math.round(BUFFS.magnetPickup * gm('magnet')) : 0) + (has('vacuum') ? BUFFS.vacuumPickup : 0) + (perk.pickupRadius ?? 0),
    shoveCooldown: PLAYER.shove.cooldown - (has('bell') ? BUFFS.bellShove * gm('bell') : 0) + (perk.shoveCooldown ?? 0),
    shoveDistMult: has('boot') ? 1 + BUFFS.bootDistance * gm('boot') : 1,
    shoveDamage: (PLAYER.shove.damage + (has('boot') ? BUFFS.bootDamage * gm('boot') : 0) + (perk.shoveDamage ?? 0)) * (sets.tools === 2 ? SETS.tools.shoveDamageMult : 1),
    shoveStun: sets.tools === 2 ? SETS.tools.shoveStun : 0,
    moveSpeedMult: (has('energy') ? 1 + BUFFS.energySpeed * gm('energy') : 1) * (perk.moveSpeedMult ?? 1),
    coinChance: has('coupon') ? Math.min(0.9, BUFFS.couponChance * gm('coupon')) : 0,
    armor: has('bubblewrap') ? top('bubblewrap') : 0,
    invulnBonus: has('bubblewrap') ? BUFFS.bubbleInvuln : 0,
    sets, priceMult: sets.checkout ? SETS.checkout.priceMult : 1,
  };
}

/** `tapeArc`: arc already gained from utilities (tape), kept on top of recipe arcs. Behaviour-only combos have no stat effect. */
function applyRecipe(s: WeaponStats, id: RecipeId, tapeArc: number): void {
  if (id === 'toastMode') {
    const t = RECIPE_TUNING.toastMode;
    s.count = t.count; s.damage *= t.damageMult; s.spreadDeg = t.spreadDeg;
  } else if (id === 'nailstorm') { s.pierce += RECIPE_TUNING.nailstorm.extraPierce; s.homing = true; }
  else if (id === 'coldStorage') {
    const c = RECIPE_TUNING.coldStorage;
    s.frostRing = true; s.slow = { pct: c.pct, duration: c.duration }; s.damage *= c.damageMult; s.range *= c.radiusMult;
  }
  else if (id === 'expressCheckout') s.expressSweep = true;
  else if (id === 'brainFreeze') { s.range *= RECIPE_TUNING.brainFreeze.radiusMult; s.slow = { pct: RECIPE_TUNING.brainFreeze.pct, duration: RECIPE_TUNING.brainFreeze.duration }; }
  else if (id === 'tvDinner') { s.chain += RECIPE_TUNING.tvDinner.chain; s.cooldown *= RECIPE_TUNING.tvDinner.cooldownMult; }
  else if (id === 'clearanceSale') { s.bounces += RECIPE_TUNING.clearanceSale.extraBounces; s.critCoin = true; }
  else if (id === 'pressurePoint') s.firePool = true;
  else if (id === 'mistMachine') { s.arcDeg += RECIPE_TUNING.mistMachine.arcDeg - ITEMS[s.type].weapon!.arcDeg; s.range *= RECIPE_TUNING.mistMachine.rangeMult; }
  else if (id === 'greaseFire') { s.range *= RECIPE_TUNING.greaseFireBoost.radiusMult; if (s.burn) s.burn = { ...s.burn, dps: s.burn.dps * RECIPE_TUNING.greaseFireBoost.burnMult }; }
  else if (id === 'frostbiteNails') { s.pierce += RECIPE_TUNING.frostbiteNails.extraPierce; }
  else if (id === 'pressureWasher') { const w = RECIPE_TUNING.pressureWasher; s.arcDeg = w.arcDeg + tapeArc; s.range *= w.rangeMult; s.damage *= w.damageMult; }
}

const pc = (m: number) => Math.round(m * 100);
const star = (t: number) => (t > 1 ? ` ★${t}` : '');

/** Human lines for a weapon's buffs. Pass `inv` to show module tiers/magnitudes (defaults to ★1). */
export function describeBuffs(s: WeaponStats, inv?: Inventory): string[] {
  const out: string[] = [];
  const tiers = new Map<BuffId, number>();
  for (const n of inv ? neighbors(inv.placed, s.uid) : []) {
    const id = ITEMS[n.type].buff;
    if (id) tiers.set(id, Math.max(tiers.get(id) ?? 0, tierOf(n) + (ITEMS[n.type].legendary ? 0 : neighbors(inv!.placed, n.uid).some((g) => g.type === 'goldstar') ? 1 : 0)));
  }
  for (const id of s.buffs) {
    const tr = tiers.get(id) ?? 1, m = TIER.mult(tr), n = itemT(Object.values(ITEMS).find((d) => d.buff === id)!.id).name + star(tr);
    if (id === 'fan') out.push(PROJECTILE_PATTERNS.has(s.pattern) ? t('bfFanSpeed', { v: pc(bonus(BUFFS.fan.speedMult, m) - 1), n }) : t('bfFanReach', { v: pc(bonus(BUFFS.fan.rangeMult, m) - 1), n }));
    else if (id === 'fuel') out.push(t('bfFuel', { v: fmtNum(BUFFS.fuel.dps * m), d: fmtNum(BUFFS.fuel.duration), n }));
    else if (id === 'battery') out.push(t('bfBattery', { v: pc(bonus(BUFFS.battery.rateMult, ITEMS[s.type].electrical ? BUFFS.battery.electricMult * m : m) - 1), n }));
    else if (id === 'ice') out.push(t('bfIce', { v: pc(Math.min(0.6, BUFFS.ice.pct * m)), d: fmtNum(BUFFS.ice.duration), n }));
    else if (id === 'hotsauce') out.push(t('bfHot', { v: pc(bonus(BUFFS.hotsauce.damageMult, m) - 1), n }));
    else if (id === 'pricegun') out.push(t('bfCrit', { v: pc(BUFFS.pricegun.critChance * m), n }));
    else if (id === 'popper') out.push(t('bfPopper', { d: fmtNum(POPPER.damage * m), r: POPPER.radius, n }));
    else if (id === 'echo') out.push(t('bfEcho', { v: pc(Math.min(1, ECHO.fraction * m)), n }));
    else if (id === 'multipack') out.push(['sweep', 'cone', 'mortar'].includes(s.pattern) ? t('bfMultiRepeat', { n }) : PROJECTILE_PATTERNS.has(s.pattern) ? t('bfMultiShots', { v: MULTIPACK.extra + (tr >= 3 ? 1 : 0), n }) : t('bfMultiDmg', { v: pc(0.2 * m), n }));
    else out.push(t('bfTape', { n }));
  }
  if (s.bundle > 0) out.push(t(s.bundle > 1 ? 'bfBundleMany' : 'bfBundleOne', { k: s.bundle, v: pc(BUNDLE.perItem * s.bundle) }));
  for (const r of s.recipes) out.push(t('bfCombo', { name: recipeT(r).name }));
  return out;
}

const fmt = (x: number) => fmtNum(+x.toFixed(2));
const pctUp = (x: number) => `+${Math.round(x * 100)}%`;
type ScaleRow = { label: string; values: string[] };

/** Per-level values (★1/★2/★3) for the inspector, mirroring computeBuild's formulas. Empty for legendaries. */
export function tierScaling(type: ItemTypeId): ScaleRow[] {
  const def = ITEMS[type];
  if (def.legendary) return [];
  const row = (label: string, f: (t: number) => string): ScaleRow => ({ label, values: [1, 2, 3].map(f) });
  const m = TIER.mult;
  const w = def.weapon;
  if (w) return [row(t('rowDamage'), (tr) => fmt(w.damage * TIER.weaponDamage(tr))), row(t('rowCooldown'), (tr) => `${fmt(w.cooldown * TIER.weaponCooldown(tr))} s`)];
  const rows: Partial<Record<ItemTypeId, () => ScaleRow[]>> = {
    fan: () => [row(t('rowRangeReach'), (tr) => pctUp((BUFFS.fan.rangeMult - 1) * m(tr))), row(t('rowProjSpeed'), (tr) => pctUp((BUFFS.fan.speedMult - 1) * m(tr)))],
    fuel: () => [row(t('rowBurn'), (tr) => `${fmt(BUFFS.fuel.dps * m(tr))}/s`)],
    battery: () => [row(t('rowAtkSpeed'), (tr) => pctUp((BUFFS.battery.rateMult - 1) * m(tr))), row(t('rowElectric'), (tr) => pctUp((BUFFS.battery.rateMult - 1) * BUFFS.battery.electricMult * m(tr)))],
    ice: () => [row(t('rowSlow'), (tr) => `${Math.round(Math.min(0.6, BUFFS.ice.pct * m(tr)) * 100)}%`)],
    hotsauce: () => [row(t('rowDamage'), (tr) => pctUp((BUFFS.hotsauce.damageMult - 1) * m(tr)))],
    pricegun: () => [row(t('rowCrit'), (tr) => `${Math.round(BUFFS.pricegun.critChance * m(tr) * 100)}%`)],
    popper: () => [row(t('rowBlast'), (tr) => fmt(POPPER.damage * m(tr)))],
    doublebag: () => [row(t('rowDouble'), (tr) => `${Math.round(Math.min(1, ECHO.fraction * m(tr)) * 100)}%`)],
    multipack: () => [row(t('rowExtra'), (tr) => `+${MULTIPACK.extra + (tr >= 3 ? 1 : 0)}`), row(t('rowMelee'), (tr) => pctUp(0.2 * m(tr)))],
    tape: () => [row(t('rowPierce'), (tr) => `+${BUFFS.tape.pierce + (tr >= 3 ? 1 : 0)}`), row(t('rowArc'), (tr) => `+${Math.round(BUFFS.tape.arcDeg * m(tr))}°`), row(t('rowRadius'), (tr) => pctUp((BUFFS.tape.radiusMult - 1) * m(tr)))],
    lunchbox: () => [row(t('rowMaxHp'), (tr) => `+${Math.round(BUFFS.lunchboxHp * m(tr))}`)],
    magnet: () => [row(t('rowPickup'), (tr) => `+${Math.round(BUFFS.magnetPickup * m(tr))}`)],
    bell: () => [row(t('rowDashCd'), (tr) => `−${fmt(BUFFS.bellShove * m(tr))} s`)],
    energy: () => [row(t('rowMove'), (tr) => pctUp(BUFFS.energySpeed * m(tr)))],
    coupon: () => [row(t('rowCoin'), (tr) => `${Math.round(Math.min(0.9, BUFFS.couponChance * m(tr)) * 100)}%`)],
    bubblewrap: () => [row(t('rowArmor'), (tr) => `${tr}`)],
    boot: () => [row(t('rowDashDist'), (tr) => pctUp(BUFFS.bootDistance * m(tr))), row(t('rowDashDmg'), (tr) => `+${fmt(BUFFS.bootDamage * m(tr))}`)],
  };
  return rows[type]?.() ?? [];
}
