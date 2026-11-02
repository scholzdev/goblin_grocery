// Current UI language. Settings persist the choice (see src/state/settings.ts); until loaded, follow the system.
export type Lang = 'en' | 'de' | 'zh';
export const LANGS: Lang[] = ['en', 'de', 'zh'];

const detect = (): Lang => {
  try {
    const system = navigator.language.toLowerCase();
    if (system.startsWith('de')) return 'de';
    if (system.startsWith('zh')) return 'zh';
    return 'en';
  } catch {
    return 'en';
  }
};

let current: Lang = detect();
export const lang = (): Lang => current;
export const setLang = (l: Lang): void => { current = l; };
export const systemLang = detect;
/** Content records currently exist in English and German; other UI locales use English content. */
export const contentLang = (): 'en' | 'de' => current === 'de' ? 'de' : 'en';
