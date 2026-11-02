import { UI } from './ui';
import { lang } from './lang';
export { contentLang, lang, setLang, systemLang, LANGS, type Lang } from './lang';

export type UIKey = keyof typeof UI.en;

/** Looks up a UI string for the current language and fills `{var}` placeholders. */
export function t(key: UIKey, vars?: Record<string, string | number>): string {
  const s = UI[lang()][key] ?? UI.en[key];
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : s;
}

/** Display number: German uses a decimal comma ("0,9 s"). */
export const fmtNum = (n: number | string): string => (lang() === 'de' ? String(n).replace('.', ',') : String(n));
