// Current UI language. Settings persist the choice (see src/state/settings.ts); until loaded, follow the system.
export type Lang = 'en' | 'de';
export const LANGS: Lang[] = ['en', 'de'];

const detect = (): Lang => {
  try {
    return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'en';
  }
};

let current: Lang = detect();
export const lang = (): Lang => current;
export const setLang = (l: Lang): void => { current = l; };
export const systemLang = detect;
