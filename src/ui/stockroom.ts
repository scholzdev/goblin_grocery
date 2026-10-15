import { t } from '../i18n';
import { itemT } from '../i18n/data';
import type { ShopOffer } from '../types';
import { svg, uiRoot } from './hud';
import { hideItemCard, kindLabel, rarityClass, showItemCard, starsHtml } from './shop';

// Stockroom aisle: a small DOM overlay with three free items. Pick one (click or 1-3) and the aisle ends.

let el: HTMLElement | null = null;
let onKey: ((e: KeyboardEvent) => void) | null = null;

export function hideStockroom(): void {
  if (onKey) window.removeEventListener('keydown', onKey);
  onKey = null;
  hideItemCard();
  el?.remove();
  el = null;
}

export function showStockroom(offers: ShopOffer[], onPick: (o: ShopOffer) => void, labels = { title: t('stockroomTitle'), hint: t('stockroomHint') }): void {
  hideStockroom();
  const root = uiRoot();
  if (!root) return;
  const pick = (i: number): void => {
    const o = offers[i];
    if (!o) return;
    hideStockroom();
    onPick(o);
  };
  el = document.createElement('div');
  el.className = 'stockroom interactive';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', labels.title);
  el.innerHTML = `<h2 class="display">${labels.title}</h2><p>${labels.hint}</p>
    <div class="stock-cards">${offers.map((o, i) => `<div class="card ${rarityClass(o.type, o.tier)}" data-i="${i}" role="button" tabindex="0" aria-label="${itemT(o.type).name}">
      <span class="key">${i + 1}</span>
      <img class="art" src="${svg(`icon_${o.type}`)}" alt="">
      <div class="nm">${itemT(o.type).name}</div>
      <div class="kind">${kindLabel(o.type)}${starsHtml(o.tier)}</div>
      <span class="free">${t('stockroomFree')}</span></div>`).join('')}</div>`;
  el.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (c) pick(Number(c.dataset.i));
  });
  for (const c of el.querySelectorAll<HTMLElement>('.card')) {
    const o = offers[Number(c.dataset.i)];
    c.addEventListener('pointerenter', () => showItemCard(o.type, c));
    c.addEventListener('pointerleave', () => hideItemCard());
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(Number(c.dataset.i)); });
  }
  onKey = (e: KeyboardEvent) => {
    const n = Number(e.key);
    if (n >= 1 && n <= offers.length) pick(n - 1);
  };
  window.addEventListener('keydown', onKey);
  root.append(el);
}
