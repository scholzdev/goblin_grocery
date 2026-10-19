import { store } from '../state/store';
import { BOSS_WAVE } from '../data/waves';
import { RECIPES, recipeIcon } from '../data/recipes';
import { deptT, itemT, recipeT, zoneT } from '../i18n/data';
import type { ItemTypeId } from '../types';
import { fmtNum, t, type UIKey } from '../i18n';
import { settings } from '../state/settings';
import { ACTIVE_KEYS, bindingLabel } from '../state/keymap';
import { initPunchCard, renderPunchCard } from './punchcard';

// Compact receipt-strip combat HUD. Built once; per-frame values only touch changed text.
export const svg = (key: string): string => `${import.meta.env.BASE_URL}assets/svg/${key}.svg`;

let root: HTMLElement;
let els: Record<string, HTMLElement> = {};
let last: Record<string, string> = {};

const set = (k: string, v: string, prop: 'textContent' | 'style' = 'textContent'): void => {
  if (last[k] === v) return;
  last[k] = v;
  if (prop === 'textContent') els[k].textContent = v;
};

export function initHud(ui: HTMLElement): void {
  root = ui;
  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.className = 'hidden';
  hud.innerHTML = `
    <div class="strip receipt">
      <div class="hp"><img src="${svg('heart')}" width="30" alt=""><div class="hpbar"><i></i></div><span class="hpnum"></span></div>
      <div class="sep"></div>
      <div class="aisle-wrap"><div class="aisle"></div><div class="dept"></div></div>
      <div class="sep"></div>
      <div class="clock"><svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="10" fill="#FFF2D5" stroke="#30203F" stroke-width="3"/><path d="M13 7v6l4 3" stroke="#30203F" stroke-width="3" fill="none" stroke-linecap="round"/></svg><span class="t"></span></div>
      <div class="sep"></div>
      <div class="money"><img class="coin-ico" src="${svg('coin')}" alt=""><span class="m"></span></div>
      <div class="sep"></div>
      <div class="shove"><div class="ring"></div><span></span></div>
      <div class="barcode"></div>
    </div>
    <div class="recipes"></div>
    <div class="actives"></div>`;
  const boss = document.createElement('div');
  boss.id = 'bossbar';
  boss.className = 'receipt hidden';
  boss.innerHTML = `<div class="name"></div><div class="bar"><i></i></div>`;
  const banner = document.createElement('div');
  banner.id = 'banner';
  banner.innerHTML = `<div class="big sticker"></div><br><div class="sub"></div>`;
  banner.style.opacity = '0';
  const bark = document.createElement('div');
  bark.id = 'bark';
  bark.className = 'sticker';
  bark.style.opacity = '0';
  ui.append(hud, boss, banner, bark);
  initPunchCard(ui, hud);
  els = {
    hud, boss, banner, bark,
    hpbar: hud.querySelector('.hpbar > i')!, hpnum: hud.querySelector('.hpnum')!, aisle: hud.querySelector('.aisle')!, dept: hud.querySelector('.dept')!,
    clock: hud.querySelector('.clock')!, t: hud.querySelector('.clock .t')!, m: hud.querySelector('.money .m')!,
    shove: hud.querySelector('.shove')!, ring: hud.querySelector('.shove .ring')!, recipes: hud.querySelector('.recipes')!, actives: hud.querySelector('.actives')!,
    bossfill: boss.querySelector('.bar > i')!,
  };
  store.on('change', render);
  relabelHud();
}

/** (Re)writes the static HUD texts in the current language. */
export function relabelHud(): void {
  els.shove.querySelector('span')!.innerHTML = t('hudDash');
  els.boss.querySelector('.name')!.textContent = t('managerCaps');
  last = {};
  if (!els.hud.classList.contains('hidden')) render();
}

function render(): void {
  const s = store.state;
  const inCombat = s.phase === 'combat' || s.phase === 'checkout';
  els.hud.classList.toggle('hidden', !inCombat);
  if (!inCombat) { els.boss.classList.add('hidden'); renderPunchCard(null); }
  if (!inCombat) return;
  els.hpbar.style.width = `${(100 * s.hp) / s.build.maxHp}%`;
  set('hpnum', `${Math.ceil(s.hp)}/${s.build.maxHp}`);
  set('aisle', (s.wave === BOSS_WAVE && !s.overtime ? t('finalAisle') : t('hudAisle', { n: String(s.wave).padStart(2, '0') })) + (s.shift ? ` · ${t('hudShift', { n: s.shift + 1 })}` : '') + (s.lab ? (s.labGod ? ` · ${t('hudLabGod')}` : ` · ${t('hudLab')}`) : ''));
  set('dept', (s.zone && s.department === s.theme ? zoneT(s.zone).name.toUpperCase() : deptT(s.department).short) + (s.modifier !== 'none' ? ` · ${t(`modShort_${s.modifier}` as UIKey)}` : ''));
  set('m', String(s.money));
  const key = s.build.recipes.map((r) => r.id).join();
  if (last.recipes !== key) {
    last.recipes = key;
    els.recipes.innerHTML = s.build.recipes
      .map((r) => `<span class="badge" title="${recipeT(r.id).summary}"><img src="${svg(`icon_${recipeIcon(RECIPES[r.id])}`)}" alt="">${recipeT(r.id).name}</span>`)
      .join('');
  }
}

export const hud = {
  tick(o: { timeLeft: number; elapsed: number; actives?: { slot: number; type: string; left: number; max: number }[]; shoveCd: number; shoveMax: number; boss: { hp: number; max: number; enraged: boolean; name: string } | null }): void {
    if (!els.t) return;
    const t = o.timeLeft >= 0 ? `${Math.ceil(o.timeLeft)}s` : `${Math.floor(o.elapsed)}s`;
    set('t', t);
    els.clock.classList.toggle('low', o.timeLeft >= 0 && o.timeLeft <= 5);
    const p = o.shoveMax > 0 ? 1 - o.shoveCd / o.shoveMax : 1;
    const pk = p.toFixed(2);
    if (last.ring !== pk) {
      last.ring = pk;
      els.ring.style.setProperty('--p', pk);
      els.shove.classList.toggle('ready', o.shoveCd <= 0);
      els.ring.textContent = o.shoveCd > 0 ? fmtNum(o.shoveCd.toFixed(1)) : '';
    }
    const act = (o.actives ?? []).map((a) => `${a.slot}${a.type}:${a.left}/${a.max}`).join();
    if (last.actives !== act) { // one chip per active slot, in slot order: icon, its key, and one pip per charge (spent pips are hollow)
      last.actives = act;
      els.actives.innerHTML = (o.actives ?? []).map((a) => `<span class="active-item${a.left <= 0 ? ' spent' : ''}" title="${itemT(a.type as ItemTypeId).name}"><img src="${svg(`icon_${a.type}`)}" alt=""><kbd>${bindingLabel(settings.keys, ACTIVE_KEYS[a.slot - 1])}</kbd><span class="pips">${Array.from({ length: a.max }, (_, i) => `<i class="${i < a.left ? 'on' : ''}"></i>`).join('')}</span></span>`).join('');
    }
    els.boss.classList.toggle('hidden', !o.boss);
    if (o.boss) {
      if (last.bossName !== o.boss.name) { last.bossName = o.boss.name; els.boss.querySelector('.name')!.textContent = o.boss.name; }
      els.bossfill.style.width = `${(100 * o.boss.hp) / o.boss.max}%`;
      els.boss.classList.toggle('enraged', o.boss.enraged);
    }
  },
  /** Punch Card sticker under the strip (ui/punchcard.ts); null hides it. */
  contract: renderPunchCard,
  bark(text: string): void {
    els.bark.textContent = text;
    els.bark.classList.remove('show');
    void els.bark.offsetWidth;
    els.bark.classList.add('show');
  },
  reset(): void {
    last = {};
    render();
  },
};

export function showBanner(big: string, sub: string): void {
  if (!els.banner) return;
  els.banner.querySelector('.big')!.textContent = big;
  els.banner.querySelector('.sub')!.textContent = sub;
  els.banner.classList.remove('show');
  void els.banner.offsetWidth;
  els.banner.classList.add('show');
}

export const uiRoot = (): HTMLElement => root;
