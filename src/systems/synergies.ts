import { BUNDLE, ITEMS, PLAYER, TIER } from '../data/items';
import { RECIPES } from '../data/recipes';
import { setLevels } from '../data/sets';
import type { ActiveRecipe, BuffId, Build, Inventory, ItemInstance, ItemTypeId, Perk, WeaponStats } from '../types';
import { adjacentPairs, neighbors } from './inventory';
import { fmtNum, lang, t } from '../i18n';
import { itemT, recipeT } from '../i18n/data';
import { BUFF_ORDER, PROJECTILE_PATTERNS } from '../engine/define';
import { runCombo, runModule, runPhase, runPlayerHooks, tierBoostOf, type BuildEnv, type WeaponEnv } from '../engine/build';
import { contentItem, contentTune } from '../engine/registry';
import { tierRows } from '../engine/text';

const tierOf = (i: ItemInstance) => i.tier ?? 1;

export function computeBuild(inv: Inventory, perk: Perk = {}): Build {
  const placed = inv.placed;
  const boost = tierBoostOf(placed);
  /** Effective tier: items touching a tier booster (Gold Star: content `tierBoost`) count higher (no chaining, never on weapons/legendaries). */
  const eff = (i: ItemInstance) => tierOf(i) + boost(i);
  /** Highest tier among placed copies of a type (0 if none). */
  const top = (t: ItemTypeId) => Math.max(0, ...placed.filter((p) => p.type === t).map(eff));
  const sets = setLevels(placed);
  const weapons: WeaponStats[] = [];
  const recipes: ActiveRecipe[] = [];
  const env: BuildEnv = { inv, perk, sets, eff, top };

  for (const w of [...placed].sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0))) {
    const def = ITEMS[w.type];
    if (!def.weapon) continue;
    const b = def.weapon;
    const tier = tierOf(w);
    const s: WeaponStats = {
      uid: w.uid, type: w.type, pattern: b.pattern, damage: b.damage * TIER.weaponDamage(tier), cooldown: b.cooldown * TIER.weaponCooldown(tier),
      range: b.range, projectileSpeed: b.projectileSpeed, count: b.count, burstInterval: b.burstInterval, spreadDeg: 0,
      arcDeg: b.arcDeg, pull: b.pull, tick: b.tick, duration: b.duration, bounces: b.bounces, chain: b.chain, aoe: b.aoe,
      popper: null, echo: 0, tier, bundle: 0, critChance: 0, pierce: 0, burn: null, ignite: null, chainChance: 0, chainJumps: 0, slow: null,
      frostRing: false, buffs: [], recipes: [],
    };
    const near = neighbors(placed, w.uid);
    const nearTypes = new Set(near.map((n) => n.type));
    const matching = Object.values(RECIPES).filter((r) => r.weapon === w.type && r.supports.every((t) => nearTypes.has(t)));
    // highest tier per buff among touching modules
    const buffTier = new Map<BuffId, number>();
    for (const n of near) {
      const id = ITEMS[n.type].buff;
      if (id) buffTier.set(id, Math.max(buffTier.get(id) ?? 0, eff(n)));
    }
    const we: WeaponEnv = { env, near, uid: w.uid, tapeArc: 0 };
    runPhase('base', s, we);
    const suppressed = new Set(matching.flatMap((r) => r.suppresses ?? [])); // Mist Machine switches the Desk Fan off on its spray
    for (const id of BUFF_ORDER) {
      const mt = buffTier.get(id);
      if (!mt || suppressed.has(id)) continue;
      if (!runModule(id, s, we, mt)) continue; // the hook skipped it (e.g. Double Bag on an aura): the buff is not recorded
      s.buffs.push(id);
    }
    runPhase('flavor', s, we);
    runPhase('global-mod', s, we);
    runPhase('set', s, we); // the sets (kitchen 10, cleaning 20, tools 30, heat 40, blast 50, electric 60) and Gold Star's bundle (100)
    s.bundle += nearTypes.size; // content hooks (Gold Star's +1, `set` phase) added theirs already
    s.damage *= 1 + BUNDLE.perItem * s.bundle;
    we.tapeArc = s.arcDeg - b.arcDeg; // arc gained from utilities (tape): a combo that sets the arc keeps it on top
    for (const r of matching) {
      if (matching.some((o) => o.replaces?.includes(r.id))) continue; // e.g. Ray Gun replaces Nailstorm
      const sup = near.filter((n) => r.supports.includes(n.type));
      runCombo(r.id, s, we); // the combo's `combo`-phase build hook, if it has stat effects
      s.recipes.push(r.id);
      recipes.push({ id: r.id, weaponUid: w.uid, supportUids: sup.map((n) => n.uid).sort() });
    }
    runPhase('post-combo', s, we); // Frost's slow bonus sits last (order 1000): it must follow the combos that set `slow`
    runPhase('final', s, we);
    s.damage *= perk.damageMult ?? 1;
    weapons.push(s);
  }

  // Cart combos (no weapon): active when every other support touches an instance of the first one.
  for (const r of Object.values(RECIPES)) {
    if (r.weapon) continue;
    for (const a of placed.filter((p) => p.type === r.supports[0])) {
      const near = neighbors(placed, a.uid);
      const rest = r.supports.slice(1).map((ty) => near.find((n) => n.type === ty));
      if (rest.some((n) => !n)) continue;
      recipes.push({ id: r.id, weaponUid: null, supportUids: [a.uid, ...rest.map((n) => n!.uid)].sort() });
      break;
    }
  }

  const build: Build = {
    weapons, recipes, adjacency: adjacentPairs(placed),
    // Unrounded here: player hooks add to it, then the Expired Milk curse and the rounding below finish it.
    maxHp: PLAYER.maxHp + (perk.maxHp ?? 0),
    stinkDps: 0,
    regen: 0, // the Snacks set (L2) and Snack Bag add in their player hooks
    killCoinMult: 1,
    pickupRadius: PLAYER.pickupRadius + (perk.pickupRadius ?? 0), // the Vacuum and Magnet add in their player hooks
    shoveCooldown: PLAYER.shove.cooldown + (perk.shoveCooldown ?? 0),
    shoveDistMult: 1,
    shoveKnockMult: 1,
    shoveDamage: PLAYER.shove.damage + (perk.shoveDamage ?? 0), // Boot adds in its player hook, then the Tools set (L2, order 200) multiplies the total
    moveSpeedMult: perk.moveSpeedMult ?? 1,
    sets, priceMult: 1, // the Checkout set sets it in its player hook
  };
  runPlayerHooks(build, env);
  // Expired Milk's curse (a high-order player hook) multiplied the finished total; max HP is rounded once, here.
  build.maxHp = Math.round(build.maxHp);
  return build;
}

const pc = (m: number) => Math.round(m * 100);
const star = (t: number) => (t > 1 ? ` ★${t}` : '');

/** Human lines for a weapon's buffs. Pass `inv` to show module tiers/magnitudes (defaults to ★1). */
export function describeBuffs(s: WeaponStats, inv?: Inventory): string[] {
  const out: string[] = [];
  const tiers = new Map<BuffId, number>();
  const boost = inv ? tierBoostOf(inv.placed) : () => 0;
  for (const n of inv ? neighbors(inv.placed, s.uid) : []) {
    const id = ITEMS[n.type].buff;
    if (id) tiers.set(id, Math.max(tiers.get(id) ?? 0, tierOf(n) + boost(n)));
  }
  for (const id of s.buffs) {
    const tr = tiers.get(id) ?? 1, n = itemT(Object.values(ITEMS).find((d) => d.buff === id)!.id).name + star(tr);
    if (id === 'fan') { const f = contentTune('fan', tr); out.push(PROJECTILE_PATTERNS.has(s.pattern) ? t('bfFanSpeed', { v: pc(f.speed), n }) : t('bfFanReach', { v: pc(f.range), n })); }
    else if (id === 'fuel') { const f = contentTune('fuel', tr); out.push(t('bfFuel', { v: fmtNum(f.dps), d: fmtNum(f.duration), n })); }
    else if (id === 'battery') { const bt = contentTune('battery', tr); out.push(t('bfBattery', { v: pc(ITEMS[s.type].electrical ? bt.electric : bt.rate), n })); }
    else if (id === 'ice') { const i = contentTune('ice', tr); out.push(t('bfIce', { v: pc(Math.min(i.cap, i.pct)), d: fmtNum(i.duration), n })); }
    else if (id === 'hotsauce') out.push(t('bfHot', { v: pc(contentTune('hotsauce', tr).damage), n }));
    else if (id === 'pricegun') out.push(t('bfCrit', { v: pc(contentTune('pricegun', tr).crit), n }));
    else if (id === 'popper') { const p = contentTune('popper', tr); out.push(t('bfPopper', { d: fmtNum(p.damage), r: p.radius, n })); }
    else if (id === 'echo') out.push(t('bfEcho', { v: pc(Math.min(1, contentTune('doublebag', tr).fraction)), n }));
    else if (id === 'multipack') { const mp = contentTune('multipack', tr); out.push(['sweep', 'cone', 'mortar'].includes(s.pattern) ? t('bfMultiRepeat', { n }) : PROJECTILE_PATTERNS.has(s.pattern) ? t('bfMultiShots', { v: Math.min(mp.extra, mp.maxExtra), n }) : t('bfMultiDmg', { v: pc(mp.damage), n })); }
    else if (id === 'tape') out.push(t('bfTape', { n }));
  }
  if (s.bundle > 0) out.push(t(s.bundle > 1 ? 'bfBundleMany' : 'bfBundleOne', { k: s.bundle, v: pc(BUNDLE.perItem * s.bundle) }));
  for (const r of s.recipes) out.push(t('bfCombo', { name: recipeT(r).name }));
  return out;
}

type ScaleRow = { label: string; values: string[] };

/** Per-level values (★1/★2/★3) for the inspector: the content file's rows. Empty for legendaries. */
export function tierScaling(type: ItemTypeId): ScaleRow[] {
  const content = contentItem(type);
  if (!content || ITEMS[type].legendary) return [];
  return tierRows(content, lang());
}
