import { t } from '../i18n';
import { enemyT, itemT, setBonusT, tagT } from '../i18n/data';
import { ENEMIES, MINI_BOSS, enemyFrame, isBossId } from '../data/enemies';
import { ITEMS, ITEM_IDS } from '../data/items';
import { ELEMENT_COLORS } from '../engine/damageType';
import { store } from '../state/store';
import { settings } from '../state/settings';
import { labAddItem, labAisle, labClear, reroll } from '../state/run';
import { LAB_SLOT_COUNT, captureSlot, restoreSlot, slotItems } from '../state/lab';
import { currentRerollCost } from '../systems/shop';
import { DpsMeter } from '../systems/dpsMeter';
import { totalDamage } from '../systems/damageStats';
import { LAB, labDummies, loadSlots, saveSlots, type LabDummy } from '../lab';
import { flow } from '../flow';
import { play } from '../audio/sfx';
import type { ArenaScene } from '../scenes/ArenaScene';
import type { EnemyId, ItemTypeId } from '../types';
import { svg } from './hud';
import { activeSets, rarityClass } from './shop';
import { setIcon } from './icons';
import { SET_THRESHOLDS } from '../engine/define';
import { sourceNames } from './damageBreakdown';
import { labFormHtml, readLabControl } from './labFields';
import { fmtNum } from '../i18n';

// The Test Lab bench: one docked panel for the whole lab loop. In the cart editor it takes the place of the receipt column (so nothing overlaps
// the cart or the combos), in the arena it floats at the left under the HUD. Tabs: Items (catalog, loadout slots), Dummies (spawner),
// Meter (damage per second) and Setup (aisle, department, modifier ... edited live, see ui/labFields).

type Tab = 'items' | 'foes' | 'meter' | 'setup';

let el: HTMLElement;
let tab: Tab = 'items';
let collapsed = false; // arena only; the cart editor always shows the bench
let tier = 1;
let target: 'cart' | 'shelf' = 'cart';
let query = '';
let status = '';
let resetArmed = false;
let resetTimer = 0;
let slots = loadSlots();
const foe = { moves: false, immortal: true, elite: false, count: 1 };
const meter = new DpsMeter();
let builtKey = '';
let prevPhase = '';

const IDS = Object.keys(ENEMIES) as EnemyId[];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const inFight = () => store.state.phase === 'combat';

/** The tabs that make sense right now: Items needs the cart editor, Dummies the sandbox, Setup a plain lab run (not a sim). */
function tabsNow(): Tab[] {
  const s = store.state, shop = s.phase === 'shop';
  return ([shop && 'items', (shop || s.labSandbox) && 'foes', 'meter', flow.labSetup && (shop || s.labSandbox) && 'setup'] as (Tab | false | null)[]).filter((x): x is Tab => !!x);
}

// ───────────────────────────── render ─────────────────────────────

const tabLabel: Record<Tab, () => string> = { items: () => t('lbTabItems'), foes: () => t('lbTabFoes'), meter: () => t('lbTabMeter'), setup: () => t('lbTabSetup') };

function itemsHtml(): string {
  const s = store.state;
  const seg = (attr: string, cur: string | number, vals: [string | number, string][]) => vals.map(([v, l]) => `<button class="btn small ${String(v) === String(cur) ? 'coral' : ''}" data-${attr}="${v}">${l}</button>`).join('');
  const pal = ITEM_IDS.map((ty) => {
    const name = itemT(ty).name;
    return `<button class="lb-item ${rarityClass(ty, tier)}" data-lb-add="${ty}" title="${esc(name)}" aria-label="${esc(t('labAddAria', { name }))}" ${matches(ty, query) ? '' : 'hidden'}><img src="${svg(`icon_${ty}`)}" alt=""></button>`;
  }).join('');
  const slotRows = Array.from({ length: LAB_SLOT_COUNT }, (_, i) => {
    const n = slotItems(slots[i]);
    return `<div class="lb-slot"><b>${t('lbSlotN', { n: i + 1 })}</b><span>${n ? t('lbSlotItems', { n }) : t('lbSlotEmpty')}</span>
      <button class="btn small" data-lb-save="${i}">${t('lbSave')}</button><button class="btn small" data-lb-load="${i}" ${n ? '' : 'disabled'}>${t('lbLoad')}</button></div>`;
  }).join('');
  return `<input class="lb-search" type="search" value="${esc(query)}" placeholder="${t('lbSearch')}" aria-label="${t('lbSearch')}" autocomplete="off">
    <div class="lb-seg"><span>${t('lbTier')}</span>${seg('lb-tier', tier, [[1, '★1'], [2, '★2'], [3, '★3']])}</div>
    <div class="lb-seg"><span>${t('lbPutIn')}</span>${seg('lb-target', target, [['cart', t('lbCart')], ['shelf', t('lbShelf')]])}</div>
    <div class="lb-pal">${pal}</div>
    <div class="lb-btns"><button class="btn small" data-lb="clear">${t('labClear')}</button><button class="btn small" data-lb="money">${t('labFill')}</button><button class="btn small" data-lb="reroll" ${s.shop?.locked ? 'disabled' : ''}>${t('labRerollFree')}</button></div>
    <h4>${t('lbLoadouts')}</h4>${slotRows}`;
}

function matches(ty: ItemTypeId, q: string): boolean {
  const n = q.trim().toLowerCase();
  return !n || itemT(ty).name.toLowerCase().includes(n) || ty.toLowerCase().includes(n) || tagT(ITEMS[ty].family).toLowerCase().includes(n);
}

const rosterKey = (d: LabDummy) => `${d.id}|${d.mini ?? ''}`;

function foesHtml(): string {
  const s = store.state, theme = s.theme;
  const btn = (id: EnemyId, cls: string, title: string, mini?: number) =>
    `<button class="lb-item ${cls}" data-lb-foe="${id}" ${mini === undefined ? '' : `data-lb-mini="${mini}"`} title="${esc(title)}" aria-label="${esc(t('sbSpawnAria', { name: title }))}"><img src="${svg(enemyFrame(id))}" alt=""></button>`;
  const minis = MINI_BOSS.variants.map((v, i) => { const id = v.byTheme[theme] ?? v.byTheme.main!; return btn(id, 'r3', t('miniBossBar', { name: enemyT(id).name }), i); });
  const pal = [...IDS.map((id) => btn(id, isBossId(id) ? 'legendary' : 'r1', enemyT(id).name)), ...minis].join('');
  const chk = (k: 'moves' | 'immortal' | 'elite', label: string) => `<label class="check"><input type="checkbox" data-lb-foe-opt="${k}" ${foe[k] ? 'checked' : ''}>${label}</label>`;
  const counts = [1, 3, 5, 10].map((n) => `<button class="btn small ${n === foe.count ? 'coral' : ''}" data-lb-count="${n}">${n}</button>`).join('');
  let roster = '';
  if (s.phase === 'shop') {
    const by = new Map<string, number>();
    for (const d of labDummies) by.set(rosterKey(d), (by.get(rosterKey(d)) ?? 0) + 1);
    const chips = [...by].map(([k, n]) => { const d = labDummies.find((x) => rosterKey(x) === k)!; return `<span class="lb-chip">${esc(enemyT(d.id).name)} ×${n}</span>`; }).join('');
    roster = `<h4>${t('lbRoster')}</h4><div class="lb-chips">${chips || `<i>${t('lbRosterEmpty')}</i>`}</div><div class="lb-note">${t('lbRosterShop')}</div>`;
  }
  return `<div class="lb-pal six">${pal}</div>
    ${chk('moves', t('sbMove'))}${chk('immortal', t('sbImmortal'))}${chk('elite', t('lbElite'))}
    <div class="lb-seg"><span>${t('sbCount')}</span>${counts}</div>
    <div class="lb-btns"><button class="btn small" data-lb="despawn">${t('sbDespawn')}</button></div>
    ${roster}${s.phase === 'combat' ? `<div class="lb-note">${t('lbDragHint')}</div>` : ''}`;
}

function meterHtml(): string {
  return `<div class="lb-meter" data-lb-meter></div>
    <div class="lb-btns"><button class="btn small" data-lb="meter-reset">${t('lbMeterReset')}</button></div><div class="lb-note">${t('lbMeterAuto')}</div>`;
}

function setupHtml(): string {
  const o = flow.labSetup;
  return o ? `<div class="settings lab-bench-form">${labFormHtml({ ...o, aisle: labAisle(store.state) }, inFight() ? 'arena' : 'shop')}</div>` : ''; // the run's aisle, which a real run moves on by itself
}

/** One chip per set the cart has items of: name, bonus level (or progress toward the first one), the bonus text as the tooltip. */
function setsRowHtml(): string {
  const chips = activeSets().map(({ id, n, lv }) => {
    const tip = lv ? `${tagT(id)} ${lv}: ${setBonusT(id, lv as 1 | 2 | 3)}` : tagT(id);
    return `<span class="lb-set ${lv ? 'on' : ''}" title="${esc(tip)}">${setIcon(id, 14)}${esc(tagT(id))} <b>${lv || `${n}/${SET_THRESHOLDS[0]}`}</b></span>`;
  }).join('');
  return chips ? `<div class="lb-sets">${chips}</div>` : '';
}

function html(tabs: Tab[]): string {
  const s = store.state, shop = s.phase === 'shop';
  const body = { items: itemsHtml, foes: foesHtml, meter: meterHtml, setup: setupHtml }[tab]();
  const foot = shop || !s.labSandbox ? '' : `<button class="btn small coral" data-lb="cart">${t('lbEditCart')}</button>`;
  return `<div class="lb-head"><h3>${t('lbTitle')}</h3>
      <span class="lb-live"><img class="coin-ico" src="${svg('coin')}" alt=""><b data-lb-money></b><img src="${svg('heart')}" width="18" alt=""><b data-lb-hp></b></span>
      ${shop ? '' : `<button class="btn small" data-lb="collapse" title="${t('lbCollapse')}" aria-label="${t('lbCollapse')}">–</button>`}</div>
    <div class="lb-tabs" role="tablist">${tabs.map((k) => `<button class="lb-tab ${k === tab ? 'on' : ''}" role="tab" aria-selected="${k === tab}" data-lb-tab="${k}">${tabLabel[k]()}</button>`).join('')}</div>
    ${shop ? setsRowHtml() : ''}
    <div class="lb-body">${body}</div>
    <div class="lb-status" aria-live="polite">${esc(status)}</div>
    <div class="lb-foot">${flow.labSetup ? `<button class="btn small ${resetArmed ? 'coral' : ''}" data-lb="reset">${resetArmed ? t('lbResetSure') : t('lbReset')}</button>` : ''}${foot}</div>`;
}

function render(): void {
  const s = store.state;
  const visible = LAB && !!s.lab && !flow.paused && (s.phase === 'shop' || s.phase === 'combat');
  const shop = s.phase === 'shop';
  el.classList.toggle('hidden', !visible);
  if (!visible) return;
  if (s.phase === 'combat' && prevPhase !== 'combat') resetMeter();
  prevPhase = s.phase;
  const pill = !shop && collapsed;
  el.classList.toggle('in-shop', shop);
  el.classList.toggle('sim', !!flow.sim);
  el.classList.toggle('collapsed', pill);
  const tabs = tabsNow();
  if (!tabs.includes(tab)) tab = tabs[0];
  const key = JSON.stringify([t('lbTitle'), s.phase, pill, tab, tabs, tier, target, status, resetArmed, foe, s.theme, !!s.labSandbox, flow.labSetup, slots.map(slotItems), shop ? [activeSets().map((x) => `${x.id}${x.n}`), labDummies.map(rosterKey), s.inventory.placed.length, s.inventory.shelf.filter(Boolean).length, !!s.shop?.locked] : 0]);
  if (key !== builtKey) {
    builtKey = key;
    const scroll = el.querySelector('.lb-body')?.scrollTop ?? 0;
    el.innerHTML = pill ? `<button class="btn small coral" data-lb="collapse">${t('lbExpand')} ▸</button>` : html(tabs);
    const body = el.querySelector('.lb-body');
    if (body) body.scrollTop = scroll;
  }
  patchLive();
}

function patchLive(): void {
  const s = store.state;
  const m = el.querySelector('[data-lb-money]'), h = el.querySelector('[data-lb-hp]');
  if (m) m.textContent = String(s.money);
  if (h) h.textContent = `${Math.ceil(s.hp)}/${s.build.maxHp}`;
}

// ───────────────────────────── meter ─────────────────────────────

function resetMeter(): void {
  const st = store.state.stats;
  meter.reset(st.timeSeconds, totalDamage(st.damage), st.damageByWeapon);
}

function updateMeter(): void {
  const s = store.state;
  if (!s.lab) return;
  meter.observe(s.stats.timeSeconds, totalDamage(s.stats.damage), s.stats.damageByWeapon);
  const box = el.querySelector<HTMLElement>('[data-lb-meter]');
  if (!box || el.classList.contains('hidden')) return;
  const r = meter.read();
  if (r.total <= 0) { box.innerHTML = `<div class="lb-note">${t('lbMeterEmpty')}</div>`; return; }
  const names = sourceNames(s.inventory);
  const num = (n: number) => fmtNum(n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);
  const byName = new Map<string, { k: string; v: number }>(); // two copies of one item are one line
  for (const [k, v] of r.sources) { const n = names.name(k), cur = byName.get(n); if (cur) cur.v += v; else byName.set(n, { k, v }); }
  const bars = [...byName].sort((a, b) => b[1].v - a[1].v).slice(0, 6).map(([name, { k, v }]) => {
    const fill = settings.damageColors ? ELEMENT_COLORS[names.type(k)] : 'var(--plum-soft)';
    return `<div class="dbar"><span class="dn">${esc(name)}</span><span class="dtrack"><i style="width:${Math.max(2, (v / r.total) * 100)}%;background:${fill}"></i></span><span class="dv">${fmtNum(Math.round(v))}<small>${Math.round((v / r.total) * 100)}%</small></span></div>`;
  }).join('');
  const cell = (label: string, v: string) => `<div><small>${label}</small><b>${v}</b></div>`;
  box.innerHTML = `<div class="lb-dps"><b>${num(r.rolling)}</b><small>${t('lbMeterRolling')}</small></div>
    <div class="lb-grid">${cell(t('lbMeterAvg'), num(r.average))}${cell(t('lbMeterPeak'), num(r.peak))}${cell(t('lbMeterTotal'), fmtNum(Math.round(r.total)))}${cell(t('lbMeterTime'), `${fmtNum(r.seconds.toFixed(1))} s`)}</div>
    <div class="dmg"><div class="dh">${t('lbMeterSources')}</div>${bars}</div>`;
}

// ───────────────────────────── actions ─────────────────────────────

function say(msg: string): void {
  status = msg;
}

function onClick(e: MouseEvent): void {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b || b.disabled) return;
  b.blur(); // Space/Enter mid-fight must not press it again
  const s = store.state, d = b.dataset;
  say('');
  if (d.lbTab) { tab = d.lbTab as Tab; store.changed(); return; }
  if (d.lbTier) { tier = Number(d.lbTier); store.changed(); return; }
  if (d.lbTarget) { target = d.lbTarget as 'cart' | 'shelf'; store.changed(); return; }
  if (d.lbCount) { foe.count = Number(d.lbCount); store.changed(); return; }
  if (d.lbAdd) {
    const r = labAddItem(s, d.lbAdd as ItemTypeId, tier, target);
    if (!r.ok) say(r.reason);
    else { play('buy'); if (r.where !== target) say(t('lbToShelf', { name: itemT(d.lbAdd as ItemTypeId).name })); }
    store.changed();
    return;
  }
  if (d.lbSave) { slots[Number(d.lbSave)] = captureSlot(s); saveSlots(slots); play('click'); store.changed(); return; }
  if (d.lbLoad) { const sl = slots[Number(d.lbLoad)]; if (sl && restoreSlot(s, sl).ok) play('buy'); store.changed(); return; }
  if (d.lbFoe) { spawn(d.lbFoe as EnemyId, d.lbMini === undefined ? undefined : Number(d.lbMini)); return; }
  switch (d.lb) {
    case 'clear': labClear(s); play('click'); break;
    case 'money': s.money += 999; play('buy'); break;
    case 'reroll': if (!s.shop?.locked) { s.money += currentRerollCost(s); reroll(s, flow.rng); } play('click'); break;
    case 'despawn': if (s.phase === 'combat') (flow.arena() as ArenaScene).labDespawn(); else labDummies.length = 0; play('pop'); break;
    case 'meter-reset': resetMeter(); updateMeter(); return;
    case 'collapse': collapsed = !collapsed; break;
    case 'cart': play('click'); flow.labToShop(); return;
    case 'reset':
      if (!resetArmed) { resetArmed = true; resetTimer = window.setTimeout(() => { resetArmed = false; store.changed(); }, 3000); break; }
      window.clearTimeout(resetTimer);
      resetArmed = false;
      play('click');
      flow.labReset();
      return;
  }
  store.changed();
}

function spawn(id: EnemyId, mini?: number): void {
  const spec: LabDummy = { id, still: !foe.moves, immortal: foe.immortal, mini, ...(foe.elite ? { affix: 'elite' as const } : {}) };
  if (store.state.phase === 'combat') {
    const arena = flow.arena() as ArenaScene;
    for (let i = 0; i < foe.count; i++) arena.labSpawn({ ...spec });
  } else for (let i = 0; i < foe.count; i++) labDummies.push({ ...spec });
  play('spawn');
  store.changed();
}

function onChange(e: Event): void {
  const c = e.target as HTMLInputElement | HTMLSelectElement;
  if (c.dataset.lbFoeOpt) { foe[c.dataset.lbFoeOpt as 'moves' | 'immortal' | 'elite'] = (c as HTMLInputElement).checked; return; }
  if (!c.dataset.lab) return;
  c.blur();
  flow.labTune(readLabControl(c));
  if (inFight()) resetMeter();
}

function onInput(e: Event): void {
  const c = e.target as HTMLInputElement;
  if (!c.classList.contains('lb-search')) return;
  query = c.value;
  el.querySelectorAll<HTMLElement>('[data-lb-add]').forEach((b) => { b.hidden = !matches(b.dataset.lbAdd as ItemTypeId, query); });
}

export function initLabBench(ui: HTMLElement): void {
  el = document.createElement('div');
  el.id = 'labbench';
  el.className = 'receipt interactive hidden';
  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  el.addEventListener('input', onInput);
  ui.append(el);
  store.on('change', render);
  store.on('pause', render);
  store.on('run-start', () => { collapsed = !store.state.labSandbox; tab = store.state.phase === 'shop' ? 'items' : 'foes'; resetMeter(); });
  window.setInterval(updateMeter, 150);
}

/** F8 in the sandbox: arena ↔ cart editor. */
export function labBenchKey(e: KeyboardEvent): boolean {
  const s = store.state;
  if (e.key !== 'F8' || !s.labSandbox || flow.paused) return false;
  if (s.phase === 'combat') flow.labToShop();
  else if (s.phase === 'shop') flow.labToArena();
  else return false;
  play('click');
  return true;
}
