import { t } from '../i18n';
import { enemyT } from '../i18n/data';
import { ENEMIES, MINI_BOSS, enemyFrame, isBossId } from '../data/enemies';
import { store } from '../state/store';
import { flow } from '../flow';
import { play } from '../audio/sfx';
import type { ArenaScene } from '../scenes/ArenaScene';
import type { EnemyId } from '../types';
import { svg } from './hud';

// Lab dummy sandbox panel (`?lab`, "Dummy sandbox" ticked): spawn dummies, toggle move/unkillable, despawn, hop to the cart.
let panel: HTMLElement;
let built = ''; // language + theme the panel was built for

const IDS = Object.keys(ENEMIES) as EnemyId[];

function html(): string {
  const btn = (id: EnemyId, cls: string, title: string, mini?: number) =>
    `<button class="lab-item ${cls}" data-sb-spawn="${id}" ${mini === undefined ? '' : `data-sb-mini="${mini}"`} title="${title}" aria-label="${t('sbSpawnAria', { name: title })}"><img src="${svg(enemyFrame(id))}" alt=""></button>`;
  const theme = store.state.theme;
  const minis = MINI_BOSS.variants.map((v, i) => {
    const id = v.byTheme[theme] ?? v.byTheme.main!;
    return btn(id, 'r3', t('miniBossBar', { name: enemyT(id).name }), i);
  });
  const enemies = IDS.map((id) => btn(id, isBossId(id) ? 'legendary' : 'r1', enemyT(id).name));
  return `<h3>${t('sbTitle')}</h3>
    <div class="lab-items">${[...enemies, ...minis].join('')}</div>
    <label class="check"><input type="checkbox" data-sb="move">${t('sbMove')}</label>
    <label class="check"><input type="checkbox" data-sb="immortal" checked>${t('sbImmortal')}</label>
    <label class="check">${t('sbCount')} <select data-sb="count">${[1, 3, 5, 10].map((n) => `<option>${n}</option>`).join('')}</select></label>
    <div class="lab-btns"><button class="btn small" data-sb-act="despawn">${t('sbDespawn')}</button><button class="btn small coral" data-sb-act="cart">${t('sbCart')}</button></div>`;
}

function render(): void {
  const s = store.state;
  const show = !!s.labSandbox && s.phase === 'combat' && !flow.paused;
  const key = `${t('sbTitle')}|${s.theme}`;
  if (show && built !== key) { built = key; panel.innerHTML = html(); } // toggles survive shop trips; rebuilt on language/theme change
  panel.classList.toggle('hidden', !show);
}

function onClick(e: MouseEvent): void {
  const el = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!el) return;
  el.blur(); // Space/Enter mid-fight must not re-press it
  const arena = flow.arena() as ArenaScene;
  const spawn = el.dataset.sbSpawn as EnemyId | undefined;
  if (spawn) {
    const opt = (k: string) => panel.querySelector<HTMLInputElement>(`[data-sb="${k}"]`)!;
    const n = Number(opt('count').value);
    const mini = el.dataset.sbMini === undefined ? undefined : Number(el.dataset.sbMini);
    for (let i = 0; i < n; i++) arena.labSpawn({ id: spawn, still: !opt('move').checked, immortal: opt('immortal').checked, mini });
    play('spawn');
  } else if (el.dataset.sbAct === 'despawn') { arena.labDespawn(); play('pop'); }
  else if (el.dataset.sbAct === 'cart') { play('click'); flow.labToShop(); }
}

export function initSandbox(ui: HTMLElement): void {
  panel = document.createElement('div');
  panel.id = 'sandbox';
  panel.className = 'receipt interactive hidden';
  panel.addEventListener('click', onClick);
  ui.append(panel);
  store.on('change', render);
  store.on('pause', render);
}

/** F8 in the sandbox: arena ↔ cart editor. */
export function sandboxKey(e: KeyboardEvent): boolean {
  const s = store.state;
  if (e.key !== 'F8' || !s.labSandbox || flow.paused) return false;
  if (s.phase === 'combat') flow.labToShop();
  else if (s.phase === 'shop') flow.labToArena();
  else return false;
  play('click');
  return true;
}
