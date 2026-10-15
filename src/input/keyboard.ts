// Live keyboard state for combat, resolved through the rebindable key map (src/state/keymap.ts).
import { settings } from '../state/settings';
import { actionFor, type KeyAction } from '../state/keymap';

const held = new Set<string>();
const pressed = new Set<KeyAction>();
let combatActive: () => boolean = () => false;

/** `active` says whether keys currently drive the game (combat and not paused); otherwise keys keep their browser meaning. */
export function initKeyboard(active: () => boolean): void {
  combatActive = active;
  window.addEventListener('keydown', (e) => {
    held.add(e.code);
    const a = actionFor(settings.keys, e.code);
    if (!a || !combatActive()) return;
    if (a !== 'pause') e.preventDefault(); // arrows/space must not scroll or press a focused button mid-fight
    if (!e.repeat) pressed.add(a);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', resetKeyboard);
}

export const isDown = (a: KeyAction): boolean => settings.keys[a].some((c) => !!c && held.has(c));

/** True once per key press (edge), consumed by the caller. */
export function takePressed(a: KeyAction): boolean {
  return pressed.delete(a);
}

/** Forget held keys and pending presses (scene resume, window blur). */
export function resetKeyboard(): void {
  held.clear();
  pressed.clear();
}
