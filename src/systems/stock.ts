import { DEPARTMENTS } from '../data/departments';
import { ITEMS, ITEM_IDS } from '../data/items';
import { RECIPES, recipeParts } from '../data/recipes';
import { STOCK } from '../data/stock';
import { RECIPE_ORDER } from '../engine/define';
import type { DepartmentId, ItemTypeId, RecipeDef, RecipeId, RunState, StarterWeapon } from '../types';
import { stockRng, type Rng } from './rng';

export interface StockInput {
  source: readonly ItemTypeId[];
  weapon: StarterWeapon;
  theme: DepartmentId;
  fresh: readonly ItemTypeId[];
}

export interface Stock { pool: ItemTypeId[]; featured: RecipeId[]; openers: ItemTypeId[] }

const legendary = (t: ItemTypeId): boolean => !!ITEMS[t].legendary;
const isWeapon = (t: ItemTypeId): boolean => ITEMS[t].kind === 'weapon';
const withPart = (t: ItemTypeId): RecipeDef[] => RECIPE_ORDER.map((id) => RECIPES[id]).filter((r) => recipeParts(r).includes(t));

function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The cheapest part not chosen yet from each of up to STOCK.openers combos with the weapon; with fewer than 2 such combos, more parts of them. */
function drawOpeners(weapon: StarterWeapon, regular: ReadonlySet<ItemTypeId>, rng: Rng): ItemTypeId[] {
  const partsOf = (r: RecipeDef) => recipeParts(r).filter((t) => t !== weapon && regular.has(t)).sort((a, b) => ITEMS[a].price - ITEMS[b].price);
  const recipes = shuffled(withPart(weapon), rng);
  const openers: ItemTypeId[] = [];
  for (const r of recipes) {
    const t = partsOf(r).find((p) => !openers.includes(p));
    if (t && openers.length < STOCK.openers) openers.push(t);
  }
  if (openers.length < 2) for (const t of recipes.flatMap(partsOf)) if (openers.length < STOCK.openers && !openers.includes(t)) openers.push(t);
  return openers;
}

export function drawStock(input: StockInput, rng: Rng): Stock {
  const given = new Set(input.source);
  const source = ITEM_IDS.filter((t) => given.has(t) && !ITEMS[t].noShop);
  const regular = new Set(source.filter((t) => !legendary(t)));
  const openers = drawOpeners(input.weapon, regular, rng);
  if (regular.size <= STOCK.size) return { pool: source, featured: [], openers };

  const pool = new Set<ItemTypeId>();
  const add = (t: ItemTypeId) => { if (regular.has(t) && pool.size < STOCK.size) pool.add(t); };
  const others = (keep: (t: ItemTypeId) => boolean) => shuffled([...regular].filter((t) => !pool.has(t) && keep(t)), rng);

  add(input.weapon);
  // Reserve a viable partner before the rest of the stock fills with support items.
  const partner = shuffled([...regular].filter((t) => isWeapon(t) && ITEMS[t].weaponFamily !== ITEMS[input.weapon].weaponFamily), rng)[0];
  if (partner) add(partner);
  for (const r of withPart(input.weapon)) recipeParts(r).forEach(add);
  DEPARTMENTS[input.theme].shopBias.forEach(add);
  let legend: ItemTypeId | undefined;
  for (const t of shuffled(source.filter((t) => input.fresh.includes(t)), rng).slice(0, STOCK.freshMax)) {
    if (legendary(t)) legend ??= t;
    else add(t);
  }
  STOCK.staples.forEach(add);
  const featured: RecipeId[] = [];
  for (const id of shuffled(RECIPE_ORDER.filter((id) => recipeParts(RECIPES[id]).every((t) => regular.has(t))), rng)) {
    if (featured.length === STOCK.featuredCombos) break;
    const parts = recipeParts(RECIPES[id]);
    if (pool.size + parts.filter((t) => !pool.has(t)).length > STOCK.size) continue;
    parts.forEach(add);
    featured.push(id);
  }
  const weapons = () => [...pool].filter(isWeapon).length;
  for (const t of others(isWeapon)) if (weapons() < STOCK.minWeapons) add(t);
  for (const t of others(() => true)) add(t);
  const legends = source.filter(legendary);
  legend ??= legends[Math.floor(rng() * legends.length)];
  return { pool: source.filter((t) => pool.has(t) || t === legend), featured, openers };
}

export function applyStock(state: RunState, source: readonly ItemTypeId[], fresh: readonly ItemTypeId[]): void {
  Object.assign(state, drawStock({ source, weapon: state.weapon, theme: state.theme, fresh }, stockRng(state.seed)));
}
