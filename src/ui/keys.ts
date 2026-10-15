import { settings } from '../state/settings';
import { bindingLabel, keyLabel, type KeyAction } from '../state/keymap';
import { t } from '../i18n';

/** `<kbd>` chip(s) for an action's current keys, e.g. `<kbd>R</kbd>` or `<kbd>W / ↑</kbd>`. */
export const kbdHtml = (action: KeyAction): string => `<kbd>${bindingLabel(settings.keys, action, t('keySpace'))}</kbd>`;

/** Plain label of an action's current keys (no markup). */
export const keyText = (action: KeyAction): string => bindingLabel(settings.keys, action, t('keySpace'));

/** Movement keys as chips: "WASD / ↑←↓→" with the defaults, whatever the player bound otherwise. */
export function moveHtml(): string {
  const order: KeyAction[] = ['up', 'left', 'down', 'right'];
  const row = (slot: number): string => {
    const l = order.map((a) => keyLabel(settings.keys[a][slot], t('keySpace')));
    if (l.every((x) => x === '—')) return '';
    return `<kbd>${l.join(l.every((x) => x.length === 1) ? '' : ' ')}</kbd>`;
  };
  return [row(0), row(1)].filter(Boolean).join(' / ');
}

/** Values for the `{move}` / `{shove}` placeholders in tutorial and hint strings. */
export const keyVars = (): Record<string, string> => ({ move: moveHtml(), shove: kbdHtml('shove'), loadout: keyText('loadout'), pause: keyText('pause') });
