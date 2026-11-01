# ui-flow audit

Scope: `src/ui/*` (DOM, menus, HUD, shop DOM/focus/events, catalog, lab bench), `src/flow.ts`, `src/i18n/*`, `src/input/*`, `src/state/profile.ts`, `src/state/keymap.ts`, `src/state/settings.ts`, `src/main.ts`, `src/lab.ts`, `electron/*`.

Counts: critical 1, high 1, medium 5, low 8.

What I checked and found clean:
- **Listener leaks.** Every DOM controller (`initUi`, `initShop`, `initHud`, `initTutorial`, `initLabBench`, `initSimTag`, `initKeyboard`, `initGamepad`) runs once at boot. Opening the shop only calls `render()`, which replaces `innerHTML` under one delegated `root` listener. The floating item card (`shop.ts:491`) is created once and reused. The stockroom overlay removes its window `keydown` listener before every re-show and on scene SHUTDOWN (`stockroom.ts:12-18`, `ArenaScene.ts:202`). No scene subscribes to `store.on`. I found no handler that grows with the number of shop opens or restarts.
- **i18n.** `de` is typed `Record<keyof typeof en, string>`, and `tests/i18n-ui.test.ts` already diffs the key sets and the `{var}` placeholders. I wrote a throwaway test (`tests/_audit/ui-i18n.test.ts`, now deleted) that (a) checked every dynamic key family (`modName_/modShort_/modFx_/modRw_`, `roomSub_`, `affix_`, `pcText_`, `evName_/evSub_`, `sig_`, `tut*/tip*`) exists in EN and DE, and (b) scanned all 519 literal `t('key', {...})` call sites in `src/` and compared the vars passed against the placeholders in EN ∪ DE. It found no missing keys and no var mismatches. `evName_wetFloor/outage` do not exist, but `labFields.ts:34` guards them with `v in SET_EVENTS`, so that is not a bug. The tutorial's `keyVars()` provides `move`, `shove`, `loadout` and `pause`, which covers every `tut*/tip*` placeholder.
- **XSS.** The only free-text input a user can edit is the lab search box, and it is escaped (`labBench.ts:74`). The coin log and shop ledger labels go through `esc()` (`shop.ts:268-269`). All other `innerHTML` content is static content text.
- **Electron security.** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `setWindowOpenHandler` deny, `will-navigate` prevented. The `app://` handler normalizes the path and checks the `DIST + sep` prefix, so path traversal fails. The preload exposes three narrow functions.
- **Keymap logic.** As pure functions, `rebind` and `clearSlot` handle swap within an action, swap across actions, and refusing an action's last key correctly. `sanitizeKeys` drops duplicate, reserved and non-string entries and migrates the legacy `useActive`. The exception is a swap that hands Escape to another action: see finding 7.
- **Profile progress.** `freshSince` dedups against the run's own unlock list: `fresh.unlocks = [...new Set([...fresh.unlocks, ...got])]` (`flow.ts:251`). `evaluateUnlocks` only pushes ids that are not unlocked yet, so unlocks are not double counted. `markSeen` filters through `isNew`, so `profile.seen` never gets duplicates. `nearUnlocks` drops ratio ≤ 0, ratio ≥ 1 and NaN (need = 0). Lab and bot runs return before any profile write (`flow.ts:231`). The overtime defeat updates `history[0]` instead of adding a second entry, and stamps are not given twice.
- **Pad unplug mid-shop.** `lost()` only pauses in combat. If an item is held with the pad, it stays held, but Esc (`shopKey`), pointer release on a target, or a pad reconnect plus B all recover it, apart from the ghost leak in finding 6. The cursor is keyed by `padKey`, so it survives re-renders.
- **Focus loss.** `blur` and `visibilitychange` call `flow.pause('blur')`, which is a no-op outside combat and checkout, so the shop is never paused under the player. `keyboard.ts` clears held keys on blur, and the scene RESUME also clears them. A drag is not cancelled on blur. It only breaks if the pointerup is lost and the player then presses on an item (finding 6).

---

## Critical

### 1. Gamepad-only players cannot pick from the stockroom or the mini-boss crates: softlock
- `src/input/gamepad.ts:125-128` and `src/ui/ui.ts:887`
```ts
// ui.ts:887  mode()
return ph === 'shop' ? 'shop' : (ph === 'combat' || ph === 'checkout') && !flow.paused ? 'combat' : 'menu';
// gamepad.ts:125
if (mode === 'combat') {
  if (edges.includes(BTN.A)) { shoveQueued = true; shoveCount++; }
  [BTN.X, BTN.LB, BTN.RB].forEach(...);
  return;               // no DOM focus navigation in combat
}
```
- **Failure scenario:** The pick-one overlay (`showStockroom`, `src/ui/stockroom.ts:20-57`) is shown while `phase === 'combat'`, both for the mini-boss crates (`ArenaScene.ts:516`) and for the stockroom room (`ArenaScene.ts:1349`). The aisle only ends from that overlay's `onPick`. In 'combat' mode the pad never moves DOM focus or clicks, so A only queues a shove. Pausing with Start switches to 'menu' mode, but `padScope()` (`ui.ts:867-872`) returns `screens.pause`, and `activate()` only clicks inside that scope, so the overlay is still unreachable. Neither aisle has a timer (`ArenaScene.ts:1035`, `:1077`). The mini-boss aisle comes in every run unless the player picks the stockroom door, which needs the same overlay. A controller-only player gets stuck at the mini-boss aisle every run and has to grab a mouse or keyboard (1-3 / Enter). On a Steam Deck the touchscreen or trackpad gets them out, but a couch pad setup does not.
- **Label:** confirmed (traced mode → frame → scope/activate; no other pad path reaches `.stockroom [data-i]`).
- **Fix:** While the overlay is open, give it a pad context: either a 'menu' mode whose scope is `.stockroom`, or route d-pad and A in `frame()` to the cards (the cards already have `tabindex="0"` and an Enter handler).

## High

### 2. "Restart run" from the pause menu turns a daily run into a normal random run and spends a voucher
- `src/ui/ui.ts:594` and `src/flow.ts:51-57`
```ts
case 'restart': flow.startRun(); break;      // no { daily: true }
// flow.ts
const seed = opts.daily ? dailySeed() : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
if (opts.daily) { store.state.daily = true; noteDailyStart(); }
else if (!BOT && useCoupon()) { store.state.money += COUPON_COINS; store.state.voucher = true; }
```
- **Failure scenario:** The player starts the Daily, pauses, and clicks "Restart run". `startRun()` takes the starter, shift, weapon and theme from the current state but not the daily flag. The new run has a random seed and `daily` unset, a pending voucher is spent on it, and its result never reaches `profile.daily` or gets the daily badge in history. The player thinks they are retrying the daily. The end screen's "Shop again" (`ui.ts:585`) handles the daily correctly, so only the pause path is wrong.
- **Label:** confirmed (code trace).
- **Fix:** Mirror the `again` branch: `flow.startRun(undefined, undefined, undefined, undefined, { daily: !!store.state.daily })`.

## Medium

### 3. Tab is swallowed everywhere, so keyboard-only menu navigation dead-ends
- `src/ui/ui.ts:846-848`
```ts
} else if (matches(settings.keys, 'loadout', e.code)) {
  e.preventDefault();
  toggleLoadout();
```
- **Failure scenario:** The default loadout key is `Tab`. `onKey` calls `preventDefault` whatever the phase, including on the title screen, the pause menu, the end screen and in title modals. Menus have no arrow-key navigation, so a keyboard user can only press Enter on the `[data-focus]` button. From the title they cannot reach Catalog, Daily, Settings or Wardrobe, and from the pause menu they cannot reach "Quit to title" or the settings.
- **Label:** confirmed (code trace).
- **Fix:** Only intercept the loadout key while `phase === 'combat'` or the loadout pause is open. Otherwise let Tab move focus.

### 4. The fourth door (Staff Only at loyalty 3) shows key "4", but pressing 4 does nothing
- `src/ui/ui.ts:826` against `:478` and `:503`
```ts
if (s.phase === 'route' && /^[1-3]$/.test(e.key)) {
...
<div class="hint">${t('clickDoor', { keys: doors.map((_, i) => `<kbd>${i + 1}</kbd>`).join(' ') })}</div>
```
- **Failure scenario:** `rollDoors` (`src/systems/shop.ts:86-94`) deals three doors at loyalty ≥ 3 (`threeDoorsAtLoyalty: 3`) and appends `'shortcut'` when the player holds a key. Four cards show (CSS added for this in b0827b7), the card and the hint both say "4", and `onKey` ignores the 4 key. `isReserved` already reserves Digit1-4 for this purpose (`keymap.ts:33`).
- **Label:** confirmed (code trace).
- **Fix:** Use `/^[1-4]$/`, or better, `/^\d$/` limited to `doors.length`.

### 5. The stockroom/crate overlay draws above the pause menu, and 1-3 picks while paused
- `src/ui/stockroom.ts:51-55`, `src/ui/style.css:912` (`.stockroom { ... z-index: 40 }`) and `src/ui/style.css:139` (`.overlay` has no z-index)
```ts
onKey = (e: KeyboardEvent) => {
  const n = Number(e.key);
  if (n >= 1 && n <= offers.length) pick(n - 1);   // no pause check
};
```
- **Failure scenario:** The player opens the stockroom (or the mini-boss crates) and presses Esc. The pause overlay (`z-index: auto`, earlier in DOM order) paints under the gold stockroom panel (`z-index: 40`, `top: 96px`), which covers the top of the pause panel and stays clickable. Pressing 1-3, or clicking a card, takes the item while paused (`takeStockroomItem` + `store.changed()`). The follow-up `delayedCall`s then fire on resume.
- **Label:** confirmed (CSS stacking and listener traced; not reproduced visually).
- **Fix:** Hide the overlay (or set `pointer-events: none` and lower it) while `flow.paused`, and return early in `onKey` when `flow.paused`.

### 6. Starting a pointer drag while the gamepad holds an item leaves an orphan ghost on screen
- `src/ui/shop.ts:661-683`
```ts
function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0 || store.state.phase !== 'shop' || ...) return;   // no `drag` check
  ...
  beginDrag(found.inst, rot, ...);                                        // overwrites `drag`
}
function beginDrag(...) { drag = { ..., ghost: null, ... }; }
```
- **Failure scenario:** In the shop, the player presses A on a cart item with the pad. `shopPad.confirm` calls `startGhost`, which appends `drag.ghost` to `<body>`. The player then left-clicks another item with the mouse. `onPointerDown` replaces `drag` without removing the old ghost. On pointerup, `endDrag` removes the shared `hint` but only the new (null) ghost. The first item's ghost (`position: fixed; z-index: 50`) stays on screen for the rest of the session, and the original item keeps the `.lifted` class until the next render. The same leak happens if a pointerup is lost (alt-tab while holding the mouse) and the player then presses on an item.
- **Label:** confirmed (code trace).
- **Fix:** Start `beginDrag` with `if (drag) cancelDrag();`, or have `onPointerDown` call `endDrag()` on any existing drag.

### 7. A key swap can hand Escape to `loadout` or `rotate`, and that action then goes dead; Escape itself can never be rebound
- `src/state/keymap.ts:85-94` (the displaced action gets this slot's old key), `src/ui/ui.ts:844-848`, `src/ui/shop.ts:87-89` and `src/ui/ui.ts:341`
```ts
// ui.ts onKey: the Escape branch runs before the loadout branch
} else if (e.key === 'Escape') {
  e.preventDefault();
} else if (matches(settings.keys, 'loadout', e.code)) {
// shop.ts shopKey: drag + Escape cancels before rotate is checked
if (drag && e.key === 'Escape') { cancelDrag(); return true; }
if (drag && matches(settings.keys, 'rotate', e.code)) { rotateHeld(); return true; }
```
- **Failure scenario:** In Controls, the player binds pause slot 1 to Tab. `rebind` swaps, so loadout becomes `['Escape', '']`, and the swap note names the cart-view action. From then on Escape in combat hits the bare `else if (e.key === 'Escape')` branch, and the cart view cannot be opened from the keyboard. Pad Y still works. If pause is bound to R instead, rotate becomes Escape, and `shopKey` cancels the drag before it checks rotate, so held items cannot be rotated from the keyboard. Separately, `listenKey` treats Escape as "cancel", so the player can never bind Escape back. Only "Reset controls" restores it, and that wipes every other custom binding.
- **Label:** confirmed (traced `rebind` swap → `onKey`/`shopKey` branch order).
- **Fix:** In `rebind`, never move `Escape` onto any action except `pause`: clear the slot instead of swapping. Let `listenKey` accept Escape when the action being bound is `pause`.

## Low

### 8. Pad Start resumes while a keybind is listening, so the next combat key silently rebinds an action
- `src/ui/ui.ts:890` (`pause: togglePause`) and `:814`
- **Failure scenario:** The player pauses, clicks a key-binding button (`listening` is set), then presses Start on the pad. `togglePause()` resumes without clearing `listening`. The next key pressed in combat, for example W, goes through `listenKey` and gets bound to that action. Pad B (`padBack`) and mouse clicks clear `listening`, but Start does not.
- **Label:** confirmed (code trace).
- **Fix:** Call `stopListening()` in `togglePause` and `toggleLoadout`, or in `flow` on the 'pause' event.

### 9. HUD caches ignore settings changes: active-slot key labels and the Punch Card text go stale
- `src/ui/hud.ts:111-115` (the cache key `act` covers slot, type and charges, not `settings.keys`) and `src/ui/punchcard.ts:28-30` (the cache key leaves out the language; `relabelHud` resets `hud.last` but not the punch card's `last`)
- **Failure scenario:** The player rebinds `useActive1` from the pause menu mid-aisle: the HUD chip keeps showing Q until a charge changes. The player switches language from the pause menu: the Punch Card keeps the old language until its progress changes.
- **Label:** confirmed (code trace).
- **Fix:** Add the binding label and the language to the respective cache keys, or reset both caches on settings change.

### 10. The desktop fullscreen setting drifts from the real window state
- `src/ui/ui.ts:819-823` and `electron/main.cjs:36-37` (`is-fullscreen` is bridged but never called; no `leave-full-screen` / `enter-full-screen` listener)
- **Failure scenario:** On macOS, the player leaves fullscreen with the green button. `settings.fullscreen` stays `true`, the Settings checkbox still shows on, and the first F11 press "turns it off" (a no-op), so it takes two presses to go fullscreen again.
- **Label:** plausible (macOS path inferred; no listener exists).
- **Fix:** Send `enter/leave-full-screen` events to the page, or sync with `desktop.isFullscreen()` when Settings opens and before F11 toggles.

### 11. A daily run that crosses midnight is booked on the new day's board
- `src/state/profile.ts:212-216`
```ts
if (profile.daily.date !== todayKey()) profile.daily = { date: todayKey(), best: 0, tries: 1 };
```
- **Failure scenario:** The player starts the daily at 23:50, so it uses yesterday's `dailySeed()`, and finishes at 00:10. The score becomes today's best with `tries: 1`, although today's seed was never played.
- **Label:** confirmed (code trace).
- **Fix:** Store the daily key on the run at `startRun` (`s.dailyKey = todayKey()`) and only fold the result in when it matches `todayKey()`.

### 12. Test Lab: the lab modal stays inside the hidden title screen and swallows the first Escape (LAB builds only)
- `src/ui/ui.ts:617-623` (the `lab-open` and `sim-start` handlers do not close the modal) and `:831`
- **Failure scenario:** The player opens Test Lab from the title and clicks "Open". The phase becomes 'shop', the title screen hides, but `.settings-modal` is still in its DOM. Later, in combat, the first Esc goes to `closeTitleSettings()`, which removes the hidden modal and returns `true`, so the game does not pause.
- **Label:** confirmed (code trace).
- **Fix:** Call `closeTitleSettings()` before `flow.startLab` and `launchSim`, or make `closeTitleSettings` a no-op while the title is hidden.

### 13. Persisted data is trusted without validation (latent crash paths)
- `src/state/settings.ts:45-47`: a stored `language` that is not in `LANGS` makes `t()` read `UI[lang()][key]` on `undefined` and throw at the first render.
- `src/ui/ui.ts:657-661` (`historyHtml`): `itemT(i)` and `starterT(h.starter)` dereference content by id (`contentItem(id)!`). If an item or starter id is ever renamed or removed, a profile holding the old id throws when History opens. No id has been deleted since the history feature landed (checked `git diff --diff-filter=D` on `src/content`), so this is latent.
- `src/state/profile.ts:53-63`: `load()` keeps `recipes` and `unlocked` as stored, with no array or id check, and `Profile.v` is `1` with no migration hook.
- **Label:** plausible (needs corrupted storage or a future id change).
- **Fix:** Check `language` against `LANGS` at load. Filter history items, recipes and unlocks against the current id tables in `load()`.

### 14. The tutorial bubble and its Skip button sit above the pause menu
- `src/ui/style.css:697` (`#tutorial { z-index: 5 }`); `tutorial.ts:91-104` keeps rendering while `flow.paused` (it only stops counting time)
- **Failure scenario:** On the first run, the player pauses during a combat tutorial step. The bubble stays drawn on top of the dimmed pause overlay, anchored under the HUD.
- **Label:** plausible (CSS stacking inferred, not screenshotted).
- **Fix:** Hide `#tutorial` while `flow.paused`.

### 15. Overtime aisles never reach lifetime kills and coins, which several unlocks depend on
- `src/flow.ts:238-247` and `src/state/profile.ts:142-145`
```ts
if (s.overtime) { // the run was already counted at victory
  const past = Math.max(0, s.wave - BOSS_WAVE - 1);
  recordOvertime(past);                 // only bestOvertime
  const { daily } = recordFinish(s, won, score);
```
- **Failure scenario:** `recordRun` adds `s.stats.kills` and `s.stats.coinsEarned` to `profile.stats` once, at victory. Overtime keeps adding to the same `s.stats`, but the overtime branch of `finish` only writes `bestOvertime`. Kills and coins earned in overtime aisles never count toward the lifetime unlocks (`unlocks.ts:54,59,65,67,77,84,86,89,93,97,99`: spray, leafblower, energy, scoby, tipjar, pricegun, barter, …). They do count toward the Catalog's per-enemy kills (`noteEnemy`), so the two totals disagree. No unlock checks `bestOvertime`, so the missing `evaluateUnlocks()` call has no effect today.
- **Label:** confirmed (code trace).
- **Fix:** Take a snapshot of `s.stats.kills` and `coinsEarned` at victory, add the difference in the overtime branch, then call `evaluateUnlocks()` and merge its result into `fresh.unlocks`.

---

## Out of scope leads
- Restarting from the pause menu, or quitting to title, never records the abandoned run as a loss. Stats, history and loyalty stamps skip it, and enemy kill counts from the abandoned run still persist into the Catalog with the next `saveProfile()` (`profile.ts:101-104`). This is a design question for the mechanics agent.
- Electron has no `app.requestSingleInstanceLock()` (`electron/main.cjs`). Two instances share localStorage, and the last one to `saveProfile()` overwrites the other's progress.
- `flow.finish` uses `play('defeat')` in the overtime branch even when `won` is true (`flow.ts:243`). Overtime cannot currently end in victory (`rollDoors` never deals a boss door in overtime), so this only matters if that changes.

## Throwaway files
- `tests/_audit/ui-i18n.test.ts`: created, run, deleted. Output had 0 mismatches over 519 call sites.
