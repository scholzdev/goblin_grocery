import type Phaser from 'phaser';
import { store } from '../state/store';
import { flow } from '../flow';
import { settings, saveSettings, getBest } from '../state/settings';
import { ITEMS, PLAYER, STARTER_LOOKS, STARTER_WEAPONS } from '../data/items';
import { RECIPES, recipeIcon, recipeParts } from '../data/recipes';
import { BOSS_WAVE, ECONOMY, SHIFTS, SHOP_LEVELS, enemyAppears } from '../data/waves';
import { CODEX_ENEMIES, ELITE, ENEMIES, MINI_BOSS, bossFor, enemyFrame, isBossId } from '../data/enemies';
import { LAB, loadLab, saveLab } from '../lab';
import { play, refreshVolumes, startMusic } from '../audio/sfx';
import { initHud, hud, svg, relabelHud } from './hud';
import { initTutorial, resetTutorial } from './tutorial';
import { KEY_ACTIONS, clearSlot, defaultKeys, keyLabel, matches, rebind, type KeyAction } from '../state/keymap';
import { initKeyboard } from '../input/keyboard';
import { initGamepad } from '../input/gamepad';
import { kbdHtml, keyText, moveHtml } from './keys';
import { initShop, shopKey, shopPad, gridHtml, combosHtml, starsHtml, rarityClass, inspectorHtml, showItemCard, hideItemCard } from './shop';
import { DEPARTMENTS, THEMES } from '../data/departments';
import { MODIFIERS, type DoorId, type ModifierId } from '../data/modifiers';
import { SET_EVENTS, type SetEventKind } from '../data/events';
import { CART_SKINS, GOBLIN_SKINS, UNLOCKS, type CartSkin, type GoblinSkin } from '../data/unlocks';
import { COUPON_COINS, STAMPS_PER_CARD, cartUnlocked, dailyBestToday, discoverRecipe, goblinUnlocked, isNew, markSeen, newCount, profile, saveProfile, shiftUnlocked, starterUnlocked, unlockedItems } from '../state/profile';
import { ITEM_IDS } from '../data/items';
import type { DepartmentId, EnemyId, ItemTypeId, LabOpts, Perk, RecipeId, StarterId, StarterWeapon } from '../types';
import type { Fresh } from '../state/profile';
import { modIcon, setIcon } from './icons';
import { t, fmtNum, lang, setLang, LANGS, type Lang, type UIKey } from '../i18n';
import { flavorOf, newSetLevels, setsOf } from '../data/sets';
import { ZONES } from '../data/zones';
import { cartSkinT, deptT, enemyT, goblinSkinT, itemT, recipeT, shiftT, starterT, tagT, unlockNeedT, zoneT } from '../i18n/data';

// DOM controllers are created exactly once at boot and driven by store events,
// so restarting a run never duplicates listeners or overlays.

/** Present only in the Electron desktop build (electron/preload.cjs). */
const desktop = (window as unknown as { desktop?: { quit(): void; setFullscreen(on: boolean): void } }).desktop;
let ui: HTMLElement;
const screens: Record<'title' | 'pause' | 'loadout' | 'end' | 'loading' | 'route' | 'starter', HTMLElement> = {} as never;
/** Starter-weapon picker is open (shown over the title screen). */
let choosingStarter = false;
/** Shift highlighted on the starter screen (remembered between runs). */
let pickedShift = 0;
const STARTERS = Object.keys(PLAYER.starters) as StarterId[];
const WEAPONS = Object.keys(STARTER_WEAPONS) as StarterWeapon[];
const PICK_KEY = 'goblin-grocery.lastpick.v1';
/** Starting weapon highlighted on the starter screen (remembered between runs). */
let pickedWeapon: StarterWeapon = (() => {
  try { const w = JSON.parse(localStorage.getItem(PICK_KEY) ?? '{}').weapon; return WEAPONS.includes(w) ? w : 'toaster'; } catch { return 'toaster'; }
})();
/** Run theme highlighted on the starter screen (remembered between runs). */
let pickedTheme: DepartmentId = (() => {
  try { const v = JSON.parse(localStorage.getItem(PICK_KEY) ?? '{}').theme; return THEMES.includes(v) ? v : 'main'; } catch { return 'main'; }
})();
/** Character highlighted on the starter screen (remembered between runs; falls back to the toaster goblin if still locked). */
let pickedStarter: StarterId = (() => {
  try { const v = JSON.parse(localStorage.getItem(PICK_KEY) ?? '{}').starter; return STARTERS.includes(v) && starterUnlocked(v) ? v : 'toaster'; } catch { return 'toaster'; }
})();
const savePick = (): void => {
  try { localStorage.setItem(PICK_KEY, JSON.stringify({ weapon: pickedWeapon, theme: pickedTheme, starter: pickedStarter })); } catch { /* storage unavailable */ }
};
const pickStarter = (id: StarterId): void => { pickedStarter = id; savePick(); };
const pickWeapon = (w: StarterWeapon): void => { pickedWeapon = w; savePick(); };
const pickTheme = (d: DepartmentId): void => { pickedTheme = d; savePick(); };
const modT = (id: ModifierId) => ({ name: t(`modName_${id}` as UIKey), short: t(`modShort_${id}` as UIKey), fx: t(`modFx_${id}` as UIKey), rw: t(`modRw_${id}` as UIKey) });

/** Dev/test builds only: every unlock plus every shift for every starter. */
function unlockAll(): void {
  profile.unlocked = UNLOCKS.map((u) => u.id);
  profile.recipes = Object.keys(RECIPES) as RecipeId[];
  for (const st of STARTERS) profile.stats.bestShift[st] = SHIFTS.length - 1;
  saveProfile();
}

export function initUi(_game: Phaser.Game): void {
  ui = document.getElementById('ui-root')!;
  document.documentElement.lang = settings.language;
  const stage = document.getElementById('stage')!;
  // Same math as Phaser's EXPAND mode: fit 1280x800, then extend the long axis to fill the screen.
  const fit = () => {
    const sc = Math.min(stage.clientWidth / 1280, stage.clientHeight / 800);
    const st = document.documentElement.style;
    st.setProperty('--s', String(sc));
    st.setProperty('--uw', `${stage.clientWidth / sc}px`);
    st.setProperty('--uh', `${stage.clientHeight / sc}px`);
  };
  new ResizeObserver(fit).observe(stage);
  fit();

  for (const k of Object.keys({ title: 0, pause: 0, loadout: 0, end: 0, loading: 0, route: 0, starter: 0 }) as (keyof typeof screens)[]) {
    const el = document.createElement('div');
    el.className = 'overlay interactive hidden';
    el.id = k;
    screens[k] = el;
  }
  applyMotion();
  initHud(ui);
  initShop(ui);
  initTutorial(ui);
  ui.append(...Object.values(screens));

  screens.loading.classList.remove('hidden');
  screens.loading.innerHTML = `<div class="sticker display" style="font-size:40px">${t('loading')} <span class="pct">0%</span></div>`;
  store.on('boot-ready', () => { screens.loading.classList.add('hidden'); render(); });
  for (let i = 0; i <= 100; i++) store.on(`boot-progress:${i}`, () => { const p = screens.loading.querySelector('.pct'); if (p) p.textContent = `${i}%`; });

  store.on('change', render);
  // Combo discovery: the first time a combo is active in your cart, it goes into the Catalog for good.
  store.on('change', () => {
    const st = store.state;
    if ((st.phase !== 'shop' && st.phase !== 'combat') || st.lab) return;
    for (const r of st.build.recipes) if (discoverRecipe(r.id)) celebrate(t('newCombo'), recipeT(r.id).name, `icon_${recipeIcon(RECIPES[r.id])}`);
  });
  // Set bonus level-ups: compare against the last baseline (reset whenever a shop/run opens), only while shopping.
  let setBase: Record<string, number> | null = null;
  const snap = (): Record<string, number> => ({ ...store.state.build.sets });
  store.on('shop-open', () => { setBase = snap(); });
  store.on('run-start', () => { setBase = null; });
  store.on('change', () => {
    const st = store.state;
    if (st.phase !== 'shop') { setBase = null; return; }
    const now = snap();
    if (setBase) for (const { id, lv } of newSetLevels(setBase, now)) {
      const last = st.inventory.placed[st.inventory.placed.length - 1];
      const member = (last && setsOf(last.type, flavorOf(last)).includes(id) ? last.type : ITEM_IDS.find((i) => setsOf(i).includes(id))) as ItemTypeId;
      celebrate(t('setUp'), t('setUpName', { set: tagT(id), n: lv }), `icon_${member}`, t('setUpLine'));
    }
    setBase = now;
  });
  store.on('pause', render);
  store.on('run-end', render);
  store.on('run-start', () => hud.reset());
  store.on('run-start', () => {
    if (!store.state.voucher) return;
    const n = document.createElement('div');
    n.className = 'vouchernote';
    n.textContent = t('voucherUsed', { n: COUPON_COINS });
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3200);
  });
  window.addEventListener('keydown', onKey);
  initPad();
  desktop?.setFullscreen(settings.fullscreen);
  window.addEventListener('blur', () => flow.pause('blur'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) flow.pause('blur'); });
  ui.addEventListener('click', onClick);
  ui.addEventListener('input', onInput);
  // Catalog: hovering an item icon shows the shop's item card.
  screens.title.addEventListener('pointerover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-card]');
    if (el) showItemCard(el.dataset.card as ItemTypeId, el); else hideItemCard();
  });
  // Tab view: hovering an item shows the same stats panel as the shop inspector.
  screens.loadout.addEventListener('pointerover', (e) => {
    const it = (e.target as HTMLElement).closest<HTMLElement>('.item[data-uid]');
    const panel = screens.loadout.querySelector<HTMLElement>('.inspector');
    const inst = it && store.state.inventory.placed.find((i) => i.uid === it.dataset.uid);
    if (!panel || !inst) return;
    screens.loadout.querySelectorAll('.item.affect').forEach((n) => n.classList.remove('affect'));
    for (const [a, b] of store.state.build.adjacency) {
      const other = a === inst.uid ? b : b === inst.uid ? a : null;
      if (other) screens.loadout.querySelector(`.item[data-uid="${other}"]`)?.classList.add('affect');
    }
    panel.innerHTML = inspectorHtml(inst.type as ItemTypeId, inst.uid);
  });
}

function celebrate(title: string, name: string, icon: string, line: string | null = t('addedCatalog')): void {
  const el = document.createElement('div');
  el.className = 'celebrate';
  // Several discoveries at once stack downwards instead of overlapping.
  el.style.top = `${92 + ui.querySelectorAll('.celebrate').length * 104}px`;
  el.innerHTML = `<img src="${svg(icon)}" alt=""><div><small>${title}</small><b>${name}</b>${line ? `<span>${line}</span>` : ''}</div>`;
  ui.append(el);
  play('upgrade');
  setTimeout(() => el.remove(), 2800);
}

function render(): void {
  const s = store.state;
  if (!screens.loading.classList.contains('hidden')) return;
  toggle('title', s.phase === 'title' && !choosingStarter, titleHtml);
  toggle('pause', flow.paused && flow.pauseReason !== 'loadout', pauseHtml);
  toggle('loadout', flow.paused && flow.pauseReason === 'loadout', loadoutHtml);
  toggle('end', s.phase === 'victory' || s.phase === 'defeat', endHtml);
  toggle('route', s.phase === 'route', routeHtml);
  if (s.phase !== 'title') choosingStarter = false;
  toggle('starter', s.phase === 'title' && choosingStarter, starterHtml);
}

/** Start the run with the highlighted loadout (the Start button is disabled while character or shift is locked). */
function startPicked(): void {
  if (!starterUnlocked(pickedStarter) || !shiftUnlocked(pickedStarter, pickedShift)) return;
  startMusic();
  flow.startRun(pickedStarter, pickedShift, pickedWeapon, pickedTheme);
}

function toggle(k: keyof typeof screens, show: boolean, html: () => string): void {
  const el = screens[k];
  const was = !el.classList.contains('hidden');
  el.classList.toggle('hidden', !show);
  if (show && !was) {
    el.innerHTML = html();
    el.querySelector<HTMLElement>('[data-focus]')?.focus();
  }
}

// ───────────────────────────── screens ─────────────────────────────

function titleHtml(): string {
  const best = getBest();
  return `<div class="logo"><span class="l1">Goblin</span><span class="l2">Grocery</span>
      <span class="tag sticker">${t('tagline')}</span></div>
    <div class="menu">
      <button class="btn coral" data-act="play" data-focus>${t('play')}</button>
      <button class="btn" data-act="codex">${t('catalog')} <small class="count">${profile.recipes.length}/${Object.keys(RECIPES).length}</small>${newBadge(newCount())}</button>
      <button class="btn" data-act="daily">${t('dailyBtn')} <small class="count">${dailyBestToday() ? t('dailyBest', { n: dailyBestToday() }) : t('dailyNone')}</small></button>
      <button class="btn" data-act="wardrobe">${t('wardrobe')}</button>
      <button class="btn" data-act="history">${t('historyBtn')}</button>
      <button class="btn" data-act="settings">${t('settings')}</button>
      <button class="btn" data-act="credits">${t('credits')}</button>
      ${LAB ? `<button class="btn gold" data-act="lab">${t('lab')}</button>` : ''}
      ${DEV_KEYS && profile.unlocked.length < UNLOCKS.length ? `<button class="btn gold" data-act="unlock-all">${t('unlockAll')}</button>` : ''}
      ${desktop ? `<button class="btn" data-act="exit">${t('quitGame')}</button>` : ''}
    </div>
    <div class="info receipt">
      <h4>${t('howToShop')}</h4>
      <div class="keys">${moveHtml()} ${t('pushCart')}</div>
      <div class="keys">${kbdHtml('shove')} ${t('cartShove')} · ${kbdHtml('loadout')} ${t('viewCartLc')} · ${kbdHtml('pause')} ${t('pauseLc')}</div>
      <div>${t('howToBlurb', { n: BOSS_WAVE - 1 })}</div>
      <hr class="dash">
      <div class="best">${best ? t('bestReceipt', { score: best.score, result: best.won ? t('victory') : t('aisleN', { n: best.wave }) }) : t('noReceipts')}</div>
    </div>`;
}

function settingsHtml(): string {
  const slider = (k: 'master' | 'music' | 'sfx', label: string) =>
    `<label>${label}<input type="range" min="0" max="100" value="${Math.round(settings[k] * 100)}" data-set="${k}"><span data-val="${k}">${Math.round(settings[k] * 100)}</span></label>`;
  return `<div class="settings">
    <label>${t('language')}<select data-set="language">${LANGS.map((l) => `<option value="${l}" ${settings.language === l ? 'selected' : ''}>${l === 'en' ? 'English' : 'Deutsch'}</option>`).join('')}</select></label>
    ${slider('master', t('master'))}${slider('music', t('music'))}${slider('sfx', t('effects'))}
    <label class="check"><input type="checkbox" data-set="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}>${t('reducedMotion')}</label>
    <label class="check"><input type="checkbox" data-set="shake" ${settings.shake ? 'checked' : ''}>${t('screenShake')}</label>
    <button class="btn small" data-act="replay-tutorial">${t('tutReplay')}</button>
    ${controlsHtml()}
    ${desktop ? `<label class="check"><input type="checkbox" data-set="fullscreen" ${settings.fullscreen ? 'checked' : ''}>${t('fullscreen')}</label>` : ''}
  </div>`;
}

const CTL_LABEL: Record<KeyAction, UIKey> = { up: 'ctlUp', down: 'ctlDown', left: 'ctlLeft', right: 'ctlRight', shove: 'ctlShove', loadout: 'ctlLoadout', rotate: 'ctlRotate', pause: 'ctlPause' };
/** Key currently being rebound (waiting for the next key press), or null. */
let listening: { action: KeyAction; slot: number } | null = null;

/** Two key buttons per action; the one being rebound shows "press a key…". */
function bindRowsHtml(): string {
  return KEY_ACTIONS.map((a) => `<div class="kb-row"><span>${t(CTL_LABEL[a])}</span>${[0, 1].map((i) => {
    const on = listening?.action === a && listening.slot === i;
    return `<button class="kb ${on ? 'listening' : ''}" data-act="bind" data-action="${a}" data-slot="${i}">${on ? t('ctlPress') : keyLabel(settings.keys[a][i], t('keySpace'))}</button>`;
  }).join('')}</div>`).join('');
}

function controlsHtml(): string {
  return `<details class="controls"><summary>${t('ctlTitle')}</summary>
    <div class="kb-help">${t('ctlHelp')}</div>
    <div class="kb-list">${bindRowsHtml()}</div>
    <div class="kb-note" role="status"></div>
    <button class="btn small" data-act="reset-keys">${t('ctlReset')}</button>
    <div class="padinfo"><b>${t('ctlPadTitle')}</b>
      <div>${t('ctlPadMove')}</div><div>${t('ctlPadShove')}</div><div>${t('ctlPadPause')}</div><div>${t('ctlPadLoadout')}</div><div>${t('ctlPadBack')}</div><div>${t('ctlPadShop')}</div></div>
  </details>`;
}

/** Re-draws every key list on screen; `focus` puts the focus ring back on the edited button. */
function refreshBinds(note = '', focus?: { action: KeyAction; slot: number }): void {
  ui.querySelectorAll<HTMLElement>('.kb-list').forEach((l) => { l.innerHTML = bindRowsHtml(); });
  ui.querySelectorAll<HTMLElement>('.kb-note').forEach((n) => { n.textContent = note; });
  if (focus) ui.querySelector<HTMLElement>(`.kb-list [data-action="${focus.action}"][data-slot="${focus.slot}"]`)?.focus();
}

function stopListening(): void {
  if (!listening) return;
  const was = listening;
  listening = null;
  refreshBinds('', was);
}

/** Next key press while a binding is selected: Esc cancels, Backspace clears, anything else is bound (swapping on conflict). */
function listenKey(e: KeyboardEvent): void {
  e.preventDefault();
  if (e.repeat || e.code === 'MetaLeft' || e.code === 'MetaRight') return;
  const at = listening!;
  if (e.code === 'Escape') { stopListening(); return; }
  listening = null;
  const r = e.code === 'Backspace' || e.code === 'Delete' ? clearSlot(settings.keys, at.action, at.slot) : rebind(settings.keys, at.action, at.slot, e.code);
  let note = '';
  if (r.ok) {
    settings.keys = r.keys;
    saveSettings();
    if (r.displaced) note = t('ctlSwapped', { name: t(CTL_LABEL[r.displaced]) });
    play('click');
  } else note = t(r.reason === 'last' ? 'ctlLast' : 'ctlReserved');
  refreshBinds(note, at);
}

function creditsHtml(): string {
  return `<h2>${t('credits')}</h2><div class="credits"><div class="display">Goblin Grocery</div>
    <p>${t('creditsBuilt')}</p><p>${t('creditsFonts')}</p><p>${t('creditsArt')}</p><p>${t('creditsAudio')}</p>
    <p class="made">${t('creditsMade')} <b>${t('creditsTeam')}</b></p></div>`;
}

function pauseHtml(): string {
  const blur = flow.pauseReason === 'blur';
  return `<div class="panel receipt">
    <h2>${blur ? t('shiftBreak') : t('paused')}</h2>
    <div style="font-weight:800">${blur ? t('storeFroze') : t('breather')}</div>
    ${settingsHtml()}
    <div class="row">
      <button class="btn coral" data-act="resume" data-focus>${t('resume')}</button>
      ${store.state.lab ? `<button class="btn" data-act="lab-back">${t('backToLab')}</button>` : `<button class="btn" data-act="restart">${t('restartRun')}</button>`}
      <button class="btn" data-act="quit">${t('quitTitle')}</button>
      ${desktop ? `<button class="btn" data-act="exit">${t('quitDesktop')}</button>` : ''}
    </div></div>`;
}

function loadoutHtml(): string {
  const s = store.state;
  return `<div class="loadout-row"><div class="panel receipt loadout" style="width:560px">
    <h2>${t('yourCart')}</h2><div style="font-weight:800">${t('cartReadOnly')}</div>
    <div class="grid">${gridHtml(s)}</div>
    <div class="combos" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left">${combosHtml(s.build, null, s.inventory.placed.map((i) => i.type))}</div>
    <div class="row"><button class="btn coral" data-act="resume" data-focus>${t('backToAisle', { key: keyText('loadout') })}</button></div></div>
    <div class="inspector receipt"><div class="nm">${t('inspector')}</div><div class="muted">${t('inspectorLoadout')}</div></div></div>`;
}

const pct = (m: number) => `${m < 1 ? '−' : '+'}${Math.round(Math.abs(m - 1) * 100)}%`;
const sgn = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n)}`;
/** Human-readable lines for a starter's perk. */
export function perkLines(p: Perk): string[] {
  const l: string[] = [];
  if (p.priceMult) l.push(t('perkPrices', { v: pct(p.priceMult) }));
  if (p.startMoney) l.push(t('perkCoins', { v: sgn(p.startMoney) }));
  if (p.maxHp) l.push(t('perkMaxHp', { v: sgn(p.maxHp) }));
  if (p.damageMult) l.push(t('perkDamage', { v: pct(p.damageMult) }));
  if (p.moveSpeedMult) l.push(t('perkSpeed', { v: pct(p.moveSpeedMult) }));
  if (p.shoveCooldown) l.push(t('perkDashCd', { v: fmtNum(sgn(p.shoveCooldown)) }));
  if (p.shoveDamage) l.push(t('perkDashDmg', { v: fmtNum(sgn(p.shoveDamage)) }));
  if (p.pickupRadius) l.push(t('perkPickup', { v: sgn(p.pickupRadius) }));
  return l;
}

/** Goblin head + torso + starter accessories stacked at the in-game offsets (x0.8 rig scale), in the equipped skin. */
function portrait(id: StarterId): string {
  const sf = profile.goblin === 'classic' ? '' : `__${profile.goblin}`, look = STARTER_LOOKS[id];
  const im = (key: string, w: number, h: number, ax: number, ay: number, x: number, y: number) =>
    `<img src="${svg(key)}" alt="" style="left:${+(92 + x - ax * w * 0.8).toFixed(1)}px;top:${+(142 + y - ay * h * 0.8).toFixed(1)}px;width:${w * 0.8}px;height:${h * 0.8}px">`;
  return `<span class="portrait">${im(`goblin_torso${sf}`, 56, 56, 0.5, 0.95, -50, -26)}${look.torso ? im(look.torso, 56, 56, 0.5, 0.95, -50, -26) : ''}${im(`goblin_head${sf}`, 96, 80, 0.5, 0.85, -48, -60)}${look.head ? im(look.head, 96, 112, 0.5, 0.8929, -48, -60) : ''}</span>`;
}

function starterHtml(): string {
  const id = pickedStarter, st = PLAYER.starters[id], stT = starterT(id);
  const gate = UNLOCKS.find((u) => u.kind === 'starter' && u.starter === id);
  const away = !starterUnlocked(id), shiftLock = !away && !shiftUnlocked(id, pickedShift);
  const tile = (sid: StarterId, key: number) => {
    const lock = !starterUnlocked(sid);
    return `<button class="tile ${sid === id ? 'sel' : ''} ${lock ? 'locked' : ''}" data-act="starter" data-starter="${sid}" aria-pressed="${sid === id}" ${sid === id ? 'data-focus' : ''}>
      <span class="key">${key}</span>${portrait(sid)}<span class="tn">${starterT(sid).name}</span>${lock ? '<span class="lk">🔒</span>' : ''}</button>`;
  };
  const wpn = (wid: StarterWeapon) => {
    const it = ITEMS[wid], w = it.weapon!;
    const stat = t('starterStat', { dmg: w.damage, cd: fmtNum(w.cooldown), rk: w.pattern === 'sweep' ? t('reach') : t('range'), range: w.range });
    return `<button class="btn weapon-pick ${wid === pickedWeapon ? 'coral' : ''}" data-act="weapon" data-weapon="${wid}" aria-pressed="${wid === pickedWeapon}">
      <img src="${svg(`icon_${wid}`)}" alt=""><span class="wp-text"><span class="wp-head"><b>${itemT(wid).name}</b>${it.tags?.[0] ? `<span class="tagchip ${it.tags[0]}">${tagT(it.tags[0])}</span>` : ''}</span><span class="wp-stat">${stat}</span></span></button>`;
  };
  const pills = SHIFTS.map((_sh, i) => {
    const locked = !STARTERS.some((s2) => shiftUnlocked(s2, i));
    return `<button class="btn small ${i === pickedShift ? 'coral' : ''}" data-act="shift" data-shift="${i}" ${locked ? `disabled title="${t('winShiftUnlock', { n: i })}"` : `title="${shiftT(i).name}"`}>${locked ? '🔒' : i + 1}</button>`;
  }).join(' ');
  const themeBtn = (did: DepartmentId) => {
    const d = DEPARTMENTS[did], dt = deptT(did);
    return `<button class="btn weapon-pick ${did === pickedTheme ? 'coral' : ''}" data-act="theme" data-theme="${did}" aria-pressed="${did === pickedTheme}">
      <img src="${svg(d.theme.icon)}" alt=""><span class="wp-text"><span class="wp-head"><b>${dt.short}</b></span><span class="wp-stat">${dt.blurb}</span></span></button>`;
  };
  const detail = `<div class="detail"><span class="who">${portrait(id)}</span><div class="dtxt"><div class="dn display">${stT.name}</div><div class="blurb">${stT.blurb}</div>
      ${away ? `<div class="need">🔒 ${gate ? `${unlockNeedT(gate.id)} (${gate.progress(profile.stats).join('/')})` : t('charLocked')}</div>`
        : st.perk ? `<ul>${perkLines(st.perk).map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}</div></div>`;
  const reason = away ? t('charLocked') : shiftLock ? t('winShiftStarter', { n: pickedShift }) : '';
  return `<div class="route loadout-pick"><h2 class="display">${t('pickStarter')}</h2>
    <div class="cols">
      <section class="col"><h3 class="display">${t('goblin')}</h3>
        <div class="tiles">${STARTERS.map((sid, i) => tile(sid, i + 1)).join('')}</div>${detail}</section>
      <section class="col"><h3 class="display">${t('runSetup')}</h3>
        <div class="lbl"><b>${t('pickTheme')}</b> <kbd>T</kbd></div>
        <div class="stack">${THEMES.map(themeBtn).join('')}</div>
        <div class="hint">${t('enemies')}: ${deptT(pickedTheme).enemiesText}</div>
        <div class="lbl"><b>${t('startWeapon')}</b> <kbd>W</kbd></div>
        <div class="weapon-row">${WEAPONS.map(wpn).join('')}</div>
        <div class="lbl"><b>${t('shiftLabel')}</b></div>
        <div class="pills">${pills}</div>
        <div class="hint"><b>${shiftT(pickedShift).name}</b> · ${shiftT(pickedShift).blurb}</div></section>
    </div>
    <div class="bar"><button class="btn small" data-act="close-starter">${t('back')} <kbd>Esc</kbd></button>
      <span class="why">${reason ? `🔒 ${reason}` : ''}</span>
      <button class="btn coral start" data-act="start-run" ${reason ? 'disabled' : ''}>${t('startRun')} <kbd>Enter</kbd></button></div></div>`;
}

function routeHtml(): string {
  const s = store.state;
  const doors = s.doors ?? [];
  const steps = Array.from({ length: BOSS_WAVE }, (_, i) => {
    const id = s.route[i] ?? (i === BOSS_WAVE - 1 ? 'boss' : null);
    const cls = i < s.route.length ? 'done' : i === s.route.length ? 'next' : '';
    const m = s.mods[i];
    const mini = i === MINI_BOSS.aisle - 1;
    return `<div class="step ${cls}${mini ? ' mini' : ''}" title="${id ? deptT(id).name : ''}${s.zones[i] ? ` · ${zoneT(s.zones[i]!).name}` : ''}${mini ? `${id ? ' · ' : ''}${t('routeMini')}` : ''}">${id === 'boss' ? `<img src="${svg(DEPARTMENTS.boss.theme.icon)}" alt="${deptT('boss').name}">` : id ? (m && m !== 'none' ? modIcon(m, 30) : `<img src="${svg(DEPARTMENTS[id].theme.icon)}" alt="">`) : `<span>${i + 1}</span>`}</div>`;
  }).join('<i></i>');
  const cards = doors.map((id: DoorId, i) => {
    if (id === 'boss') {
      const d = DEPARTMENTS.boss, dt = deptT('boss'), bid = bossFor(s.theme), dn = bid === 'boss' ? dt.name : enemyT(bid).name; // the theme's boss names its door
      return `<button class="door boss" data-act="door" data-id="boss" ${i === 0 ? 'data-focus' : ''} aria-label="${dt.name}">
      <span class="key">${i + 1}</span>
      <img src="${svg(d.theme.icon)}" alt="">
      <span class="dn">${dn}</span>
      <span class="danger" title="${t('danger')}">${t('boss')}</span>
      <span class="ln"><b>${t('enemies')}</b> ${dt.enemiesText}</span>
      <span class="ln reward"><b>${t('reward')}</b> ${dt.rewardText}</span>
    </button>`;
    }
    const mt = modT(id), risk = MODIFIERS[id].risk, zid = s.doorZones?.[i] ?? null;
    const zone = zid ? `<span class="zone"><span class="zn">${zoneT(zid).name}</span><span class="zb">${zoneT(zid).blurb}</span>${Object.keys(ZONES[zid].tilt).map((e) => `<span class="zb tilt">${t('zoneMore', { name: enemyT(e as EnemyId).name })}</span>`).join('')}</span>` : '';
    return `<button class="door mod ${id}" data-act="door" data-id="${id}" ${i === 0 ? 'data-focus' : ''} aria-label="${t('dangerAria', { name: mt.name, n: risk })}">
      <span class="key">${i + 1}</span>
      <span class="modicon">${modIcon(id)}</span>
      ${zone}
      <span class="dn">${mt.name}</span>
      <span class="danger" title="${t('danger')}">${'★'.repeat(risk) + '☆'.repeat(3 - risk)}</span>
      <span class="ln"><b>${t('enemies')}</b> ${mt.fx}</span>
      <span class="ln reward"><b>${t('reward')}</b> ${mt.rw}</span>
    </button>`;
  }).join('');
  return `<div class="route">
    <h2 class="display">${doors[0] === 'boss' ? t('lastAisle') : t('pickAisleIn', { name: deptT(s.theme).name })}</h2>
    <div class="progress">${steps}</div>
    <div class="doors">${cards}</div>
    <div class="hint">${t('clickDoor', { keys: doors.map((_, i) => `<kbd>${i + 1}</kbd>`).join(' ') })}</div>
  </div>`;
}

interface FreshCard { icon: string; name: string; kind: UIKey }
/** Run-end "Newly unlocked" cards: starters, items, skins, combos, enemies. */
function freshCards(f: Fresh): FreshCard[] {
  const us = f.unlocks.map((id) => UNLOCKS.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u);
  const of = <K extends string>(k: K) => us.filter((u) => u.kind === k);
  return [
    ...of('starter').map((u) => ({ icon: 'goblin_head', name: starterT((u as any).starter).name, kind: 'kindStarter' as UIKey })),
    ...of('item').map((u) => ({ icon: `icon_${(u as any).item}`, name: itemT((u as any).item).name, kind: 'kindItem' as UIKey })),
    ...of('goblin').map((u) => ({ icon: `goblin_head__${(u as any).skin}`, name: goblinSkinT((u as any).skin).name, kind: 'kindGoblin' as UIKey })),
    ...of('cart').map((u) => ({ icon: `cart_back__${(u as any).skin}`, name: cartSkinT((u as any).skin).name, kind: 'kindCart' as UIKey })),
    ...f.recipes.map((r) => ({ icon: `icon_${recipeIcon(RECIPES[r])}`, name: recipeT(r).name, kind: 'kindCombo' as UIKey })),
    ...f.enemies.map((e) => ({ icon: enemyFrame(e), name: enemyT(e).name, kind: 'kindEnemy' as UIKey })),
  ];
}

function freshHtml(res: NonNullable<typeof flow.lastResult>): string {
  const cards = freshCards(res.fresh), shown = cards.slice(0, 8);
  const first = !res.shown, still = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (first) {
    res.shown = true;
    (still ? shown.slice(0, 1) : shown).forEach((_, i) => setTimeout(() => play('ding', { rate: 1 + i * 0.05, volume: 0.5 }), 150 + i * 120));
  }
  const grid = shown.length ? `<div class="cut display">${t('newUnlocked')}</div><div class="ugrid">${shown.map((c, i) =>
    `<div class="ucard ${first && !still ? 'anim' : ''}" style="--i:${i}"><span class="utile"><img src="${svg(c.icon)}" alt=""></span><span class="utxt"><b class="display">${c.name}</b><small>${t(c.kind)}</small></span><i class="newtag sticker">${t('newTag')}</i></div>`).join('')}</div>${cards.length > shown.length ? `<div class="umore">${t('moreN', { n: cards.length - shown.length })}</div>` : ''}` : '';
  const rows = res.near.map((n) => {
    const u = UNLOCKS.find((x) => x.id === n.id)!;
    const icon = u.kind === 'item' ? `icon_${u.item}` : u.kind === 'starter' ? 'goblin_head' : u.kind === 'goblin' ? `goblin_head__${u.skin}` : `cart_back__${u.skin}`;
    const name = u.kind === 'item' ? itemT(u.item).name : u.kind === 'starter' ? starterT(u.starter).name : u.kind === 'goblin' ? goblinSkinT(u.skin).name : cartSkinT(u.skin).name;
    return `<div class="nrow"><img src="${svg(icon)}" alt=""><span class="ntxt"><b>${name}</b><small>${unlockNeedT(n.id)}</small>${bar([n.cur, n.need])}</span></div>`;
  }).join('');
  return `${grid}${rows ? `<div class="almost"><h5 class="sec">${t('almostThere')}</h5>${rows}</div>` : ''}`;
}

const DMG_LABELS: Record<string, UIKey> = { burn: 'dmgBurn', poison: 'dmgPoison', 'Bag It': 'dmgBag', 'Tin Foil Hat': 'dmgFoil', Slam: 'dmgSlam', shove: 'dmgShove', 'Oven vent': 'dmgVent', 'Live cable': 'dmgCable', 'Party Popper': 'dmgPopper', 'Egg Carton': 'dmgEgg' };

function endHtml(): string {
  const s = store.state;
  const won = s.phase === 'victory';
  const res = flow.lastResult;
  const icons = [...s.inventory.placed].map((i) => `<span class="endicon ${rarityClass(i.type, i.tier)}" title="${itemT(i.type).name}"><img src="${svg(`icon_${i.type}`)}" alt="${itemT(i.type).name}">${starsHtml(i.tier)}</span>`).join('');
  const dmg = Object.entries(s.stats.damageByWeapon).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => {
    const it = s.inventory.placed.find((i) => i.uid === k) ?? s.inventory.shelf.find((i) => i?.uid === k);
    const name = it ? itemT(it.type).name : t(DMG_LABELS[k] ?? 'dmgSold');
    return `<div class="line"><span>${name}</span><span>${Math.round(v)}</span></div>`;
  }).join('');
  const mins = Math.floor(s.stats.timeSeconds / 60), secs = Math.floor(s.stats.timeSeconds % 60);
  const fresh = res ? freshHtml(res) : '';
  return `<div class="endcard receipt ${fresh ? 'cols' : ''}">
    <h2 class="display" style="font-size:46px;margin:0;color:${won ? 'var(--green-deep)' : 'var(--coral)'}">${won ? t('paidInFull') : s.overtime ? t('overtimeOver') : t('wipedOut')}</h2>
    <div style="text-align:center;font-weight:800">${won ? t('managerReturned') : t('cartStopped', { where: s.wave === BOSS_WAVE ? t('theFinalAisle') : t('aisleLc', { n: s.wave }) })}</div>
    <div style="text-align:center;font-weight:800">${t('shiftN', { n: s.shift + 1, name: shiftT(s.shift).name })}</div>
    <hr class="dash">
    <div class="endbody"><div class="endl">
    <div class="line"><span>${t('aislesCleared')}</span><span>${Math.min(s.stats.wavesCleared, BOSS_WAVE - 1)}/${BOSS_WAVE - 1}${won ? t('plusBoss') : ''}</span></div>
    ${s.overtime ? `<div class="line"><span>${t('aislesPast')}</span><span>${Math.max(0, s.wave - BOSS_WAVE - 1)}</span></div>` : ''}
    <div class="line"><span>${t('groceriesReturned')}</span><span>${s.stats.kills}</span></div>
    <div class="line"><span>${t('coinsEarned')}</span><span>${s.stats.coinsEarned}</span></div>
    <div class="line"><span>${t('timeInStore')}</span><span>${mins}:${String(secs).padStart(2, '0')}</span></div>
    <hr class="dash">
    <div style="font-weight:800;text-align:center">${t('finalCart')}</div>
    <div class="icons">${icons || '—'}</div>
    ${s.build.recipes.length ? `<div style="text-align:center">${s.build.recipes.map((r) => `<span class="badge">${recipeT(r.id).name}</span>`).join(' ')}</div>` : ''}
    ${dmg ? `<hr class="dash"><div style="font-weight:800">${t('damageByItem')}</div>${dmg}` : ''}
    <hr class="dash">
    <div class="score">${t('pts', { n: res?.score ?? 0 })}</div>
    ${res?.newBest ? `<span class="newbest sticker">${t('newBest')}</span>` : ''}
    ${res?.daily ? `<div style="text-align:center;font-weight:800">${res.daily.newBest ? t('dailyNewBest') + ' · ' : ''}${t('dailyEndBest', { n: res.daily.best })}</div>` : ''}
    </div>${fresh ? `<div class="endr">${fresh}</div>` : ''}</div>
    ${res ? stampsHtml(res) : ''}
    ${s.lab ? `<div class="row"><button class="btn coral" data-act="lab-back" data-focus>${t('backToLab')}</button><button class="btn" data-act="quit">${t('titleBtn')}</button></div>` : `${won ? `<div class="row"><button class="btn coral overtime" data-act="overtime" data-focus>${t('keepGoing')}</button></div>` : ''}<div class="row"><button class="btn ${won ? '' : 'coral'}" data-act="again" ${won ? '' : 'data-focus'}>${t('shopAgain')}</button><button class="btn" data-act="end-catalog">${t('catalog')}</button><button class="btn" data-act="quit">${t('titleBtn')}</button></div>`}
    <div style="display:flex;justify-content:center;margin-top:12px"><div class="barcode" style="width:180px"></div></div>
  </div>`;
}

// ───────────────────────────── input ─────────────────────────────

function onClick(e: MouseEvent): void {
  const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
  if (listening && act !== 'bind') stopListening();
  if (!act || store.state.phase === 'shop') return; // shop handles its own buttons
  play('click');
  switch (act) {
    case 'play': choosingStarter = true; render(); break;
    case 'again': startMusic(); if (store.state.daily) { flow.startRun(undefined, undefined, undefined, undefined, { daily: true }); break; } flow.startRun(store.state.starter, store.state.shift, store.state.weapon, store.state.theme); break;
    case 'overtime': flow.overtime(); break;
    case 'shift': pickedShift = Number((e.target as HTMLElement).closest<HTMLElement>('[data-shift]')!.dataset.shift); screens.starter.innerHTML = starterHtml(); screens.starter.querySelector<HTMLElement>('[data-focus]')?.focus(); break;
    case 'weapon': pickWeapon((e.target as HTMLElement).closest<HTMLElement>('[data-weapon]')!.dataset.weapon as StarterWeapon); screens.starter.innerHTML = starterHtml(); screens.starter.querySelector<HTMLElement>('[data-focus]')?.focus(); break;
    case 'theme': pickTheme((e.target as HTMLElement).closest<HTMLElement>('[data-theme]')!.dataset.theme as DepartmentId); screens.starter.innerHTML = starterHtml(); screens.starter.querySelector<HTMLElement>('[data-focus]')?.focus(); break;
    case 'starter': pickStarter((e.target as HTMLElement).closest<HTMLElement>('[data-starter]')!.dataset.starter as StarterId); screens.starter.innerHTML = starterHtml(); screens.starter.querySelector<HTMLElement>('[data-focus]')?.focus(); break;
    case 'start-run': startPicked(); break;
    case 'close-starter': choosingStarter = false; render(); break;
    case 'resume': flow.resume(); break;
    case 'restart': flow.startRun(); break;
    case 'quit': flow.toTitle(); break;
    case 'end-catalog': flow.toTitle(); openTitleModal(codexHtml(newCount('item:') && !newCount('recipe:') ? 'items' : !newCount('recipe:') && newCount('enemy:') ? 'enemies' : 'combos')); break;
    case 'exit': desktop?.quit(); break;
    case 'door': flow.chooseDoor((e.target as HTMLElement).closest<HTMLElement>('[data-id]')!.dataset.id as DoorId); break;
    case 'settings': openSettingsModal(); break;
    case 'replay-tutorial': resetTutorial(); (e.target as HTMLElement).closest('button')!.disabled = true; break;
    case 'close-settings':
      closeTitleSettings();
      break;
    case 'credits': openTitleModal(creditsHtml()); break;
    case 'bind': {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act="bind"]')!;
      listening = { action: b.dataset.action as KeyAction, slot: Number(b.dataset.slot) };
      refreshBinds('', listening);
      break;
    }
    case 'reset-keys': listening = null; settings.keys = defaultKeys(); saveSettings(); refreshBinds(); break;
    case 'lab': openTitleModal(labHtml(loadLab())); break;
    case 'unlock-all':
      unlockAll();
      screens.title.innerHTML = titleHtml();
      break;
    case 'lab-open': {
      const o = readLab();
      saveLab(o);
      startMusic();
      flow.startLab(o);
      break;
    }
    case 'lab-back': startMusic(); flow.labBack(); break;
    case 'codex': openTitleModal(codexHtml('combos')); break;
    case 'codex-tab': {
      const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')!.dataset.tab as 'combos' | 'items' | 'enemies';
      openTitleModal(codexHtml(tab));
      break;
    }
    case 'wardrobe': openTitleModal(wardrobeHtml()); break;
    case 'history': openTitleModal(historyHtml()); break;
    case 'daily': startMusic(); flow.startRun(undefined, undefined, undefined, undefined, { daily: true }); break;
    case 'skin': {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-skin]')!;
      const [kind, id] = el.dataset.skin!.split(':');
      if (kind === 'goblin' && goblinUnlocked(id as GoblinSkin)) profile.goblin = id as GoblinSkin;
      if (kind === 'cart' && cartUnlocked(id as CartSkin)) profile.cart = id as CartSkin;
      saveProfile();
      openTitleModal(wardrobeHtml());
      flow.restartArena(); // title backdrop shows the new look right away
      break;
    }
  }
}

/** Title settings open as a centered modal (same layout as the pause menu), never inside the button column. */
function openSettingsModal(): void {
  screens.title.querySelector('.settings-modal')?.remove();
  screens.title.insertAdjacentHTML('beforeend', `<div class="overlay settings-modal"><div class="panel receipt" role="dialog" aria-label="${t('settings')}">
    <h2>${t('settings')}</h2>${settingsHtml()}
    <div class="row"><button class="btn coral" data-act="close-settings" data-focus>${t('done')}</button></div></div></div>`);
  screens.title.querySelector<HTMLElement>('.settings-modal [data-focus]')?.focus();
}

function historyHtml(): string {
  const fmt = new Intl.DateTimeFormat(lang() === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const rows = profile.history.map((h) => `<div class="hcard">
      <div class="htop"><span class="hstamp ${h.win ? 'win' : ''}">${h.win ? t('stampWin') : t('stampLoss')}</span><b>${fmt.format(h.t)}</b>${h.daily ? `<span class="badge">${t('histDaily')}</span>` : ''}<span class="hscore display">${t('pts', { n: h.score })}</span></div>
      <div class="hmeta">${t('histAisle', { n: h.aisle })} · ${t('shiftN', { n: h.shift + 1, name: shiftT(h.shift).name })} · ${starterT(h.starter).name}</div>
      <div class="hicons">${h.items.map((i) => `<img src="${svg(`icon_${i}`)}" title="${itemT(i).name}" alt="${itemT(i).name}">`).join('')}${h.sets.map((x) => `<span class="hset" title="${x.id} ${x.lv}">${setIcon(x.id, 14)}<small>${x.lv}</small></span>`).join('')}</div>
    </div>`).join('');
  return `<h2>${t('historyTitle')}</h2><div class="hlist">${rows || `<div class="hempty">${t('historyEmpty')}</div>`}</div>`;
}

/** Loyalty card strip for the end screen: ten circles, new stamps highlighted. */
function stampsHtml(res: NonNullable<typeof flow.lastResult>): string {
  const l = res.loyalty;
  if (!l) return '';
  const total = l.before + l.gained, filled = Math.min(total, STAMPS_PER_CARD);
  const dots = Array.from({ length: STAMPS_PER_CARD }, (_, i) => `<i class="stamp ${i < filled ? 'on' : ''} ${i >= l.before && i < filled ? 'new' : ''}"></i>`).join('');
  return `<div class="stamprow"><b class="display">${t('stampCard')}</b><span class="stamps">${dots}</span><small>${l.card ? t('voucherEarned', { n: COUPON_COINS }) : t('stampsGained', { n: l.gained })}${profile.coupons ? ` · ${t('voucherPending', { n: profile.coupons })}` : ''}</small></div>`;
}

/** Shows a modal over the title screen (replacing any open one). */
function openTitleModal(inner: string): void {
  screens.title.querySelector('.settings-modal')?.remove();
  screens.title.insertAdjacentHTML('beforeend', `<div class="overlay settings-modal"><div class="panel receipt wide" role="dialog">${inner}
    <div class="row"><button class="btn coral" data-act="close-settings" data-focus>${t('done')}</button></div></div></div>`);
  screens.title.querySelector<HTMLElement>('.settings-modal [data-focus]')?.focus();
}

const bar = ([v, n]: [number, number]) => `<span class="pbar"><i style="width:${(100 * v) / n}%"></i></span><span class="pnum">${v}/${n}</span>`;

const newBadge = (n: number) => (n ? `<i class="newdot">${n}</i>` : '');
const newTag = (key: string) => (isNew(key) ? `<i class="newtag sticker">${t('newTag')}</i>` : '');
const TAB_PREFIX = { combos: 'recipe:', items: 'item:', enemies: 'enemy:' } as const;

/** Catalog tab; entries shown here count as seen afterwards. */
function codexHtml(tab: 'combos' | 'items' | 'enemies'): string {
  const html = codexTab(tab);
  markSeen(TAB_PREFIX[tab]);
  return html;
}

function codexTab(tab: 'combos' | 'items' | 'enemies'): string {
  const ids = Object.keys(RECIPES) as RecipeId[];
  const unlocked = new Set(unlockedItems());
  const tabs = `<div class="tabs"><button class="tab ${tab === 'combos' ? 'on' : ''}" data-act="codex-tab" data-tab="combos">${t('tabCombos')} ${profile.recipes.length}/${ids.length}${tab !== 'combos' ? newBadge(newCount('recipe:')) : ''}</button>
    <button class="tab ${tab === 'items' ? 'on' : ''}" data-act="codex-tab" data-tab="items">${t('tabItems')} ${unlocked.size}/${ITEM_IDS.length}${tab !== 'items' ? newBadge(newCount('item:')) : ''}</button>
    <button class="tab ${tab === 'enemies' ? 'on' : ''}" data-act="codex-tab" data-tab="enemies">${t('tabEnemies')}${tab !== 'enemies' ? newBadge(newCount('enemy:')) : ''}</button></div>`;
  if (tab === 'enemies') {
    const cards = CODEX_ENEMIES.map((id) => {
      const d = ENEMIES[id], rec = profile.enemies[id], ap = enemyAppears(id);
      const art = svg(enemyFrame(id));
      // Every enemy is listed from the start; only your kill counts grow.
      const spd = d.speed < 50 ? t('slow') : d.speed < 75 ? t('medium') : t('fast'), et = enemyT(id);
      const aisles = ap.first === ap.last ? t('aisleLc', { n: ap.first }) : t('aislesRange', { a: ap.first, b: ap.last });
      const depts = ap.depts.map((x) => deptT(x).name);
      const best = isBossId(id) ? Math.max(-1, ...Object.values(profile.stats.bestShift).map((n) => n ?? -1)) : -1;
      return `<div class="codex-card known enemy">${newTag(`enemy:${id}`)}<div class="icons"><img src="${art}" alt=""></div><div class="nm">${et.name}</div><div class="eff">${t('enemyStat', { hp: d.hp, dmg: d.contactDamage, spd })}</div><div class="det">${et.blurb}</div>
        <div class="det">${t('appears', { aisles })}${depts.length ? ` \u00b7 ${depts.join(', ')}` : ''}</div>
        <div class="det">${t('returned', { n: rec?.kills ?? 0 })}${rec?.elites ? ` ${t('eliteCount', { n: rec.elites })}` : ''}${best >= 0 ? ` \u00b7 ${t('beatenOn', { name: shiftT(best).name })}` : ''}</div></div>`;
    }).join('');
    return `<h2>${t('catalog')}</h2>${tabs}<div class="codex-items" style="display:block"><div class="det" style="margin:6px 0;font-size:13px;font-weight:700">${t('eliteNote', { hp: ELITE.hpMult, coin: ELITE.coinMult })}</div><div class="codex-grid">${cards}</div></div>`;
  }
  if (tab === 'combos') {
    const cards = ids.map((id) => {
      const r = RECIPES[id], rt = recipeT(id);
      const known = profile.recipes.includes(id);
      const icons = recipeParts(r).map((ty, i) => (known || i === 0 || unlocked.has(ty)) ? `<img src="${svg(`icon_${ty}`)}" alt="${itemT(ty).name}" data-card="${ty}">` : '<span class="q">?</span>').join('<b>+</b>');
      return known
        ? `<div class="codex-card known">${newTag(`recipe:${id}`)}<div class="icons">${icons}</div><div class="nm">${rt.name}</div><div class="eff">${rt.short}</div><div class="det">${rt.detail}</div></div>`
        : `<div class="codex-card"><div class="icons">${icons}</div><div class="nm">???</div><div class="det">${recipeParts(r).length === 2 ? t('comboHintOne', { item: itemT(recipeIcon(r)).name }) : t('comboHintMany', { item: itemT(recipeIcon(r)).name, n: recipeParts(r).length - 1 })}</div></div>`;
    }).join('');
    return `<h2>${t('catalog')}</h2>${tabs}<div class="codex-grid">${cards}</div>`;
  }
  const tiles = ITEM_IDS.map((ty) => {
    if (unlocked.has(ty)) return `<div class="codex-item ${ITEMS[ty].legendary ? 'legendary' : ''}" data-card="${ty}">${newTag(`item:${ty}`)}<img src="${svg(`icon_${ty}`)}" alt=""><span>${itemT(ty).name}</span></div>`;
    const u = UNLOCKS.find((x) => x.kind === 'item' && x.item === ty)!;
    return `<div class="codex-item locked" data-card="${ty}"><img src="${svg(`icon_${ty}`)}" alt=""><span>${unlockNeedT(u.id)}</span>${bar(u.progress(profile.stats))}</div>`;
  }).join('');
  return `<h2>${t('catalog')}</h2>${tabs}<div class="codex-items">${tiles}</div>`;
}

function wardrobeHtml(): string {
  const goblins = (Object.keys(GOBLIN_SKINS) as GoblinSkin[]).map((k) => {
    const ok = goblinUnlocked(k), u = UNLOCKS.find((x) => x.kind === 'goblin' && x.skin === k);
    const key = k === 'classic' ? 'goblin_head' : `goblin_head__${k}`;
    return `<button class="skin ${profile.goblin === k ? 'on' : ''} ${ok ? '' : 'locked'}" data-act="skin" data-skin="goblin:${k}" ${ok ? '' : 'disabled'}>
      <img src="${svg(key)}" alt=""><b>${goblinSkinT(k).name}</b><small>${ok ? (profile.goblin === k ? t('equipped') : goblinSkinT(k).blurb) : unlockNeedT(u!.id)}</small>${ok ? '' : bar(u!.progress(profile.stats))}</button>`;
  }).join('');
  const carts = (Object.keys(CART_SKINS) as CartSkin[]).map((k) => {
    const ok = cartUnlocked(k), u = UNLOCKS.find((x) => x.kind === 'cart' && x.skin === k);
    const key = k === 'chrome' ? 'cart_back' : `cart_back__${k}`;
    return `<button class="skin ${profile.cart === k ? 'on' : ''} ${ok ? '' : 'locked'}" data-act="skin" data-skin="cart:${k}" ${ok ? '' : 'disabled'}>
      <img src="${svg(key)}" alt=""><b>${cartSkinT(k).name}</b><small>${ok ? (profile.cart === k ? t('equipped') : cartSkinT(k).blurb) : unlockNeedT(u!.id)}</small>${ok ? '' : bar(u!.progress(profile.stats))}</button>`;
  }).join('');
  return `<h2>${t('wardrobe')}</h2><h5 class="sec">${t('goblin')}</h5><div class="skins">${goblins}</div><h5 class="sec">${t('cart')}</h5><div class="skins">${carts}</div>`;
}

/** Closes the title-screen settings modal; returns true if one was open. */
function closeTitleSettings(): boolean {
  const m = screens.title.querySelector('.settings-modal');
  m?.remove();
  hideItemCard();
  const cb = screens.title.querySelector<HTMLElement>('[data-act="codex"]');
  cb?.querySelector('.newdot')?.remove();
  cb?.insertAdjacentHTML('beforeend', newBadge(newCount()));
  if (m) screens.title.querySelector<HTMLElement>('[data-act="settings"]')?.focus();
  return !!m;
}


function labHtml(o: LabOpts): string {
  const opts = (vals: (string | number)[], cur: string | number, label: (v: any) => string = String) => vals.map((v) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label(v)}</option>`).join('');
  const row = (name: string, label: string, html: string) => `<label>${label}<select data-lab="${name}">${html}</select></label>`;
  const aisles = Array.from({ length: 15 }, (_, i) => i + 1);
  const carts = [[4, 4], ...ECONOMY.cartSizes].map(([c, r]) => `${c}x${r}`);
  const shelves = [ECONOMY.shelfSlots, ...ECONOMY.shelfSizes];
  return `<h2>${t('lab')}</h2><div class="settings lab-form">
    ${row('aisle', t('labAisle'), opts(aisles, o.aisle, (a) => (a === BOSS_WAVE ? `${a} (${t('labBoss')})` : a > BOSS_WAVE ? `${a} (${t('labOvertime')})` : a)))}
    ${row('dept', t('labDept'), opts(THEMES, THEMES.includes(o.dept) ? o.dept : 'main', (d: DepartmentId) => deptT(d).name))}
    ${row('mod', t('labMod'), opts(Object.keys(MODIFIERS), o.mod ?? 'none', (m: ModifierId) => modT(m).name))}
    ${row('shift', t('labShift'), opts(SHIFTS.map((_, i) => i), o.shift, (i) => `${i + 1}: ${shiftT(i).name}`))}
    ${row('starter', t('labStarter'), opts(STARTERS, o.starter, (s: StarterId) => starterT(s).name))}
    ${row('weapon', t('labWeapon'), opts(WEAPONS, o.weapon, (w: StarterWeapon) => itemT(w).name))}
    <label>${t('labMoney')}<input type="number" data-lab="money" value="${o.money}" min="0" step="100"></label>
    ${row('cart', t('labCart'), opts(carts, o.cart.join('x')))}
    ${row('shelf', t('labShelf'), opts(shelves, o.shelf))}
    ${row('shopLevel', t('labLoyalty'), opts(SHOP_LEVELS.map((_, i) => i + 1), o.shopLevel))}
    ${row('event', t('labEvent'), opts(['random', 'none', 'wetFloor', 'outage', 'happyHour', 'heatwave', 'powerSurge', 'flashSale', 'freezerFail'], o.event ?? 'random', (v) => v in SET_EVENTS ? t(`evName_${v as SetEventKind}`) : t(({ random: 'evRandom', none: 'evNone', wetFloor: 'evWet', outage: 'evOutage' } as const)[v as 'random'])))}
    <label class="check"><input type="checkbox" data-lab="god" ${o.god ? 'checked' : ''}>${t('labGod')}</label>
    <label class="check"><input type="checkbox" data-lab="keep" ${o.keep ? 'checked' : ''}>${t('labKeep')}</label>
    <div class="row"><button class="btn coral" data-act="lab-open">${t('labOpen')}</button></div></div>`;
}

function readLab(): LabOpts {
  const f = (k: string) => screens.title.querySelector<HTMLInputElement>(`[data-lab="${k}"]`)!;
  const aisle = Number(f('aisle').value);
  return {
    aisle, dept: f('dept').value as DepartmentId, shift: Number(f('shift').value), starter: f('starter').value as StarterId, weapon: f('weapon').value as StarterWeapon,
    money: Math.max(0, Math.floor(Number(f('money').value)) || 0), cart: f('cart').value.split('x').map(Number) as [number, number],
    shelf: Number(f('shelf').value), shopLevel: Number(f('shopLevel').value), event: f('event').value as LabOpts['event'], mod: f('mod').value as ModifierId, god: f('god').checked, keep: f('keep').checked,
  };
}

/** Applies a new UI language and redraws whatever is on screen (title keeps its settings modal open). */
function changeLanguage(l: Lang): void {
  setLang(l);
  settings.language = l;
  saveSettings();
  document.documentElement.lang = l;
  const modal = !!screens.title.querySelector('.settings-modal');
  if (!screens.title.classList.contains('hidden')) {
    screens.title.innerHTML = titleHtml();
    if (modal) openSettingsModal();
  }
  if (!screens.pause.classList.contains('hidden')) screens.pause.innerHTML = pauseHtml();
  screens.loadout.classList.contains('hidden') || (screens.loadout.innerHTML = loadoutHtml());
  screens.end.classList.contains('hidden') || (screens.end.innerHTML = endHtml());
  screens.route.classList.contains('hidden') || (screens.route.innerHTML = routeHtml());
  screens.starter.classList.contains('hidden') || (screens.starter.innerHTML = starterHtml());
  relabelHud();
  store.changed();
  (modal ? screens.title : ui).querySelector<HTMLElement>('[data-set="language"]')?.focus();
}

const applyMotion = (): void => { document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion); };

function onInput(e: Event): void {
  const el = e.target as HTMLInputElement;
  const k = el.dataset.set as keyof typeof settings | undefined;
  if (!k) return;
  if (k === 'language') { changeLanguage(el.value as Lang); return; }
  if (el.type === 'range') {
    (settings[k] as number) = Number(el.value) / 100;
    const v = el.parentElement?.querySelector(`[data-val="${k}"]`);
    if (v) v.textContent = el.value;
  } else (settings[k] as boolean) = el.checked;
  saveSettings();
  applyMotion();
  refreshVolumes();
  if (k === 'fullscreen') desktop?.setFullscreen(settings.fullscreen);
}

function onKey(e: KeyboardEvent): void {
  if (listening) { listenKey(e); return; }
  if (shopKey(e)) { e.preventDefault(); return; }
  const s = store.state;
  if (e.key === 'F11' && desktop) {
    e.preventDefault();
    settings.fullscreen = !settings.fullscreen;
    saveSettings();
    desktop.setFullscreen(settings.fullscreen);
    return;
  }
  if (s.phase === 'route' && /^[1-3]$/.test(e.key)) {
    const id = s.doors?.[Number(e.key) - 1];
    if (id) { play('click'); flow.chooseDoor(id); }
    return;
  }
  if (e.key === 'Escape' && closeTitleSettings()) { e.preventDefault(); return; }
  if (choosingStarter && s.phase === 'title') {
    if (e.key === 'Escape') { choosingStarter = false; render(); e.preventDefault(); return; }
    if (e.key.toLowerCase() === 'w') { pickWeapon(WEAPONS[(WEAPONS.indexOf(pickedWeapon) + 1) % WEAPONS.length]); play('click'); screens.starter.innerHTML = starterHtml(); return; }
    if (e.key.toLowerCase() === 't') { pickTheme(THEMES[(THEMES.indexOf(pickedTheme) + 1) % THEMES.length]); play('click'); screens.starter.innerHTML = starterHtml(); return; }
    const pick = STARTERS[Number(e.key) - 1];
    if (pick) { pickStarter(pick); play('click'); screens.starter.innerHTML = starterHtml(); return; }
    if (e.key === 'Enter' && !(e.target as HTMLElement).closest('[data-act="start-run"],[data-act="close-starter"]')) { startPicked(); e.preventDefault(); }
  }
  // Escape always backs out of a pause; the pause key (Escape by default) also starts one.
  if (matches(settings.keys, 'pause', e.code) || (e.key === 'Escape' && flow.paused)) {
    togglePause();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    e.preventDefault();
  } else if (matches(settings.keys, 'loadout', e.code)) {
    e.preventDefault();
    toggleLoadout();
  } else if (DEV_KEYS && !flow.paused && (e.key === 'F6' || e.key === 'F7')) {
    e.preventDefault(); s.money += e.key === 'F7' ? 500_000 : 100; store.changed(); // test money, also in the shop
  } else if (DEV_KEYS && s.phase === 'combat' && !flow.paused) devKey(e);
}

function togglePause(): void {
  if (flow.paused) flow.resume();
  else if (store.state.phase === 'combat') flow.pause('menu');
}

function toggleLoadout(): void {
  if (flow.paused && flow.pauseReason === 'loadout') flow.resume();
  else if (!flow.paused && store.state.phase === 'combat') flow.pause('loadout');
}

// ───────────────────────────── keyboard / gamepad glue ─────────────────────────────

/** Menu focus stays inside the topmost modal, else the visible screen. */
function padScope(): HTMLElement | null {
  const modal = screens.title.querySelector<HTMLElement>('.settings-modal');
  if (modal && !screens.title.classList.contains('hidden')) return modal;
  for (const k of ['starter', 'pause', 'loadout', 'end', 'route', 'title'] as const) if (!screens[k].classList.contains('hidden')) return screens[k];
  return null;
}

/** B in menus: Escape's behaviour (close the modal or starter screen, resume from a pause). */
function padBack(): void {
  if (listening) { stopListening(); return; }
  if (closeTitleSettings()) return;
  if (choosingStarter && store.state.phase === 'title') { choosingStarter = false; render(); return; }
  if (flow.paused) flow.resume();
}

function initPad(): void {
  initKeyboard(() => store.state.phase === 'combat' && !flow.paused);
  initGamepad({
    mode: () => {
      const ph = store.state.phase;
      return ph === 'shop' ? 'shop' : (ph === 'combat' || ph === 'checkout') && !flow.paused ? 'combat' : 'menu';
    },
    scope: padScope,
    pause: togglePause,
    loadout: toggleLoadout,
    back: padBack,
    lost: () => { if (store.state.phase === 'combat') flow.pause('menu'); },
    shop: shopPad,
  });
}

/** Dev shortcuts: on in `npm run dev` and in test builds (`npm run launch:test`), stripped from release builds. */
const DEV_KEYS = import.meta.env.DEV || import.meta.env.VITE_DEV_KEYS === '1' || LAB;

function devKey(e: KeyboardEvent): void {
  const arena = (window as unknown as { __arena: { devEndWave(): void; devStress(): void } }).__arena;
  if (e.key === 'F2') { e.preventDefault(); arena.devEndWave(); }
  if (e.key === 'F4') { e.preventDefault(); arena.devStress(); }
  if (e.key === 'F3') { e.preventDefault(); import('./dev').then((m) => (e.shiftKey ? m.jumpToMini() : m.jumpToBoss())); }
}
