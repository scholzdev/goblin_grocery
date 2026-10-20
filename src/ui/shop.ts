import { store } from '../state/store';
import { profile, unlockedItems } from '../state/profile';
import { ITEMS, ITEM_IDS, TIER, cellsFor, cellsOf } from '../data/items';
import { RECIPES, recipeIcon, recipeParts } from '../data/recipes';
import { BOSS_WAVE, ECONOMY, SHOP_LEVELS } from '../data/waves';
import { cartUpgradeCost, nextCartSize, shelfUpgradeCost, upgradeCart, upgradeShelf, buyOffer, mergeItems, mergeTargetFor, upgradeShop, shopUpgradeCost, moveItem, previewMerge, previewMove, repair, reroll, sellItem, toggleShopLock, type MoveTarget } from '../state/run';
import { findItem, rotateCells, rotatedSize, footprint } from '../systems/inventory';
import { describeBuffs, tierScaling } from '../systems/synergies';
import { currentRerollCost, inflation, repairCost, sellPrice } from '../systems/shop';
import { iconOf, sellValue } from '../engine/registry';
import { cycleSlot, slotOfUid } from '../engine/actives';
import { flow } from '../flow';
import { play } from '../audio/sfx';
import { svg } from './hud';
import { settings } from '../state/settings';
import { ACTIVE_KEYS, bindingLabel, keyLabel, matches } from '../state/keymap';
import type { ShopPad } from '../input/gamepad';
import { pickNext, type Dir } from '../input/pad-core';
import { icons, setIcon } from './icons';
import { strongVsHtml } from './affinity';
import { t, fmtNum } from '../i18n';
import { itemRules, itemT, recipeT, setBonusT, tagT } from '../i18n/data';
import { lvOf, setCount as setCountOf, setGains, setWeight, setsOf, type SetCandidate } from '../data/sets';
import { tierBoostOf } from '../engine/build';
import { SET_ORDER, SET_THRESHOLDS, flavorOf } from '../engine/define';
import type { Build, ItemInstance, ItemTypeId, RecipeId, Rotation, RunState, SetId, ShopOffer } from '../types';

// Cell pitch in design pixels (cell + 4px gap). 92 for the 4×4 and 5×4 carts; shrinks so bigger carts fit the same 460×368 area.
let CELL = 92;
const cellFor = (cols: number, rows: number) => Math.min(92, Math.floor(460 / cols), Math.floor(368 / rows));
const RECIPE_ORDER = Object.keys(RECIPES) as RecipeId[];

let root: HTMLElement;
let ledger: { label: string; amount: number }[] = [];
let toastTimer = 0;

interface Drag {
  uid: string;
  type: ItemTypeId;
  rot: Rotation;
  grab: { x: number; y: number }; // grabbed cell inside the rotated footprint
  tier: number;
  ghost: HTMLElement | null;
  startX: number; startY: number;
  lastX: number; lastY: number;
  /** Screen position of the clamped grid target: while over the grid the ghost sits on its cells instead of following the pointer. */
  snap: { x: number; y: number } | null;
  target: MoveTarget | { where: 'sell' } | { where: 'merge'; uid: string } | null;
  /** The current target would accept the drop (a gamepad drop on an invalid target keeps holding). */
  valid: boolean;
  /** Held with the gamepad: the ghost follows the cursor cell instead of the pointer. */
  pad: boolean;
}
let drag: Drag | null = null;
let hoverUid: string | null = null;
let hoverType: ItemTypeId | null = null;
let hoverOffer: ShopOffer | undefined;
let hoverSlot: number | null = null;
let hoverSet: SetId | null = null;
let receiptPreview: ItemTypeId | null = null; // offer type whose set gains the receipt is currently previewing
let loyaltyOn = false;
let card: HTMLElement | null = null; // floating item card (body-level, like the drag ghost)
let cardHtml = '';
let hint: HTMLElement | null = null; // drop-feedback bubble that follows the drag ghost
let selectedUid: string | null = null;

export function initShop(ui: HTMLElement): void {
  root = document.createElement('div');
  root.id = 'shop';
  root.className = 'interactive hidden';
  ui.append(root);
  store.on('change', () => { if (!drag) render(); });
  store.on('shop-open', () => { ledger = []; hoverUid = null; hoverType = null; hoverSet = null; loyaltyOn = false; render(); });
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', padOff);
  root.addEventListener('click', onClick);
  root.addEventListener('contextmenu', onContext);
  root.addEventListener('pointerover', onHover);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', () => cancelDrag());
}

/** Returns true when the key was consumed (R rotate / Escape cancel while dragging). */
export function shopKey(e: KeyboardEvent): boolean {
  if (store.state.phase !== 'shop') return false;
  if (drag && e.key === 'Escape') { cancelDrag(); return true; }
  if (!drag && selectedUid && e.key === 'Escape') { selectedUid = null; refreshHover(); return true; }
  if (drag && matches(settings.keys, 'rotate', e.code)) { rotateHeld(); return true; }
  return false;
}

// ───────────────────────────── rendering ─────────────────────────────

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Border color class: ★1 common, ★2 rare, ★3 epic, gold for legendaries. */
export const rarityClass = (type: ItemTypeId, tier = 1): string => (ITEMS[type].legendary ? 'legendary' : `r${tier}`);

/** "Weapon · Ranged", "Utility", "Passive": the role split shown everywhere. */
export function kindLabel(type: ItemTypeId): string {
  const d = ITEMS[type];
  return t(d.kind === 'weapon' ? 'kindWeapon' : d.kind === 'module' ? 'kindUtility' : 'kindPassive');
}

/** Weapon tags (ranged / melee / area, electric) as small chips. */
export function tagChips(type: ItemTypeId): string {
  const d = ITEMS[type];
  const tags = [...(d.tags ?? []), ...(d.weapon && d.electrical ? ['electric'] : [])];
  return tags.length ? `<span class="tags">${tags.map((tg) => `<span class="tagchip ${tg}">${tagT(tg)}</span>`).join('')}</span>` : '';
}

export const starsHtml = (tier = 1): string =>
  tier > 1 ? `<span class="stars t${tier}" aria-label="${t('levelAria', { n: tier })}">★${tier}</span>` : '';

/**
 * Inner markup shared by placed items and the drag ghost. Non-rectangular footprints draw one joined
 * shape (tiles bridge the 4px gutters toward same-item neighbours) and keep icon/label/stars inside the
 * shape's best-connected "anchor" cell, so nothing spills over items sitting in the empty corners.
 */
function itemInner(type: ItemTypeId, rot: Rotation, tier = 1, cellPx = CELL, icon = `icon_${type}`): { html: string; w: number; h: number; shaped: boolean } {
  const cells = rotateCells(cellsFor(type, tier), rot);
  const w = Math.max(...cells.map((c) => c.x)) + 1, h = Math.max(...cells.map((c) => c.y)) + 1;
  const shaped = cells.length !== w * h;
  const content = `<img src="${svg(icon)}" alt="${itemT(type).name}"><span class="tag">${itemT(type).name}</span>${starsHtml(tier)}`;
  if (!shaped) return { w, h, shaped, html: content };
  const has = (x: number, y: number) => cells.some((c) => c.x === x && c.y === y);
  const n = (c: { x: number; y: number }) => [has(c.x + 1, c.y), has(c.x, c.y + 1), has(c.x - 1, c.y), has(c.x, c.y - 1)];
  const anchor = [...cells].sort((a, b) => n(b).filter(Boolean).length - n(a).filter(Boolean).length)[0];
  const r = 10, gut = 4, size = cellPx - gut;
  const tiles = cells.map((c) => {
    const [R, D, L, U] = n(c);
    const radius = `${U || L ? 0 : r}px ${U || R ? 0 : r}px ${D || R ? 0 : r}px ${D || L ? 0 : r}px`;
    const bw = (side: boolean) => (side ? 0 : 3);
    return `<i class="icell" style="left:${c.x * cellPx}px;top:${c.y * cellPx}px;width:${size + (R ? gut : 0)}px;height:${size + (D ? gut : 0)}px;` +
      `border-width:${bw(U)}px ${bw(R)}px ${bw(D)}px ${bw(L)}px;border-radius:${radius}"></i>`;
  }).join('');
  return { w, h, shaped, html: `${tiles}<div class="anchor" style="left:${anchor.x * cellPx}px;top:${anchor.y * cellPx}px;width:${size}px;height:${size}px">${content}</div>` };
}

/** Active-slot badge for a cart item: the slot number and its key, or a warning when the cart has more than three actives. */
function slotBadge(uid: string, compact = false): string {
  const slot = compact ? undefined : slotOfUid(store.state.inventory, uid);
  if (slot === undefined) return '';
  if (slot === null) return `<b class="slot-badge none" data-slot-uid="${uid}" title="${esc(t('activeNoSlotTip'))}">${esc(t('activeNoSlot'))}</b>`;
  const key = bindingLabel(settings.keys, ACTIVE_KEYS[slot - 1], t('keySpace'));
  return `<b class="slot-badge" data-slot-uid="${uid}" title="${esc(t('activeSlotTip', { n: slot, k: key }))}">${slot}<kbd>${esc(key)}</kbd></b>`;
}

function itemEl(it: ItemInstance, build: Build, extra = '', compact = false): string {
  const def = ITEMS[it.type];
  const full = itemInner(it.type, it.rot, it.tier, CELL, iconOf(it));
  // Shelf slots hold whole items regardless of footprint: draw them as one tile.
  const inner = compact ? { ...full, shaped: false, html: full.html.replace(/<i class="icell"[^>]*><\/i>/g, '') } : full;
  const on = build.recipes.some((r) => r.weaponUid === it.uid || r.supportUids.includes(it.uid));
  const canCombine = store.state.phase === 'shop' && !!mergePartner(it);
  const flavor = it.type === 'jellybeans' ? flavorOf(it) : null;
  return `<div class="item ${def.kind} ${rarityClass(it.type, it.tier)} ${flavor ? `flavor flavor-${flavor}` : ''} ${canCombine ? 'mergeable' : ''} ${inner.shaped ? 'shaped' : ''} ${on ? 'recipe-on' : ''} ${it.uid === selectedUid ? 'selected' : ''} ${extra}" data-uid="${it.uid}"
    style="left:${it.x * CELL}px;top:${it.y * CELL}px;width:${inner.w * CELL - 4}px;height:${inner.h * CELL - 4}px">${inner.html}${flavor ? `<b class="flavor-tag" title="${esc(t('flavorLabel', { f: tagT(flavor) }))}">${esc(tagT(flavor))}</b>` : ''}${slotBadge(it.uid, compact)}${it.double ? `<b class="dbl-mark" title="${esc(t('setDouble'))}">${t('doubleSticker')}</b>` : ''}</div>`;
}

export function gridHtml(s: RunState): string {
  CELL = cellFor(s.inventory.cols, s.inventory.rows);
  let cells = '';
  for (let y = 0; y < s.inventory.rows; y++)
    for (let x = 0; x < s.inventory.cols; x++) cells += `<div class="cell" data-cx="${x}" data-cy="${y}" style="left:${x * CELL}px;top:${y * CELL}px;width:${CELL - 4}px;height:${CELL - 4}px"></div>`;
  return cells + s.inventory.placed.map((it) => itemEl(it, s.build)).join('');
}

export function combosHtml(build: Build, preview?: Build | null, relevant: ItemTypeId[] = []): string {
  const now = new Set(build.recipes.map((r) => r.id));
  const next = preview ? new Set(preview.recipes.map((r) => r.id)) : null;
  const inv = store.state.inventory;
  const owned = new Set([...inv.placed.map((i) => i.type), ...inv.shelf.flatMap((i) => (i ? [i.type] : []))]);
  // Only four fit: active / previewed first, then the combos you're closest to completing.
  const have = new Set(relevant);
  const open = new Set(unlockedItems());
  const score = (id: RecipeId) => (now.has(id) ? 100 : 0) + (next?.has(id) ? 50 : 0) +
    recipeParts(RECIPES[id]).filter((t) => have.has(t)).length * 10 + (have.has(recipeIcon(RECIPES[id])) ? 5 : 0);
  // Only combos already in the Catalog are shown; an undiscovered one only appears as a mystery while a drop would trigger it.
  const known = (id: RecipeId) => profile.recipes.includes(id) || now.has(id);
  // ...and only if every component item is unlocked (or the combo is live / about to trigger).
  const shown = (id: RecipeId) => now.has(id) || next?.has(id) || (known(id) && recipeParts(RECIPES[id]).every((ty) => open.has(ty)));
  const ids = [...RECIPE_ORDER].filter(shown).sort((a, b) => score(b) - score(a)).slice(0, 4);
  if (!ids.length) return `<div class="combo empty"><div class="eff">${t('noCombos')}</div><div class="hint">${t('noCombosHint')}</div></div>`;
  return ids.map((id) => {
    if (!known(id)) {
      const r = RECIPES[id];
      return `<div class="combo preview mystery"><div class="ch"><span class="name">???</span><span class="chip">${t('dropDiscover')}</span></div>
        <div class="icons"><img src="${svg(`icon_${recipeIcon(r)}`)}" alt="">${r.supports.slice(r.weapon ? 0 : 1).map((ty) => `<b>+</b>${open.has(ty) ? `<img src="${svg(`icon_${ty}`)}" alt="${itemT(ty).name}">` : '<span class="q">?</span>'}`).join('')}</div>
        <div class="eff">${t('comboWaiting')}</div></div>`;
    }
    const r = RECIPES[id];
    const parts = recipeParts(r);
    let cls = now.has(id) ? 'on' : '';
    if (next && next.has(id) && !now.has(id)) cls = 'preview';
    if (next && !next.has(id) && now.has(id)) cls = 'lose';
    const got = parts.filter((t) => owned.has(t)).length;
    const chip = cls === 'on' ? t('active') : cls === 'preview' ? t('dropActivate') : cls === 'lose' ? t('willBreak') : t('owned', { a: got, b: parts.length });
    const icons = parts.map((ty) => `<img class="${owned.has(ty) || cls === 'on' ? '' : 'missing'}" src="${svg(`icon_${ty}`)}" alt="${itemT(ty).name}" title="${itemT(ty).name}">`).join('<b>+</b>');
    return `<div class="combo ${cls}" title="${esc(recipeT(id).name)}: ${esc(recipeT(id).detail)}">
      <div class="ch"><span class="name">${recipeT(id).name}</span><span class="chip">${chip}</span></div>
      <div class="icons">${icons}</div>
      <div class="eff">${esc(recipeT(id).short)}</div></div>`;
  }).join('');
}

/** Bonus text for one set level, rendered from the set's content file (src/content/sets/<id>.ts: tune arrays are L1/L2/L3). */
export const setBonus = setBonusT;

const setPips = (id: SetId, n: number, ghost = false): string => `<span class="pips set-${id}">${Array.from({ length: SET_THRESHOLDS[2] }, (_, k) => `<i class="${k < n ? 'on' : ghost && k === n ? 'ghost' : ''}"></i>`).join('')}</span>`;
const setTiers = (id: SetId, lv: number, fresh = 0, all = true): string => ([1, 2, 3] as const).filter((l) => all || l <= lv + 1).map((l) => `<div class="tier ${l <= lv ? '' : 'locked'} ${l === fresh ? 'new' : ''}"><em>${SET_THRESHOLDS[l - 1]}</em><span>${esc(setBonus(id, l))}</span></div>`).join('');
const setCount = (id: SetId): number => setCountOf(store.state.inventory.placed, id);
const setLv = (n: number): number => lvOf(n);
const chipHtml = (id: SetId): string => `<span class="chip set-${id}">${setIcon(id, 12)}${tagT(id)}</span>`;

/** Set coupons (inside the receipt): sets with >=1 type in the cart; full coupon at lv>=1, collapsed one-liner at lv0. `preview`: an offer type hovered in the shop, showing what it would add. */
/** The sets the cart has items of: count and bonus level, highest level first. */
export const activeSets = (): { id: SetId; n: number; lv: number }[] =>
  SET_ORDER.map((id) => ({ id, n: setCount(id) })).filter((x) => x.n > 0).map((x) => ({ ...x, lv: setLv(x.n) })).sort((a, b) => b.lv - a.lv || b.n - a.n);

export function setsHtml(preview?: SetCandidate): string {
  const t1 = SET_THRESHOLDS[0];
  const gm = new Map((preview ? setGains(store.state.inventory.placed, preview) : []).map((g) => [g.id, g]));
  const have = activeSets();
  const ghosts = SET_ORDER.filter((id) => gm.get(id)?.from === 0);
  if (!have.length && !ghosts.length) return '';
  return `<div class="cut">${t('setsTitle')}</div>` + have.map(({ id, n, lv }) => {
    const g = gm.get(id);
    if (g) {
      const nlv = setLv(g.to);
      const hd = `<div class="hd">${chipHtml(id)}<span class="arrow">${g.from}→${g.to}</span>${!nlv ? `<span class="need">${t('setNeed', { n: t1 - g.to })}</span>` : ''}${setPips(id, n, true)}</div>`;
      return `<div class="coupon set-${id} hot" data-set="${id}">${hd}${nlv ? setTiers(id, nlv, g.levelUp ? nlv : 0, false) : ''}</div>`;
    }
    const hd = `<div class="hd">${chipHtml(id)}${lv ? '' : `<span class="need">${t('setNeed', { n: t1 - n })}</span>`}${setPips(id, n)}</div>`;
    return `<div class="coupon set-${id} ${lv ? '' : 'dim'} ${preview ? 'faded' : ''}" data-set="${id}">${hd}${lv ? setTiers(id, lv, 0, false) : ''}</div>`;
  }).join('') + ghosts.map((id) => `<div class="coupon set-${id} ghost" data-set="${id}"><div class="hd">${chipHtml(id)}<span class="arrow">${t('setNew')}</span>${setPips(id, 0, true)}</div></div>`).join('');
}

/** Hover card for one set: progress, all tiers, and every item type that counts toward it (owned ones in colour). */
function setCardHtml(id: SetId): string {
  const n = setCount(id), have = new Set(store.state.inventory.placed.map((p) => p.type));
  const members = ITEM_IDS.filter((ty) => setsOf(ty).includes(id)).map((ty) => `<img class="${have.has(ty) ? '' : 'missing'}" src="${svg(`icon_${ty}`)}" alt="${itemT(ty).name}" title="${itemT(ty).name}">`).join('');
  return `<div class="setcard set-${id}"><div class="hd">${chipHtml(id)}<span class="cnt">${t('setProgress', { n, m: SET_THRESHOLDS[2] })}</span>${setPips(id, n)}</div>${setTiers(id, setLv(n))}<div class="mem">${t('setMembers')}</div><div class="members">${members}</div></div>`;
}

/** Sticker/hover detail for a set gain. */
const gainText = (g: ReturnType<typeof setGains>[number]): string => { const th = SET_THRESHOLDS, ni = th.findIndex((x) => x > g.to); return g.levelUp ? t('setStkUp', { n: lvOf(g.to) }) : t((['setStkMore', 'setStkMore2', 'setStkMore3'] as const)[Math.max(0, ni < 0 ? 2 : ni)], { n: th[Math.max(0, ni < 0 ? 2 : ni)] - g.to }); };

/** Offer-card set badges: level-up first, then sets already started, then new ones (max 3). Maxed / already-counted sets get none. */
function setBadges(placed: ItemInstance[], offer: SetCandidate): string {
  const gains = new Map(setGains(placed, offer).map((g) => [g.id, g]));
  const rank = (g: ReturnType<typeof setGains>[number]): number => (g.levelUp ? 0 : g.from >= 1 ? 1 : 2);
  return [...gains.values()].sort((a, b) => rank(a) - rank(b)).slice(0, 3).map((g) => {
    const lvl = lvOf(g.to);
    const detail = g.levelUp ? t('setIconUp', { n: lvl, b: setBonus(g.id, lvl as 1 | 2 | 3) }) : g.from === 0 ? t('setIconNew') : gainText(g);
    return `<span class="seticon set-${g.id} ${g.levelUp ? 'up' : g.from === 0 ? 'new' : ''}" title="${esc(`${tagT(g.id)} ${g.from}→${g.to}: ${detail}`)}">${setIcon(g.id, 18)}${g.levelUp ? '<u>!</u>' : ''}</span>`;
  }).join('');
}

function render(): void {
  const s = store.state;
  receiptPreview = null;
  const show = s.phase === 'shop' && !!s.shop;
  root.classList.toggle('hidden', !show);
  if (!show) { hideCard(); return; }
  const shop = s.shop!;
  const earned = s.coinLog.map((l) => `<div class="line"><span>${esc(l.label)}</span><span>+${l.amount}</span></div>`).join('');
  const spent = ledger.map((l) => `<div class="line ${l.amount < 0 ? 'neg' : ''}"><span>${esc(l.label)}</span><span>${l.amount > 0 ? '+' : ''}${l.amount}</span></div>`).join('');
  const infl = inflation(s, shop.shopIndex);
  const offers = shop.offers.map((o) => {
    const def = ITEMS[o.type];
    const lv = o.sold ? null : mergeTargetFor(s.inventory, o.type, o.tier);
    const poor = !o.sold && s.money < o.price; // shown by the red pill + title, not as text over the footprint
    const why = o.sold || poor ? '' : s.inventory.shelf.every(Boolean) ? t('shelfFull') : '';
    // Cards have width to spare but not height: show tall footprints lying down.
    const base = cellsFor(o.type, o.tier);
    const tall = Math.max(...base.map((c) => c.y)) > Math.max(...base.map((c) => c.x));
    const cells = tall ? base.map((c) => ({ x: c.y, y: c.x })) : base;
    const w = Math.max(...cells.map((c) => c.x)) + 1;
    const fp = cells.map((c) => `<i style="grid-column:${c.x + 1};grid-row:${c.y + 1}"></i>`).join('');
    const rar = def.legendary ? t('legendaryKind', { k: kindLabel(o.type) }) : o.tier === 3 ? t('epicKind', { k: kindLabel(o.type) }) : o.tier === 2 ? t('rareKind', { k: kindLabel(o.type) }) : kindLabel(o.type);
    const stks = o.sold ? '' : setBadges(s.inventory.placed, o);
    // Undiscounted price: struck through when a discount (Checkout, coupons, starter perk) baked a lower price in.
    const list = Math.max(1, Math.round(TIER.value(def.price, o.tier) * infl));
    const was = list > o.price ? list : Math.max(1, Math.round(o.price / infl));
    const struck = !o.sold && (list > o.price || infl > 1) ? was : undefined;
    return `<div class="card ${rarityClass(o.type, o.tier)} ${o.sold ? 'sold' : ''} ${why || poor ? 'blocked' : ''} ${lv ? 'lvl' : ''}" data-offer="${o.slot}" data-type="${o.type}" ${poor ? `title="${t('needCoins', { n: o.price - s.money })}"` : ''} ${o.sold ? `data-sold="${t('soldStamp')}"` : ''} role="button" tabindex="0"
      aria-label="${t('buyAria', { rar, name: itemT(o.type).name, price: o.price })}">
      <img class="art" src="${svg(`icon_${o.type}`)}" alt="">
      <div class="nm">${itemT(o.type).name}</div><div class="fp" style="grid-template-columns:repeat(${w},10px)">${fp}</div>
      <span class="price-tag">${costPill(o.price, s.money >= o.price, struck)}</span>
      ${lv ? `<span class="lvlup" title="${t('combinesTip', { name: itemT(o.type).name })}">${t('combinesTag', { n: (lv.tier ?? 1) + 1 })}</span>` : ''}
      ${o.double && !o.sold ? `<span class="dblpack" title="${esc(t('setDouble'))}">${t('packSticker')}</span>` : ''}
      ${stks ? `<div class="seticons">${stks}</div>` : ''}
      <div class="why">${why}</div></div>`;
  }).join('');
  const shelf = s.inventory.shelf.map((it, i) => `<div class="slot" data-slot="${i}">${it ? itemEl({ ...it, x: 0, y: 0, rot: 0 }, s.build, '', true).replace(/style="[^"]*"/, '') : ''}</div>`).join('');
  const rcost = repairCost(s);
  const isLast = shop.shopIndex + 1 >= BOSS_WAVE && !s.overtime;
  root.classList.toggle('lab', !!s.lab);
  root.innerHTML = `
    <div class="col-left receipt">
      <h3>Goblin Grocery</h3>
      <div class="sub">${s.lab && s.stats.wavesCleared === 0 ? t('receiptLab', { n: String(s.wave + 1).padStart(2, '0') }) : t('receiptCleared', { n: String(shop.shopIndex).padStart(2, '0'), k: s.stats.kills })}</div>
      <hr class="dash">
      <div class="lines">${earned || `<div class="line"><span>${t('noCoins')}</span><span>0</span></div>`}${spent ? '<hr class="dash">' + spent : ''}</div>
      <hr class="dash">
      <div class="total"><span>${t('wallet')}</span><span><img class="coin-ico" src="${svg('coin')}" alt=""> ${s.money}</span></div>
      <div class="hpbox"><img src="${svg('heart')}" width="26" alt=""><div class="hpbar"><i style="width:${(100 * s.hp) / s.build.maxHp}%"></i></div><span>${Math.ceil(s.hp)}/${s.build.maxHp}</span></div>
      <button class="btn small gold" data-act="repair" style="margin-top:10px" ${shop.repairUsed || s.hp >= s.build.maxHp || s.money < rcost ? 'disabled' : ''}>
        ${shop.repairUsed ? t('repaired') : t('repairBtn', { hp: ECONOMY.repairHp }) + costPill(rcost, s.money >= rcost)}</button>
      <div class="sets">${setsHtml()}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:12px"><div class="barcode"></div><small style="font-weight:800;text-align:center">${t('thanks')}</small></div>
      <div class="shop-hint">${t('idleHover')}</div>
    </div>
    <div class="col-mid">
      <div class="cart-title sticker">${t('cartLoadout')}</div>
      <div class="grid-wrap"><div class="grid" style="width:${s.inventory.cols * cellFor(s.inventory.cols, s.inventory.rows)}px;height:${s.inventory.rows * cellFor(s.inventory.cols, s.inventory.rows)}px;margin:0 auto">${gridHtml(s)}</div></div>
      <div class="combos">${combosHtml(s.build, null, relevantTypes())}</div>
    </div>
    <div class="col-right">
      <div class="offers-head"><h3>${t('todaysDeals')}</h3>${infl > 1 ? `<span class="inflation">${t('priceInflation', { n: Math.round((infl - 1) * 100) })}</span>` : ''}</div>
      <div class="offers">${offers}</div>
      <div class="head-btns services">${loyaltyHtml(s)}${serviceHtml(s)}</div>
      <div class="shelf-head"><h3>${t('stagingShelf')}</h3><small style="font-weight:800">${t('shelfNoFight')}</small></div>
      <div class="shelf" style="grid-template-columns:repeat(${s.inventory.shelf.length}, ${slotPx(s.inventory.shelf.length)}px)">${shelf}</div>
      <div class="sell" data-sell="1">${t('dropSell')}</div>
    </div>
    <div class="bottom">
      <button class="btn coral next" data-act="next">${s.labSandbox ? t('labFight') : isLast ? t('faceManager') : t('nextAisle')} ▸</button>
    </div>
    <div class="toast" style="opacity:0"></div>`;
  refreshHover();
  padReapply();
  if (shop.riseWait) { shop.riseWait = false; toast(t('toastRise')); }
}

/** Another owned copy (cart or shelf) that can be combined into `inst`: same type and tier, below max. */
export function mergePartner(inst: ItemInstance): ItemInstance | null {
  const inv = store.state.inventory;
  const tier = inst.tier ?? 1;
  if (ITEMS[inst.type].legendary || tier >= TIER.max) return null;
  const same = (o: ItemInstance | null): o is ItemInstance => !!o && o.uid !== inst.uid && o.type === inst.type && (o.tier ?? 1) === tier;
  // Prefer consuming a shelf copy so the cart layout stays as it is.
  return inv.shelf.find(same) ?? inv.placed.find(same) ?? null;
}

const ROW_ICONS = [icons.burst, icons.stopwatch];
// Stat-tile icons per row of tierScaling(type) for non-weapons (first row first).
const MOD_ICONS: Partial<Record<ItemTypeId, ((s?: number) => string)[]>> = {
  fan: [icons.wind, icons.speed], fuel: [icons.flame], battery: [icons.speed, icons.bolt], ice: [icons.snow], hotsauce: [icons.flame],
  pricegun: [icons.crosshair], popper: [icons.burst], doublebag: [icons.burst], multipack: [icons.plus, icons.burst],
  tape: [icons.arrow, icons.crosshair, icons.wind], lunchbox: [icons.heart], magnet: [icons.magnet], bell: [icons.stopwatch],
  energy: [icons.boot], coupon: [icons.coin], bubblewrap: [icons.shield], boot: [icons.boot, icons.burst],
};
const KIND_BY_TAG = { ranged: 'kindRanged', melee: 'kindMelee', area: 'kindArea' } as const;

/** Long single-word names (e.g. "Preisauszeichner") shrink so the level pill stays inside the card. */
const fitName = (n: string): number => (n.length > 14 ? 19 : n.length > 11 ? 22 : 26);

function slotChip(uid: string | null): string {
  const slot = uid ? slotOfUid(store.state.inventory, uid) : undefined;
  if (slot === undefined) return '';
  if (slot === null) return `<span class="chip slot-none slot-cycle" data-slot-uid="${uid}" title="${esc(t('activeNoSlotTip'))}">${esc(t('activeNoSlot'))}</span>`;
  return `<span class="chip slot-chip slot-cycle" data-slot-uid="${uid}" title="${esc(t('activeSlotPick'))}">${slot} · ${esc(bindingLabel(settings.keys, ACTIVE_KEYS[slot - 1], t('keySpace')))}</span>`;
}

export function inspectorHtml(type: ItemTypeId, uid: string | null, offer?: ShopOffer): string {
  const s = store.state;
  const def = ITEMS[type];
  const ws = uid ? s.build.weapons.find((x) => x.uid === uid) : null;
  const loc = uid ? findItem(s.inventory, uid) : null;
  const tier = loc?.inst.tier ?? offer?.tier ?? 1;
  const cells = cellsFor(type, tier);
  const w = Math.max(...cells.map((c) => c.x)) + 1, h = Math.max(...cells.map((c) => c.y)) + 1;
  const rc = rarityClass(type, tier);
  const rarity = t(def.legendary ? 'rarLegendary' : tier === 3 ? 'rarEpic' : tier === 2 ? 'rarRare' : 'rarCommon');
  const weaponTag = (def.tags ?? []).find((tg): tg is keyof typeof KIND_BY_TAG => tg in KIND_BY_TAG);
  const kind = def.kind === 'weapon' && weaponTag ? t(KIND_BY_TAG[weaponTag]) : kindLabel(type);
  const otherTags = (def.tags ?? []).filter((tg) => !(tg in KIND_BY_TAG));
  const gains = offer && !loc && s ? setGains(s.inventory.placed, offer) : [];
  const dblNote = offer?.double || loc?.inst.double ? `<span class="chip dbl">${esc(t('setDouble'))}</span>` : '';
  const flavor = type === 'jellybeans' ? (loc ? flavorOf(loc.inst) : null) : null;
  const binder = type === 'binder' && loc?.inst.binderFamily ? `<span class="chip">${esc(t('binderChip', { f: tagT(loc.inst.binderFamily), n: Math.min(20, (loc.inst.binderSold ?? 0) * 2) }))}</span>` : '';
  const points = setWeight({ type, tier, double: offer?.double || loc?.inst.double }, loc ? tierBoostOf(s.inventory.placed)(loc.inst) : 0);
  const setChips = setsOf(type, flavor ?? undefined).map((id) => { const g = gains.find((x) => x.id === id); return `<span class="chip set-${id}${s?.build?.sets?.[id] ? ' act' : ''}">${setIcon(id, 14)}${tagT(id)}${points > 1 ? ` +${points}` : ''}${g ? ` <small>(${gainText(g)})</small>` : ''}</span>`; }).join('');
  const head = `<header><span class="ico-tile ${rc}"><img src="${svg(loc ? iconOf(loc.inst) : `icon_${type}`)}" alt=""></span>
    <div class="hd"><div class="nm"><span style="font-size:${fitName(itemT(type).name)}px">${itemT(type).name}</span><b class="lv ${def.legendary ? 'leg' : `t${tier}`}">★${def.legendary ? '' : tier}</b></div>
    <span class="sub ${rc}">${rarity} · ${kind}</span></div></header>
    <div class="chips">${slotChip(uid)}${dblNote}${binder}${flavor ? `<span class="chip flavor-chip flavor-${flavor}">${esc(t('flavorLabel', { f: tagT(flavor) }))}</span>` : ''}${setChips}${otherTags.map((tg) => `<span class="chip">${tagT(tg)}</span>`).join('')}<span class="chip">${icons.grid(15)}${w}×${h}</span>
    <span class="chip coin"><img class="coin-ico" src="${svg('coin')}" alt="">${loc ? t('sells', { n: sellValue(loc.inst, sellPrice(type, tier, s?.build)) }) : def.price}</span></div>${strongVsHtml(type)}`;

  let body = '';
  // Weapon stats: live values when in the cart, the base values at this level otherwise (shelf / offer).
  const wd = def.weapon;
  const tile = (ic: string, v: string, label: string, small = false) => `<div class="stat ${small ? 'sm' : ''}">${ic}<b>${v}</b><small>${label}</small></div>`;
  if (ws || wd) {
    const dmg = ws ? ws.damage : wd!.damage * TIER.weaponDamage(tier);
    const cd = ws ? ws.cooldown : wd!.cooldown * TIER.weaponCooldown(tier);
    const rng = ws ? ws.range : wd!.range;
    const pat = ws?.pattern ?? wd!.pattern;
    const cnt = ws?.count ?? wd!.count ?? 1;
    body += `<div class="stats3">${tile(icons.burst(26), `${fmtNum(+dmg.toFixed(1))}${cnt > 1 ? ` ×${cnt}` : ''}`, t('statDamage'))}${tile(icons.stopwatch(26), `${fmtNum(cd.toFixed(2))} s`, t('statEvery'))}${tile(icons.crosshair(26), `${Math.round(rng)}`, t(pat === 'sweep' ? 'reachCap' : pat === 'pulse' || pat === 'aura' ? 'statRadius' : 'rangeCap'))}</div>`;
  }
  const modRows = wd ? [] : tierScaling(type).slice(0, 3);
  if (modRows.length) body += `<div class="stats3">${modRows.map((r, i) => tile((MOD_ICONS[type]?.[i] ?? icons.burst)(26), r.values[tier - 1], r.label)).join('')}</div>`;
  if (ws) {
    const kv: [string, string][] = [];
    if (ws.pierce) kv.push([t('statPierce'), `+${ws.pierce}`]);
    if (ws.burn) kv.push([t('statBurn'), `${fmtNum(+ws.burn.dps.toFixed(1))}/s`]);
    if (ws.slow) kv.push([t('statSlow'), `${Math.round(ws.slow.pct * 100)}%`]);
    if (ws.critChance) kv.push([t('statCrit'), `${Math.round(ws.critChance * 100)}%`]);
    if (ws.echo) kv.push([t('statDouble'), `${Math.round(ws.echo * 100)}%`]);
    if (kv.length) body += `<div class="kv">${kv.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>`;
    const buffs = describeBuffs(ws, s.inventory);
    if (buffs.length) body += `<ul class="boosts">${buffs.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
  }
  const callout = !ws && def.weapon && loc?.where === 'shelf'
    ? `<div class="callout">${icons.crate(30)}<div><b>${t('shelfTitle')}</b><span>${t('shelfText')}</span></div></div>` : '';

  body += `<p class="rules">${esc(itemRules(type, tier))}</p>`; // numbers follow the item's level

  // Level comparison: each level column tinted in its rarity colour, the current one stronger and labelled.
  const scale = tierScaling(type);
  if (scale.length) {
    const col = (lv: number) => `c${lv}${lv === tier ? ' cur' : ''}`;
    body += `<h5>${t('perLevel')}</h5><div class="scal"><span></span>${[1, 2, 3].map((lv) => `<em class="${col(lv)}"><b class="lv t${lv}">★${lv}</b>${lv === tier ? `<u>${t('current')}</u>` : ''}</em>`).join('')}${scale.map((r, ri) =>
      `<span>${wd ? (ROW_ICONS[ri]?.(16) ?? '') : ''}${r.label}</span>${r.values.map((v, i) => `<i class="${col(i + 1)}${ri === scale.length - 1 ? ' last' : ''}">${v}</i>`).join('')}`).join('')}</div>`;
  }

  // Combos this item belongs to: compact rows (partner icons · name · effect). Undiscovered ones are not shown at all.
  const combos = RECIPE_ORDER.filter((id) => recipeParts(RECIPES[id]).includes(type));
  const live = (id: RecipeId) => !!uid && s.build.recipes.some((x) => x.id === id && (x.weaponUid === uid || x.supportUids.includes(uid)));
  const seen = combos.filter((id) => profile.recipes.includes(id) || live(id));
  if (seen.length) {
    body += `<h5>${t('combos')}</h5>` + seen.map((id) => {
      const r = RECIPES[id], rt = recipeT(id);
      const on = live(id);
      const partners = recipeParts(r).filter((ty) => ty !== type);
      const icons = partners.map((ty) => `<img src="${svg(`icon_${ty}`)}" alt="" title="${itemT(ty).name}">`).join('');
      return `<div class="combo-row ${on ? 'on' : ''}" title="${t('needsTouching', { names: esc(partners.map((ty) => itemT(ty).name).join(' + ')) })}"><span class="ci">${icons}</span><span><b>${rt.name}</b><small>${esc(rt.short)}</small></span>${on ? `<em>${t('on')}</em>` : ''}</div>`;
    }).join('');
  }

  // Footer: combine (the only way to level up) — one click when a partner exists.
  let foot = '';
  if (loc && s.phase === 'shop') {
    const partner = mergePartner(loc.inst);
    const piece = (n: number, dim = false) => `<span class="cmb ${dim ? 'dim' : ''}"><img src="${svg(`icon_${type}`)}" alt=""><b class="lv t${n}">★${n}</b></span>`;
    const vis = `<div class="cvis">${piece(tier)}${icons.plus(18)}${piece(tier, !partner)}${icons.arrow(20)}${piece(tier + 1, true)}</div>`;
    if (def.legendary) foot = `<div class="foot-note">${t('legUnique')}</div>`;
    else if (tier >= TIER.max) foot = `<div class="foot-note">${t('maxLevel', { n: TIER.max })}</div>`;
    else if (partner) foot = `${vis}<button class="btn green combine" data-act="combine" data-uid="${uid}" data-partner="${partner.uid}">${t('combineBtn', { a: tier, b: tier + 1 })}</button>`;
    else foot = `${vis}<div class="foot-note">${t('getAnother', { a: tier, name: itemT(type).name, b: tier + 1 })}</div>`;
  }
  return `${head}${callout}<div class="ibody">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}`;
}

function refreshHover(): void {
  if (!root) return;
  const s = store.state;
  root.querySelectorAll('.item.affect, .item.setlit').forEach((n) => n.classList.remove('affect', 'setlit'));
  if (selectedUid && !findItem(s.inventory, selectedUid)) selectedUid = null;
  if (drag?.ghost || s.phase !== 'shop') { hideCard(); return; }
  const pv = hoverType && !hoverSet ? hoverType : null;
  if (pv !== receiptPreview) {
    receiptPreview = pv;
    const sets = root.querySelector('.sets');
    if (sets) { sets.innerHTML = setsHtml(pv ? hoverOffer : undefined); }
  }
  if (hoverSet) { // set coupon hover: glow member items, card to the right of the receipt
    for (const p of s.inventory.placed) if (setsOf(p.type, flavorOf(p)).includes(hoverSet)) root.querySelector(`.grid .item[data-uid="${p.uid}"]`)?.classList.add('setlit');
    showCard(setCardHtml(hoverSet), root.querySelector(`.coupon[data-set="${hoverSet}"]`), false);
    return;
  }
  if (loyaltyOn) { showCard(loyaltyHtml_(), root.querySelector('[data-act="loyalty"]'), false); return; }
  const focusUid = hoverType ? null : selectedUid; // cart item details only on right click
  const type = hoverType ?? (focusUid ? findItem(s.inventory, focusUid)?.inst.type : null);
  if (!type) { hideCard(); return; }
  if (focusUid) for (const [a, b] of s.build.adjacency) {
    const other = a === focusUid ? b : b === focusUid ? a : null;
    if (other) root.querySelector(`.grid .item[data-uid="${other}"]`)?.classList.add('affect');
  }
  const anchor = focusUid ? root.querySelector<HTMLElement>(`.item[data-uid="${focusUid}"]`) : root.querySelector<HTMLElement>(`.card[data-offer="${hoverSlot}"]`);
  showCard(inspectorHtml(type, focusUid, hoverType ? hoverOffer : undefined), anchor, !!focusUid && focusUid === selectedUid && s.phase === 'shop');
}

/** Floating item card beside `anchor`; `pinned` (selected item) makes it clickable for the Combine button. */
function showCard(html: string, anchor: HTMLElement | null, pinned: boolean): void {
  if (!anchor) { hideCard(); return; }
  if (!card) {
    card = document.createElement('div');
    card.className = 'inspector itemcard';
    card.addEventListener('click', onClick);
    card.addEventListener('pointerover', () => { // reaching the pinned card keeps it (not a neighbour's) on screen
      if (card?.classList.contains('pinned') && (hoverUid !== selectedUid || hoverType || loyaltyOn)) { hoverUid = selectedUid; hoverType = null; loyaltyOn = false; refreshHover(); }
    });
    document.body.append(card);
  }
  if (!pinned) html = html.replace(/<button class="btn green combine"[^>]*>.*?<\/button>/, `<div class="foot-note">${t('clickToCombine')}</div>`); // only the pinned card is clickable
  if (html !== cardHtml) { card.innerHTML = html; cardHtml = html; }
  card.classList.toggle('pinned', pinned);
  card.style.transition = settings.reducedMotion ? 'none' : '';
  if (settings.reducedMotion) card.style.translate = '0 0';
  const sc = scale(), m = 12;
  card.style.maxHeight = `${(innerHeight - 2 * m) / sc}px`;
  card.style.transform = `scale(${sc})`;
  const isSet = anchor.classList.contains('coupon'), colR = root.querySelector('.col-left')?.getBoundingClientRect();
  card.style.width = isSet && colR ? `${colR.width / sc}px` : ''; // set cards: same width as the receipt
  card.classList.toggle('tight', false);
  if (card.scrollHeight > card.clientHeight + 1) card.classList.add('tight'); // too tall: tighten spacing before anything scrolls
  const a = anchor.getBoundingClientRect(), w = card.offsetWidth * sc, h = card.offsetHeight * sc;
  // Right of the anchor, flipped left when it doesn't fit; cart items go left so the deals stay visible.
  if (isSet && colR) { // over the receipt: bottom 6px above the coupon, else 6px below it
    const top = root.getBoundingClientRect().top + 8;
    const ya = a.top - 6 - h;
    card.style.left = `${colR.left}px`;
    card.style.top = `${ya >= top ? ya : a.bottom + 6}px`;
    card.classList.add('show');
    return;
  }
  const left = anchor.closest('.grid') ? a.left - 14 - w : -1;
  let x = left >= m ? left : a.right + 14;
  if (x + w > innerWidth - m) x = a.left - 14 - w;
  x = Math.max(m, x);
  const y = Math.min(Math.max(m, a.top + a.height / 2 - h / 2), innerHeight - m - h);
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
  card.classList.add('show');
}

/** Read-only item card outside the shop (title Catalog): base stats at ★1, no run state needed. */
export const showItemCard = (type: ItemTypeId, anchor: HTMLElement): void => showCard(inspectorHtml(type, null), anchor, false);
export const hideItemCard = (): void => hideCard();

function hideCard(): void {
  card?.remove();
  card = null;
  cardHtml = '';
}

function toast(msg: string): void {
  const t = root.querySelector<HTMLElement>('.toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(toastTimer);
}

// ───────────────────────────── actions ─────────────────────────────

function onClick(e: MouseEvent): void {
  const s = store.state;
  if (s.phase !== 'shop') return;
  const el = e.target as HTMLElement;
  const slotEl = el.closest<HTMLElement>('[data-slot-uid]');
  if (slotEl) { cycleSlot(s.inventory, slotEl.dataset.slotUid!); play('click'); store.changed(); return; }
  const act = el.closest<HTMLElement>('[data-act]')?.dataset.act;
  const offer = el.closest<HTMLElement>('[data-offer]');
  if (selectedUid && !el.closest('.item[data-uid], .inspector, button, [data-offer], .slot')) { selectedUid = null; refreshHover(); }
  if (act === 'next') { play('click'); selectedUid = null; if (s.labSandbox) flow.labToArena(); else flow.leaveShop(); return; }
  if (act === 'loyalty') {
    const cost = shopUpgradeCost(s);
    const r = upgradeShop(s);
    if (r.ok) { ledger.push({ label: t('ledgerLoyalty', { n: s.shopLevel }), amount: -(cost ?? 0) }); play('upgrade'); toast(t('toastLoyalty', { n: s.shopLevel })); } else toast(r.reason);
    store.changed();
    return;
  }
  if (act === 'lock') { toggleShopLock(s); play('click'); store.changed(); return; }
  if (act === 'reroll') {
    const cost = currentRerollCost(s);
    const r = reroll(s, flow.rng);
    if (r.ok) { ledger.push({ label: cost ? t('ledgerReroll') : t('ledgerFreeReroll'), amount: -cost }); play('click'); } else toast(r.reason);
    store.changed();
    return;
  }
  if (act === 'repair') {
    const cost = repairCost(s);
    const r = repair(s);
    if (r.ok) { ledger.push({ label: t('ledgerRepair', { hp: ECONOMY.repairHp }), amount: -cost }); play('buy'); } else toast(r.reason);
    store.changed();
    return;
  }
  if (act === 'cart' || act === 'shelf') {
    const cost = act === 'cart' ? cartUpgradeCost(s) : shelfUpgradeCost(s);
    const r = act === 'cart' ? upgradeCart(s) : upgradeShelf(s);
    if (r.ok) {
      ledger.push({ label: act === 'cart' ? t('ledgerCart', { c: s.inventory.cols, r: s.inventory.rows }) : t('ledgerShelf'), amount: -(cost ?? 0) });
      play('upgrade');
    } else toast(r.reason);
    store.changed();
    return;
  }
  if (act === 'combine') {
    const btn = el.closest<HTMLElement>('[data-act="combine"]')!;
    const uid = btn.dataset.uid!, partner = btn.dataset.partner!;
    const it = findItem(s.inventory, uid)?.inst;
    const r = mergeItems(s, partner, uid);
    if (r.ok && it) { ledger.push({ label: t('ledgerCombined', { name: itemT(it.type).name, n: it.tier ?? 1 }), amount: 0 }); play('upgrade'); selectedUid = uid; }
    else if (!r.ok) toast(r.reason);
    store.changed();
    return;
  }
  if (offer) buy(Number(offer.dataset.offer));
}

function buy(slot: number): void {
  const s = store.state;
  const offer = s.shop?.offers.find((o) => o.slot === slot);
  if (!offer || offer.sold) return; // repeated clicks on a sold card do nothing
  const into = mergeTargetFor(s.inventory, offer.type, offer.tier);
  const r = buyOffer(s, slot);
  if (!r.ok) { toast(r.reason); play('click', { rate: 0.6 }); store.changed(); return; }
  ledger.push({ label: itemT(offer.type).name, amount: -offer.price });
  play('buy');
  store.changed();
  toast(t(into ? 'toastBoughtMerge' : 'toastBought', { name: itemT(offer.type).name }));
}

/** Right click on a cart item toggles its details card; elsewhere it clears it. */
function onContext(e: MouseEvent): void {
  const s = store.state;
  if (s.phase !== 'shop' || drag) return;
  const uid = (e.target as HTMLElement).closest<HTMLElement>('.item[data-uid]')?.dataset.uid ?? null;
  if (!uid && !selectedUid) return;
  e.preventDefault();
  selectedUid = uid && uid !== selectedUid ? uid : null;
  refreshHover();
}

function onHover(e: PointerEvent): void {
  if (drag) return;
  hoverFrom(e.target as HTMLElement);
}

/** Shows the card / receipt preview for whatever `el` is part of (pointer hover or gamepad cursor). */
function hoverFrom(el: HTMLElement): void {
  const item = el.closest<HTMLElement>('.item[data-uid]');
  const offer = el.closest<HTMLElement>('.card[data-type]:not(.sold)');
  const loyalty = !!el.closest('[data-act="loyalty"]');
  const uid = item?.dataset.uid ?? null;
  const set = (el.closest<HTMLElement>('.coupon[data-set]')?.dataset.set as SetId) ?? null;
  const type = (offer?.dataset.type as ItemTypeId) ?? null;
  if (uid === hoverUid && type === hoverType && loyalty === loyaltyOn && set === hoverSet) return;
  hoverSet = set;
  hoverUid = uid;
  hoverType = type;
  loyaltyOn = loyalty;
  hoverSlot = offer ? Number(offer.dataset.offer) : null;
  hoverOffer = offer ? store.state.shop?.offers.find((o) => o.slot === hoverSlot) : undefined;
  refreshHover();
}

// ───────────────────────────── drag & drop ─────────────────────────────

const scale = (): number => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0 || store.state.phase !== 'shop' || (e.target as HTMLElement).closest('[data-slot-uid]')) return;
  const itemEl = (e.target as HTMLElement).closest<HTMLElement>('.item[data-uid]');
  if (!itemEl) return;
  const found = findItem(store.state.inventory, itemEl.dataset.uid!);
  if (!found) return;
  e.preventDefault();
  padOff();
  const rect = itemEl.getBoundingClientRect();
  const cellPx = CELL * scale();
  const rot = found.where === 'grid' ? found.inst.rot : 0;
  const cells = rotateCells(cellsOf(found.inst), rot);
  // Grabbed cell = the footprint cell under the pointer (clamped onto the footprint).
  let gx = Math.floor((e.clientX - rect.left) / (found.where === 'grid' ? cellPx : rect.width / (Math.max(...cells.map((c) => c.x)) + 1)));
  let gy = Math.floor((e.clientY - rect.top) / (found.where === 'grid' ? cellPx : rect.height / (Math.max(...cells.map((c) => c.y)) + 1)));
  if (!cells.some((c) => c.x === gx && c.y === gy)) ({ x: gx, y: gy } = cells[0]);
  beginDrag(found.inst, rot, { x: gx, y: gy }, e.clientX, e.clientY);
}

/** Picks an item up (pointer press or gamepad A): `grab` is the footprint cell held, (x, y) where the ghost is anchored on screen. */
function beginDrag(inst: ItemInstance, rot: Rotation, grab: { x: number; y: number }, x: number, y: number): void {
  drag = { uid: inst.uid, type: inst.type, rot, tier: inst.tier ?? 1, grab, ghost: null, startX: x, startY: y, lastX: x, lastY: y, snap: null, target: null, valid: false, pad: false };
}

function startGhost(): void {
  if (!drag) return;
  play('click');
  root.querySelectorAll(`.item[data-uid="${drag.uid}"]`).forEach((n) => n.classList.add('lifted'));
  const g = document.createElement('div');
  g.className = `item ghost ${ITEMS[drag.type].kind}`;
  const tier = findItem(store.state.inventory, drag.uid)?.inst.tier;
  drag.tier = tier ?? 1;
  document.body.append(g);
  drag.ghost = g;
  hint = document.createElement('div');
  hint.className = 'drag-hint';
  document.body.append(hint);
  hideCard();
  sizeGhost();
}

function sizeGhost(): void {
  if (!drag?.ghost) return;
  const inner = itemInner(drag.type, drag.rot, drag.tier, CELL, dragIcon(drag));
  const { w, h } = inner;
  drag.ghost.innerHTML = inner.html;
  drag.ghost.classList.toggle('shaped', inner.shaped);
  const sc = scale();
  drag.ghost.style.width = `${w * CELL - 4}px`;
  drag.ghost.style.height = `${h * CELL - 4}px`;
  drag.ghost.style.transform = `scale(${sc})`;
  positionGhost();
}

function positionGhost(): void {
  if (!drag?.ghost) return;
  const cellPx = CELL * scale();
  drag.ghost.style.left = `${drag.snap?.x ?? drag.lastX - (drag.grab.x + 0.5) * cellPx}px`;
  drag.ghost.style.top = `${drag.snap?.y ?? drag.lastY - (drag.grab.y + 0.5) * cellPx}px`;
  if (hint) { // bubble to the right of the ghost, flipped left near the screen edge
    const r = drag.ghost.getBoundingClientRect(), w = hint.offsetWidth;
    hint.style.left = `${r.right + 12 + w > innerWidth ? Math.max(8, r.left - 12 - w) : r.right + 12}px`;
    hint.style.top = `${Math.min(Math.max(8, r.top), innerHeight - 8 - hint.offsetHeight)}px`;
  }
}

function rotateHeld(): void {
  if (!drag) return;
  const base = cellsFor(drag.type, drag.tier);
  const before = rotateCells(base, drag.rot);
  const idx = before.findIndex((c) => c.x === drag!.grab.x && c.y === drag!.grab.y);
  drag.rot = ((drag.rot + 1) % 4) as Rotation;
  // Rotate the grab cell along with the footprint (cw: (x,y) → (h-1-y, x)).
  const h = Math.max(...before.map((c) => c.y)) + 1;
  const g = before[Math.max(0, idx)];
  drag.grab = { x: h - 1 - g.y, y: g.x };
  if (!rotateCells(base, drag.rot).some((c) => c.x === drag!.grab.x && c.y === drag!.grab.y)) drag.grab = rotateCells(base, drag.rot)[0];
  play('click', { rate: 1.3 });
  sizeGhost();
  updateTarget();
}

function onPointerMove(e: PointerEvent): void {
  if (!drag) return;
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  if (!drag.ghost) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
    startGhost();
  }
  positionGhost();
  updateTarget();
}

function updateTarget(): void {
  if (!drag) return;
  const s = store.state;
  root.querySelectorAll('.cell.ok, .cell.bad, .slot.ok, .sell.ok, .item.affect').forEach((n) => n.classList.remove('ok', 'bad', 'affect'));
  const under = document.elementFromPoint(drag.lastX, drag.lastY) as HTMLElement | null;
  const grid = root.querySelector<HTMLElement>('.grid')!;
  const slot = under?.closest<HTMLElement>('.slot');
  const sell = under?.closest<HTMLElement>('.sell');
  let preview: Build | null = null;
  let sellHint = '';
  drag.target = null;
  drag.snap = null;
  drag.valid = false;
  const over = under?.closest<HTMLElement>('.item[data-uid]');
  const overInst = over && over.dataset.uid !== drag.uid ? findItem(s.inventory, over.dataset.uid!)?.inst : null;
  root.querySelector('.item.merge')?.classList.remove('merge');
  if (overInst && overInst.type === drag.type) {
    const res = previewMerge(s, drag.uid, overInst.uid);
    drag.ghost?.classList.toggle('bad', !res.result.ok);
    if (res.result.ok) { drag.target = { where: 'merge', uid: overInst.uid }; drag.valid = true; preview = res.build; over!.classList.add('merge'); }
    setHint(res.result.ok
      ? `<div class="nm">${t('mergeTitle', { n: (overInst.tier ?? 1) + 1 })}</div><div>${t('mergeBody', { name: itemT(drag.type).name })}</div>`
      : `<div class="nm">${t('cantMerge')}</div><div>${esc(res.result.ok ? '' : res.result.reason)}</div>`);
    const combos = root.querySelector('.combos');
    if (combos) combos.innerHTML = combosHtml(s.build, preview, relevantTypes());
    const sets = root.querySelector('.sets');
    if (sets) { sets.innerHTML = setsHtml(); }
    return;
  }
  if (under && grid.contains(under)) {
    const r = grid.getBoundingClientRect();
    const cellPx = r.width / (s.inventory.cols * CELL - 0) * CELL;
    const px = Math.floor((drag.lastX - r.left) / cellPx), py = Math.floor((drag.lastY - r.top) / cellPx);
    // Holding a tall item by any cell above its last one and pointing at the bottom row must not push it out of the frame: clamp the footprint into the grid.
    const size = rotatedSize(drag.type, drag.rot, drag.tier);
    const target: MoveTarget = {
      where: 'grid', rot: drag.rot,
      x: Math.min(Math.max(px - drag.grab.x, 0), s.inventory.cols - size.w),
      y: Math.min(Math.max(py - drag.grab.y, 0), s.inventory.rows - size.h),
    };
    drag.snap = { x: r.left + target.x * cellPx, y: r.top + target.y * cellPx };
    const res = previewMove(s, drag.uid, target);
    drag.target = target;
    drag.valid = res.result.ok;
    const cells = footprint({ uid: drag.uid, type: drag.type, tier: drag.tier, x: target.x, y: target.y, rot: drag.rot });
    for (const c of cells) root.querySelector(`.cell[data-cx="${c.x}"][data-cy="${c.y}"]`)?.classList.add(res.result.ok ? 'ok' : 'bad');
    drag.ghost?.classList.toggle('bad', !res.result.ok);
    if (res.build) {
      preview = res.build;
      for (const [a, b] of res.build.adjacency) {
        const other = a === drag.uid ? b : b === drag.uid ? a : null;
        if (other) root.querySelector(`.grid .item[data-uid="${other}"]`)?.classList.add('affect');
      }
    }
  } else if (slot) {
    const target: MoveTarget = { where: 'shelf', slot: Number(slot.dataset.slot) };
    const res = previewMove(s, drag.uid, target);
    if (res.result.ok) { slot.classList.add('ok'); drag.target = target; drag.valid = true; preview = res.build; }
  } else if (sell) {
    sell.classList.add('ok');
    const worth = dragWorth(drag);
    sell.textContent = t('sellFor', { name: itemT(drag.type).name, n: worth });
    sellHint = `<div class="nm">${t('sellFor', { name: itemT(drag.type).name, n: worth })}</div>`;
    drag.target = { where: 'sell' };
    drag.valid = true;
  }
  if (!sell) { const z = root.querySelector('.sell'); if (z) z.textContent = t('dropSell'); }
  const combos = root.querySelector('.combos');
  if (combos) combos.innerHTML = combosHtml(s.build, preview, relevantTypes());
  const sets = root.querySelector('.sets');
  if (sets) { sets.innerHTML = setsHtml(); }
  setHint(sellHint || `<div class="nm">${itemT(drag.type).name}${starsHtml(drag.tier)}</div>`);
}

function setHint(html: string): void {
  if (!hint) return;
  const keys = drag?.pad ? ['X', 'B'] : [keyLabel(settings.keys.rotate.find(Boolean) ?? ''), 'ESC'];
  hint.innerHTML = `${html}<div class="muted"><kbd>${keys[0]}</kbd> ${t('rotate')} · <kbd>${keys[1]}</kbd> ${t('cancel')}</div>`;
  positionGhost();
}

function endDrag(): void {
  drag?.ghost?.remove();
  hint?.remove();
  hint = null;
}

function onPointerUp(): void {
  if (!drag) return;
  const d = drag;
  endDrag();
  drag = null;
  if (!d.ghost) return; // a plain click does nothing; right click opens the inspector
  commitDrop(d);
}

const dragInst = (d: Drag) => findItem(store.state.inventory, d.uid)?.inst;
const dragIcon = (d: Drag): string => { const i = dragInst(d); return i ? iconOf(i) : `icon_${d.type}`; };
const dragWorth = (d: Drag): number => { const i = dragInst(d); const base = sellPrice(d.type, d.tier, store.state.build); return i ? sellValue(i, base) : base; };

/** Applies a finished drag to the run (pointer release or gamepad drop). */
function commitDrop(d: Drag): void {
  const s = store.state;
  const tg = d.target;
  let ok = false;
  if (tg && tg.where === 'sell') {
    const price = dragWorth(d);
    const r = sellItem(s, d.uid);
    ok = r.ok;
    if (r.ok) { ledger.push({ label: t('ledgerSold', { name: itemT(d.type).name }), amount: price }); play('sell'); } else toastLater(r.reason);
  } else if (tg && tg.where === 'merge') {
    const r = mergeItems(s, d.uid, tg.uid);
    ok = r.ok;
    if (r.ok) { play('upgrade'); ledger.push({ label: t('ledgerMerged', { name: itemT(d.type).name }), amount: 0 }); hoverUid = tg.uid; } else toastLater(r.reason);
  } else if (tg) {
    const r = moveItem(s, d.uid, tg);
    ok = r.ok;
    if (r.ok) play('click', { rate: 0.8 }); else toastLater(r.reason);
  }
  if (ok && tg?.where === 'merge') { selectedUid = tg.uid; hoverUid = tg.uid; }
  else hoverUid = ok && tg?.where !== 'sell' ? d.uid : null;
  render(); // invalid drop: re-render restores the original position, nothing else changed
  store.changed();
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

const slotPx = (n: number) => (n <= 4 ? 86 : Math.floor((372 - (n - 1) * 8) / n));

/** Store services: grow the cart or the staging shelf (prices rise each time), plus reroll. */
/** Coin cost pill; red when unaffordable, green FREE at 0. */
const costPill = (n: number, can: boolean, was?: number): string => n === 0 ? `<span class="cost free">${t('free')}</span>` : `<span class="cost ${can ? '' : 'no'}"><img class="coin-ico" src="${svg('coin')}" alt="">${was ? `<s class="was">${was}</s>` : ''}${n}</span>`;

function serviceHtml(s: RunState): string {
  const cc = cartUpgradeCost(s), size = nextCartSize(s), sc = shelfUpgradeCost(s);
  const cart = cc === null
    ? `<button class="btn small svc" disabled>${t('cartMax')}</button>`
    : `<button class="btn small svc" data-act="cart" ${s.money < cc ? 'disabled' : ''} title="${t('cartTip', { c: size![0], r: size![1] })}"><span class="lbl">${t('cartBtn', { c: size![0], r: size![1] })}</span>${costPill(cc, s.money >= cc)}</button>`;
  const shelf = sc === null
    ? `<button class="btn small svc" disabled>${t('shelfMax')}</button>`
    : `<button class="btn small svc" data-act="shelf" ${s.money < sc ? 'disabled' : ''} title="${t('shelfTip')}"><span class="lbl">${t('shelfBtn')}</span>${costPill(sc, s.money >= sc)}</button>`;
  const rr = currentRerollCost(s);
  const locked = !!s.shop?.locked;
  return cart + shelf + `<button class="btn small svc" data-act="reroll" ${locked || s.money < rr ? 'disabled' : ''} ${locked ? `title="${t('rShopLocked')}"` : ''}><span class="lbl">${t('reroll')}</span>${costPill(rr, s.money >= rr)}</button>`
    + `<button class="btn small svc${locked ? ' on' : ''}" data-act="lock" aria-pressed="${locked}" title="${t('lockTip')}"><span class="lbl">${locked ? '🔒 ' + t('locked') : '🔓 ' + t('lock')}</span></button>`;
}

function loyaltyHtml(s: RunState): string {
  const cost = shopUpgradeCost(s);
  return `<button class="btn small loyalty" data-act="loyalty" title="${t('loyaltyName')}" ${cost === null || s.money < cost ? 'disabled' : ''}>
    <span class="lbl"><img src="${svg('loyalty_card')}" alt="">${cost === null ? t('loyaltyMax') : t('loyaltyBtn', { n: s.shopLevel + 1 })}</span>${cost === null ? '' : costPill(cost, s.money >= cost)}</button>`;
}

function loyaltyHtml_(): string {
  const s = store.state;
  const row = (lv: number) => {
    const L = SHOP_LEVELS[lv - 1];
    return `<div class="${lv === s.shopLevel ? 'buff' : 'muted'}">${t('loyaltyRow', { n: lv, a: pct(L.tier2), b: pct(L.tier3), c: pct(L.legendary) })}${L.freeReroll ? ` · ${t('freeReroll')}` : ''}</div>`;
  };
  return `<header><div class="nm">${t('loyaltyCard')}</div></header><div class="ibody"><div>${t('loyaltyInfo')}</div>${[1, 2, 3, 4].map(row).join('')}</div>`;
}

/** Owned + currently offered types: decides which combo hints are worth showing. */
function relevantTypes(): ItemTypeId[] {
  const s = store.state;
  return [...s.inventory.placed.map((i) => i.type), ...s.inventory.shelf.flatMap((i) => (i ? [i.type] : [])), ...(s.shop?.offers.map((o) => o.type) ?? [])];
}

function toastLater(msg: string): void {
  setTimeout(() => toast(msg), 0);
}

function cancelDrag(): void {
  if (!drag) return;
  endDrag();
  drag = null;
  render();
}

// ───────────────────────────── gamepad cursor ─────────────────────────────
// A cursor over the shop's targets (offer cards, cart cells, shelf slots, buttons; the sell zone while holding).
// It is identified by a key so it survives the shop re-rendering, and it reuses the pointer code for buying, grabbing, previewing and dropping.

let padKey: string | null = null;
let padCenter = { x: 0, y: 0 };

interface PadTarget { key: string; el: HTMLElement }

function padTargets(): PadTarget[] {
  const out: PadTarget[] = [];
  const add = (key: string, el: HTMLElement) => { if (el.getClientRects().length) out.push({ key, el }); };
  if (!drag) {
    root.querySelectorAll<HTMLElement>('.card[data-offer]:not(.sold)').forEach((el) => add(`offer:${el.dataset.offer}`, el));
    root.querySelectorAll<HTMLElement>('[data-act]:not([disabled])').forEach((el) => add(`act:${el.dataset.act}:${el.dataset.uid ?? ''}`, el));
  }
  root.querySelectorAll<HTMLElement>('.cell[data-cx]').forEach((el) => add(`cell:${el.dataset.cx},${el.dataset.cy}`, el));
  root.querySelectorAll<HTMLElement>('.slot[data-slot]').forEach((el) => add(`slot:${el.dataset.slot}`, el));
  if (drag) root.querySelectorAll<HTMLElement>('.sell').forEach((el) => add('sell', el));
  return out;
}

const padItemAt = (key: string): ItemInstance | null => {
  const inv = store.state.inventory;
  if (key.startsWith('slot:')) return inv.shelf[Number(key.slice(5))] ?? null;
  if (!key.startsWith('cell:')) return null;
  const [cx, cy] = key.slice(5).split(',').map(Number);
  return inv.placed.find((i) => footprint(i).some((c) => c.x === cx && c.y === cy)) ?? null;
};

function padCurrent(): PadTarget | null {
  const list = padTargets();
  if (!list.length) return null;
  const hit = list.find((t) => t.key === padKey);
  if (hit) return hit;
  // The old target is gone (sold card, closed inspector): take the nearest remaining one.
  const d = (t: PadTarget) => { const r = t.el.getBoundingClientRect(); return Math.hypot(r.left + r.width / 2 - padCenter.x, r.top + r.height / 2 - padCenter.y); };
  return list.reduce((a, b) => (d(b) < d(a) ? b : a));
}

/** Highlights the cursor and, like hovering, shows the card for what is under it (or moves the held ghost there). */
function padApply(tg: PadTarget | null, hover = true): void {
  root.querySelectorAll('.pad-cur').forEach((n) => n.classList.remove('pad-cur'));
  if (!tg) return;
  padKey = tg.key;
  const r = tg.el.getBoundingClientRect();
  padCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  tg.el.classList.add('pad-cur');
  const inst = padItemAt(tg.key);
  const itemEl = inst ? root.querySelector<HTMLElement>(`.item[data-uid="${inst.uid}"]`) : null;
  if (!drag) itemEl?.classList.add('pad-cur');
  if (drag) {
    drag.lastX = padCenter.x;
    drag.lastY = padCenter.y;
    positionGhost();
    updateTarget();
  } else if (hover) hoverFrom(itemEl ?? tg.el);
}

function padReapply(): void {
  if (padKey && root && !drag) padApply(padCurrent());
}

/** Pointer takes over: drop the cursor highlight. */
function padOff(): void {
  if (!padKey) return;
  padKey = null;
  root.querySelectorAll('.pad-cur').forEach((n) => n.classList.remove('pad-cur'));
}

export const shopPad: ShopPad = {
  enter() {
    if (!root || store.state.phase !== 'shop') return;
    const list = padTargets();
    padApply(list.find((t) => t.key.startsWith('offer:')) ?? list[0] ?? null);
  },
  move(dir: Dir) {
    const list = padTargets();
    if (!list.length) return;
    const cur = padCurrent();
    if (!cur) return;
    if (!padKey) { padApply(cur); return; }
    const i = list.findIndex((t) => t.key === cur.key);
    const next = pickNext(list.map((t) => t.el.getBoundingClientRect()), i, dir);
    if (next >= 0) padApply(list[next]);
  },
  confirm() {
    const tg = padCurrent();
    if (!tg) return;
    if (drag) { // drop where the cursor is; an invalid spot keeps the item in hand
      if (!drag.valid) { play('click', { rate: 0.6 }); return; }
      const d = drag;
      endDrag();
      drag = null;
      commitDrop(d);
      return;
    }
    if (tg.key.startsWith('offer:')) { buy(Number(tg.key.slice(6))); return; }
    if (tg.key.startsWith('act:')) { tg.el.click(); return; }
    const inst = padItemAt(tg.key);
    if (!inst) return;
    const rot = tg.key.startsWith('cell:') ? inst.rot : 0;
    const cells = rotateCells(cellsOf(inst), rot);
    let grab = cells[0];
    if (tg.key.startsWith('cell:')) {
      const [cx, cy] = tg.key.slice(5).split(',').map(Number);
      grab = cells.find((c) => c.x === cx - inst.x && c.y === cy - inst.y) ?? cells[0];
    }
    beginDrag(inst, rot, { x: grab.x, y: grab.y }, padCenter.x, padCenter.y);
    drag!.pad = true;
    startGhost();
    padApply(tg);
  },
  cancel() {
    if (drag) { cancelDrag(); padReapply(); return; }
    if (selectedUid) { selectedUid = null; refreshHover(); }
  },
  rotate() {
    if (drag) rotateHeld();
  },
  inspect() {
    if (drag) return;
    const tg = padCurrent();
    const inst = tg ? padItemAt(tg.key) : null;
    if (inst) { selectedUid = inst.uid; render(); }
  },
};
