import { t, type UIKey } from '../i18n';
import { deptT, itemT, shiftT, starterT } from '../i18n/data';
import { PLAYER, STARTER_WEAPONS } from '../data/items';
import { THEMES } from '../data/departments';
import { MODIFIERS, type ModifierId } from '../data/modifiers';
import { SET_EVENTS, type SetEventKind } from '../data/events';
import { LAB_EVENTS } from '../state/lab';
import { BOSS_WAVE, ECONOMY, SHIFTS, SHOP_LEVELS } from '../data/waves';
import type { DepartmentId, LabOpts, StarterId, StarterWeapon } from '../types';

// The Test Lab setup as a table: one row per `LabOpts` field. The title form and the bench's Setup tab are both drawn from it,
// and a changed control is turned back into a `Partial<LabOpts>` by the same row, so a field exists in exactly one place.

export type LabKey = 'aisle' | 'dept' | 'mod' | 'event' | 'sandbox' | 'starter' | 'weapon' | 'shift' | 'god' | 'cart' | 'shelf' | 'shopLevel' | 'money';

/** Where a field can change: `title` = only before the run exists, `shop` = in the cart editor, `any` = also between arena restarts. */
type Editable = 'title' | 'shop' | 'any';

type Option = [value: string, label: string];

interface LabField {
  key: LabKey;
  label: UIKey;
  editable: Editable;
  kind: 'select' | 'number' | 'toggle';
  options?: (o: LabOpts) => Option[];
  /** Raw control value -> the setup fields it sets. */
  parse: (raw: string | boolean) => Partial<LabOpts>;
}

const STARTERS = Object.keys(PLAYER.starters) as StarterId[];
const WEAPONS = Object.keys(STARTER_WEAPONS) as StarterWeapon[];
const EVENTS = LAB_EVENTS;
const evLabel = (v: (typeof EVENTS)[number]): string => (v in SET_EVENTS ? t(`evName_${v as SetEventKind}`) : t(({ random: 'evRandom', none: 'evNone', wetFloor: 'evWet', outage: 'evOutage' } as const)[v as 'random']));
const cartSizes = (): [number, number][] => [[4, 4], ...ECONOMY.cartSizes];
const num = (raw: string | boolean): number => Number(raw);

export const LAB_FIELDS: Record<LabKey, LabField> = {
  aisle: { key: 'aisle', label: 'labAisle', editable: 'any', kind: 'select',
    options: () => Array.from({ length: 15 }, (_, i): Option => [String(i + 1), i + 1 === BOSS_WAVE ? `${i + 1} (${t('labBoss')})` : i + 1 > BOSS_WAVE ? `${i + 1} (${t('labOvertime')})` : String(i + 1)]),
    parse: (r) => ({ aisle: num(r) }) },
  dept: { key: 'dept', label: 'labDept', editable: 'any', kind: 'select',
    options: () => THEMES.map((d): Option => [d, deptT(d).name]),
    parse: (r) => ({ dept: r as DepartmentId }) },
  mod: { key: 'mod', label: 'labMod', editable: 'any', kind: 'select',
    options: () => (Object.keys(MODIFIERS) as ModifierId[]).map((m): Option => [m, t(`modName_${m}` as UIKey)]),
    parse: (r) => ({ mod: r as ModifierId }) },
  event: { key: 'event', label: 'labEvent', editable: 'any', kind: 'select',
    options: () => EVENTS.map((v): Option => [v, evLabel(v)]),
    parse: (r) => ({ event: r as LabOpts['event'] }) },
  sandbox: { key: 'sandbox', label: 'labMode', editable: 'shop', kind: 'select',
    options: () => [['dummies', t('labModeDummies')], ['aisle', t('labModeAisle')]],
    parse: (r) => ({ sandbox: r === 'dummies' }) },
  starter: { key: 'starter', label: 'labStarter', editable: 'any', kind: 'select',
    options: () => STARTERS.map((s): Option => [s, starterT(s).name]),
    parse: (r) => ({ starter: r as StarterId }) },
  weapon: { key: 'weapon', label: 'labWeapon', editable: 'title', kind: 'select',
    options: () => WEAPONS.map((w): Option => [w, itemT(w).name]),
    parse: (r) => ({ weapon: r as StarterWeapon }) },
  shift: { key: 'shift', label: 'labShift', editable: 'any', kind: 'select',
    options: () => SHIFTS.map((_, i): Option => [String(i), `${i + 1}: ${shiftT(i).name}`]),
    parse: (r) => ({ shift: num(r) }) },
  god: { key: 'god', label: 'labGod', editable: 'any', kind: 'toggle',
    parse: (r) => ({ god: r === true }) },
  cart: { key: 'cart', label: 'labCart', editable: 'shop', kind: 'select',
    options: () => cartSizes().map(([c, r]): Option => [`${c}x${r}`, `${c}x${r}`]),
    parse: (r) => ({ cart: String(r).split('x').map(Number) as [number, number] }) },
  shelf: { key: 'shelf', label: 'labShelf', editable: 'shop', kind: 'select',
    options: () => [ECONOMY.shelfSlots, ...ECONOMY.shelfSizes].map((n): Option => [String(n), String(n)]),
    parse: (r) => ({ shelf: num(r) }) },
  shopLevel: { key: 'shopLevel', label: 'labLoyalty', editable: 'shop', kind: 'select',
    options: () => SHOP_LEVELS.map((_, i): Option => [String(i + 1), String(i + 1)]),
    parse: (r) => ({ shopLevel: num(r) }) },
  money: { key: 'money', label: 'labMoney', editable: 'title', kind: 'number',
    parse: (r) => ({ money: Math.max(0, Math.floor(Number(r)) || 0) }) },
};

/** The sections of the form, in order. */
export const LAB_GROUPS: { title: UIKey; keys: LabKey[] }[] = [
  { title: 'labGroupAisle', keys: ['aisle', 'dept', 'mod', 'event'] },
  { title: 'labGroupHero', keys: ['starter', 'weapon', 'shift', 'god'] },
  { title: 'labGroupCart', keys: ['sandbox', 'cart', 'shelf', 'shopLevel', 'money'] },
];

/** The control value a setup holds for `key` (the option value, not its label). */
export function labValue(o: LabOpts, key: LabKey): string | boolean {
  switch (key) {
    case 'cart': return o.cart.join('x');
    case 'sandbox': return o.sandbox ? 'dummies' : 'aisle';
    case 'god': return o.god;
    case 'event': return o.event ?? 'random';
    case 'mod': return o.mod ?? 'none';
    case 'dept': return THEMES.includes(o.dept) ? o.dept : 'main';
    default: return String(o[key]);
  }
}

/** Where the form is shown: the title menu (nothing exists yet), the cart editor, or the arena (a change restarts the fight). */
export type LabPlace = 'title' | 'shop' | 'arena';

/** Whether the field can change at `at`. */
export function labFieldOpen(key: LabKey, at: LabPlace): boolean {
  const e = LAB_FIELDS[key].editable;
  return e === 'any' || (e === 'shop' && at !== 'arena') || (e === 'title' && at === 'title');
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** One labelled control (nothing for a field that cannot change here, so the form only shows what the bench can do). */
export function labFieldHtml(o: LabOpts, key: LabKey, at: LabPlace): string {
  const f = LAB_FIELDS[key], v = labValue(o, key);
  if (!labFieldOpen(key, at)) return '';
  if (f.kind === 'toggle') return `<label class="check"><input type="checkbox" data-lab="${key}" ${v ? 'checked' : ''}>${t(f.label)}</label>`;
  if (f.kind === 'number') return `<label>${t(f.label)}<input type="number" data-lab="${key}" value="${esc(String(v))}" min="0" step="100"></label>`;
  const opts = f.options!(o).map(([val, label]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${label}</option>`).join('');
  return `<label>${t(f.label)}<select data-lab="${key}">${opts}</select></label>`;
}

/** The sections of the form for `o`. */
export function labFormHtml(o: LabOpts, at: LabPlace): string {
  return LAB_GROUPS.map((g) => ({ g, rows: g.keys.map((k) => labFieldHtml(o, k, at)).join('') }))
    .filter(({ rows }) => rows)
    .map(({ g, rows }) => `<div class="lab-group"><h4>${t(g.title)}</h4>${rows}</div>`).join('');
}

/** The setup fields a changed control sets. */
export function readLabControl(el: HTMLInputElement | HTMLSelectElement): Partial<LabOpts> {
  const key = el.dataset.lab as LabKey;
  return LAB_FIELDS[key].parse(el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value);
}

/** The whole setup the controls under `root` show (the title form). */
export function readLabForm(root: ParentNode, base: LabOpts): LabOpts {
  const out = { ...base };
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-lab]').forEach((el) => { if (el.dataset.lab !== 'sim') Object.assign(out, readLabControl(el)); });
  return out;
}
