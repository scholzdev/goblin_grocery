import { tuneValue, type Lang, type Localized, type Tune } from './define';

// Text rendering for content files. Numbers in rules/detail text come from `tune`, never from the string.
//
// Placeholders: `{key}` or `{key|fmt}`, `key` = a tune key. Per-tier arrays are read at the tier being rendered.
//
// Formatters (`fmt`), shown for 0.375 / 2.5 / 1.5:
//   n     plain, up to 2 decimals (German decimal comma)   0.38 / 2.5 / 1.5      (default)
//   int   rounded                                          0 / 3 / 2
//   pct   x100, rounded, with %                            38% / 250% / 150%
//   pct1  x100, up to 1 decimal, with %                    37.5% / 250% / 150%
//   s     seconds                                          0.38 s / 2.5 s / 1.5 s
//   ps    per second                                       0.38/s / 2.5/s / 1.5/s
//   x     multiplier suffix                                0.38× / 2.5× / 1.5×
//   deg   degrees, rounded                                0° / 3° / 2°
//   pctn     percent number only, no % (the author writes "%" or German " %")        38 / 250 / 150
//   pctup    percent above 1: round((v - 1) x 100), number only  (a 1.15 multiplier)  1.15 -> 15
//   pctdown  percent below 1: round((1 - v) x 100), number only  (a 0.92 multiplier)  0.92 -> 8
// The number-only percent formatters exist for set text, where German writes "10 %" with a space and multipliers are stored as
// 1.1 / 0.92 for the code.
// A leading `+` or `−` (U+2212) on the formatter prepends that literal sign: `+pct` -> "+38%", `−s` -> "−1.5 s". Signs are never
// derived from the value (a negative number prints its own "-"), so the author decides: write `{damage|+pct}` for "+25%", or put
// the sign in the sentence ("gain +{damage|pct}") when the rows do not need to match. The same formatters drive the scaling rows
// of the shop, so one placeholder renders exactly like its row.

const TOKEN = /\{(\w+)(?:\|([^{}|]*))?\}/g;
const FMT = /^([+−]?)(n|int|pct|pct1|pctn|pctup|pctdown|s|ps|x|deg)$/;

export interface Placeholder { key: string; fmt: string }

/** Every `{key|fmt}` in a template, in order (fmt defaults to `n`). */
export function placeholders(template: string): Placeholder[] {
  return [...template.matchAll(TOKEN)].map((m) => ({ key: m[1], fmt: m[2] ?? 'n' }));
}

export const isFormatter = (fmt: string): boolean => FMT.test(fmt);

const dec = (x: number, digits: number, lang: Lang): string => {
  const s = String(+x.toFixed(digits));
  return lang === 'de' ? s.replace('.', ',') : s;
};

/** One number through one formatter. */
export function formatValue(value: number, fmt: string, lang: Lang): string {
  const m = FMT.exec(fmt);
  if (!m) throw new Error(`text: unknown formatter "${fmt}"`);
  const [, sign, name] = m;
  let body: string;
  switch (name) {
    case 'n': body = dec(value, 2, lang); break;
    case 'int': body = String(Math.round(value)); break;
    case 'pct': body = `${Math.round(value * 100)}%`; break;
    case 'pctn': body = String(Math.round(value * 100)); break;
    case 'pctup': body = String(Math.round((value - 1) * 100)); break;
    case 'pctdown': body = String(Math.round((1 - value) * 100)); break;
    case 'pct1': body = `${dec(value * 100, 1, lang)}%`; break;
    case 's': body = `${dec(value, 2, lang)} s`; break;
    case 'ps': body = `${dec(value, 2, lang)}/s`; break;
    case 'x': body = `${dec(value, 2, lang)}×`; break;
    default: body = `${Math.round(value)}°`; // deg
  }
  return sign + body;
}

/** Fills a template from `tune` at `tier` (tier only matters for per-tier arrays). Throws on an unknown key or formatter. */
export function renderText(template: string, tune: Tune | undefined, tier: number, lang: Lang): string {
  return template.replace(TOKEN, (_, key: string, fmt: string | undefined) => {
    const v = tune?.[key];
    if (v === undefined) throw new Error(`text: no tune key "${key}" for placeholder in "${template}"`);
    return formatValue(tuneValue(v, tier), fmt ?? 'n', lang);
  });
}

// ---- tier rows ---------------------------------------------------------------------------------------------------------

export type ScaleRow = { label: string; values: string[] };
interface RowSource { tune?: Tune; rows?: readonly { label: Localized<string>; key: string; fmt?: string }[] }

/** The row specs of a content file: its `rows`, or one plain row per array-valued tune key. */
export function rowSpecs(content: RowSource): { label: Localized<string>; key: string; fmt: string }[] {
  if (content.rows) return content.rows.map((r) => ({ label: r.label, key: r.key as string, fmt: r.fmt ?? 'n' }));
  return Object.entries(content.tune ?? {}).filter(([, v]) => typeof v !== 'number').map(([key]) => ({ label: { en: key, de: key }, key, fmt: 'n' }));
}

/** The shop's per-level scaling table (★1/★2/★3), the replacement for `tierScaling`'s hand-written rows. */
export function tierRows(content: RowSource, lang: Lang): ScaleRow[] {
  return rowSpecs(content).map((r) => ({
    label: r.label[lang],
    values: [1, 2, 3].map((tier) => {
      const v = content.tune?.[r.key];
      if (v === undefined) throw new Error(`text: row "${r.label.en}" has no tune key "${r.key}"`);
      return formatValue(tuneValue(v, tier), r.fmt, lang);
    }),
  }));
}

/**
 * The legacy item rules template: `{0}`, `{1}`, ... index the scaling rows (what `itemRules` fills in). Each placeholder that
 * matches a row (same key and formatter) becomes that row's index; a placeholder on a scalar becomes its literal ★1 text (legacy
 * rules hard-coded those). A per-tier placeholder without a row cannot be expressed in the legacy form and throws.
 * Only used to keep `ITEMS[id].rules` / `DATA_DE.items[id].rules` identical while old code still reads them.
 */
export function legacyRules(template: string, content: RowSource, lang: Lang): string {
  const rows = rowSpecs(content);
  return template.replace(TOKEN, (_, key: string, fmt: string | undefined) => {
    const f = fmt ?? 'n';
    const i = rows.findIndex((r) => r.key === key && r.fmt === f);
    if (i >= 0) return `{${i}}`;
    const v = content.tune?.[key];
    if (typeof v === 'number') return formatValue(v, f, lang);
    throw new Error(`text: per-tier placeholder {${key}|${f}} in "${template}" has no matching row (add a rows entry with key "${key}" and fmt "${f}"; legacy code reads rules as {0}, {1}, ...)`);
  });
}

/** A combo's text with every placeholder filled (combos have scalar tune: tier is irrelevant). */
export const renderAll = <S extends object>(text: S, tune: Tune | undefined, lang: Lang): S => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(text) as [string, string][]) out[k] = renderText(v, tune, 1, lang);
  return out as S;
};
