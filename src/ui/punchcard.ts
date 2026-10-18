import type { PunchView } from '../systems/contracts';
import { svg } from './hud';
import { t, type UIKey } from '../i18n';

// The Punch Card sticker under the HUD strip: the goal, a counter and a bar with ten punch holes. It reads at a glance: holes fill as the goal
// does, the whole card turns gold when done and grey when the goal can no longer be met. Built once; only changed values touch the DOM.

const HOLES = 10;
let card: HTMLElement;
let hudEl: HTMLElement;
let last = '';

export function initPunchCard(ui: HTMLElement, hud: HTMLElement): void {
  hudEl = hud;
  card = document.createElement('div');
  card.id = 'punch';
  card.className = 'hidden';
  card.innerHTML = `
    <div class="pc-head"><img src="${svg('icon_punchcard')}" alt=""><span class="pc-title"></span><span class="pc-count"></span></div>
    <div class="pc-goal"></div>
    <div class="pc-bar"><i></i><b>${'<u></u>'.repeat(HOLES)}</b></div>`;
  ui.append(card);
}

export function renderPunchCard(v: PunchView | null): void {
  if (!card) return;
  hudEl.classList.toggle('has-punch', !!v);
  if (!v) { if (last) { last = ''; card.classList.add('hidden'); } return; }
  const key = `${v.goal}|${v.status}|${v.shown}|${v.target}|${Math.round(v.frac * 100)}`;
  if (key === last) return;
  last = key;
  card.className = `punch-${v.status}`;
  const goal = t(`pcText_${v.goal}` as UIKey, { n: v.target });
  card.querySelector('.pc-title')!.textContent = t('pcTitle');
  card.querySelector('.pc-count')!.textContent = v.status === 'done' ? t('pcDone') : `${v.shown} / ${v.target}`;
  card.querySelector('.pc-goal')!.textContent = v.status === 'failed' ? `${t('pcFailed')} · ${goal}` : goal;
  (card.querySelector('.pc-bar > i') as HTMLElement).style.width = `${v.frac * 100}%`;
  const punched = v.status === 'done' ? HOLES : Math.floor(v.frac * HOLES);
  card.querySelectorAll('.pc-bar u').forEach((u, i) => u.classList.toggle('on', i < punched));
}
