/**
 * Deterministic serializer for golden snapshots.
 * - Set -> sorted array, Map -> object with sorted keys
 * - object keys sorted, undefined/functions dropped
 * - numbers rounded to 6 decimals (-0 -> 0, NaN/Infinity -> string)
 * Array order is kept (it is meaningful: buffs, recipes, adjacency, ...).
 */
const round = (n: number): number | string => {
  if (Number.isNaN(n)) return 'NaN';
  if (!Number.isFinite(n)) return n > 0 ? 'Infinity' : '-Infinity';
  const r = Math.round(n * 1e6) / 1e6;
  return r === 0 ? 0 : r;
};

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function normalize(v: unknown): unknown {
  if (v === null) return null;
  switch (typeof v) {
    case 'number': return round(v);
    case 'string': case 'boolean': return v;
    case 'bigint': return `${v}n`;
    case 'undefined': case 'function': case 'symbol': return undefined;
  }
  if (Array.isArray(v)) return v.map((x) => normalize(x) ?? null);
  if (v instanceof Set) return [...v].map((x) => normalize(x) ?? null).sort((a, b) => cmp(JSON.stringify(a), JSON.stringify(b)));
  if (v instanceof Map) return normalize(Object.fromEntries([...v.entries()].map(([k, x]) => [String(k), x])));
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as object).sort(cmp)) {
    const x = normalize((v as Record<string, unknown>)[k]);
    if (x !== undefined) out[k] = x;
  }
  return out;
}

/** Stable pretty JSON (keys sorted at every level, trailing newline). */
export const stable = (v: unknown): string => JSON.stringify(normalize(v), null, 2) + '\n';
