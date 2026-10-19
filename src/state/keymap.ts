// Rebindable keyboard controls: pure helpers (no DOM, no settings import) so the rules are unit-testable.
// Bindings are KeyboardEvent.code values ('KeyW', 'Space'), two slots per action; '' means unbound.

export type KeyAction = 'up' | 'down' | 'left' | 'right' | 'shove' | 'loadout' | 'rotate' | 'pause' | 'useActive1' | 'useActive2' | 'useActive3';
export const KEY_ACTIONS: KeyAction[] = ['up', 'down', 'left', 'right', 'shove', 'loadout', 'rotate', 'pause', 'useActive1', 'useActive2', 'useActive3'];
/** Active-item key actions in slot order. */
export const ACTIVE_KEYS: KeyAction[] = ['useActive1', 'useActive2', 'useActive3'];
export const KEY_SLOTS = 2;
export type KeyMap = Record<KeyAction, string[]>;

export const DEFAULT_KEYS: KeyMap = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  shove: ['Space', ''],
  loadout: ['Tab', ''],
  rotate: ['KeyR', ''],
  pause: ['Escape', ''],
  useActive1: ['KeyQ', ''],
  useActive2: ['KeyE', ''],
  useActive3: ['KeyF', ''],
};

/** Last resort when a custom binding took every default key of an action. */
const SPARE_KEYS = ['KeyQ', 'KeyE', 'KeyF', 'KeyG', 'KeyZ', 'KeyX', 'KeyC', 'KeyV'];

export const cloneKeys = (k: KeyMap): KeyMap => Object.fromEntries(KEY_ACTIONS.map((a) => [a, [...k[a]]])) as KeyMap;
export const defaultKeys = (): KeyMap => cloneKeys(DEFAULT_KEYS);

/** Keys with a fixed job elsewhere (picking doors/starters, confirm, fullscreen, dev shortcuts) or used to edit bindings. */
export function isReserved(code: string): boolean {
  return /^(Digit|Numpad)[1-4]$/.test(code) || /^F\d{1,2}$/.test(code) || code === 'Enter' || code === 'NumpadEnter' || code === 'Backspace' || code === 'Delete';
}

/** Repairs whatever was stored: missing actions fall back to defaults, junk is dropped, a code is only kept for its first action/slot. */
export function sanitizeKeys(raw: unknown): KeyMap {
  const src = { ...(raw && typeof raw === 'object' ? raw : {}) } as Partial<Record<KeyAction, unknown>> & { useActive?: unknown };
  // Old saves had one `useActive` key for every active; a custom binding becomes slot 1 (the default E was slot-less, E now belongs to slot 2).
  const legacy = src.useActive;
  if (Array.isArray(legacy) && !src.useActive1 && legacy.some((c) => c && c !== 'KeyE')) src.useActive1 = legacy;
  const out = defaultKeys();
  const seen = new Set<string>();
  for (const a of KEY_ACTIONS) {
    const v = src[a];
    const slots = Array.isArray(v) ? v : out[a];
    out[a] = Array.from({ length: KEY_SLOTS }, (_, i) => {
      const c = slots[i];
      if (typeof c !== 'string' || !c || isReserved(c) || seen.has(c)) return '';
      seen.add(c);
      return c;
    });
    if (!out[a].some(Boolean)) {
      out[a] = [...DEFAULT_KEYS[a]].map((c) => (seen.has(c) ? '' : c));
      if (!out[a].some(Boolean)) out[a] = [SPARE_KEYS.find((c) => !seen.has(c)) ?? '', ''];
    }
    for (const c of out[a]) if (c) seen.add(c);
  }
  return out;
}

export const matches = (keys: KeyMap, action: KeyAction, code: string): boolean => !!code && keys[action].includes(code);

export function actionFor(keys: KeyMap, code: string): KeyAction | null {
  return KEY_ACTIONS.find((a) => matches(keys, a, code)) ?? null;
}

export interface RebindResult {
  keys: KeyMap;
  ok: boolean;
  /** Action that lost or swapped its key because `code` was already bound to it. */
  displaced?: KeyAction;
  reason?: 'reserved' | 'last';
}

/**
 * Binds `code` to a slot. A code is bound once: if another slot already holds it, the two slots swap
 * (the displaced action gets this slot's old key, or loses the key when this slot was empty).
 * Refuses reserved keys and anything that would leave an action without any key.
 */
export function rebind(keys: KeyMap, action: KeyAction, slot: number, code: string): RebindResult {
  if (isReserved(code) || !code) return { keys, ok: false, reason: 'reserved' };
  if (keys[action][slot] === code) return { keys, ok: true };
  const next = cloneKeys(keys);
  const old = next[action][slot];
  let displaced: KeyAction | undefined;
  for (const a of KEY_ACTIONS) {
    const i = next[a].indexOf(code);
    if (i < 0) continue;
    next[a][i] = old;
    displaced = a === action ? undefined : a;
    break;
  }
  next[action][slot] = code;
  if (KEY_ACTIONS.some((a) => !next[a].some(Boolean))) return { keys, ok: false, reason: 'last' };
  return { keys: next, ok: true, displaced };
}

/** Empties a slot, unless it is the action's only key. */
export function clearSlot(keys: KeyMap, action: KeyAction, slot: number): RebindResult {
  if (keys[action].filter(Boolean).length <= 1 && keys[action][slot]) return { keys, ok: false, reason: 'last' };
  const next = cloneKeys(keys);
  next[action][slot] = '';
  return { keys: next, ok: true };
}

/** Short on-screen name of a key code ('KeyW' → 'W', 'ArrowUp' → '↑'). `space` lets the caller localise the space bar. */
export function keyLabel(code: string, space = 'SPACE'): string {
  if (!code) return '—';
  const arrows: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (arrows[code]) return arrows[code];
  if (code === 'Space') return space;
  if (code === 'Escape') return 'ESC';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return `NUM ${code.slice(6).toUpperCase()}`;
  const m = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
  if (m) return `${m[2] === 'Left' ? 'L' : 'R'}-${m[1].toUpperCase()}`;
  return code.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
}

/** All keys of an action as a label, e.g. 'W / ↑'. */
export const bindingLabel = (keys: KeyMap, action: KeyAction, space?: string): string =>
  keys[action].filter(Boolean).map((c) => keyLabel(c, space)).join(' / ') || '—';
