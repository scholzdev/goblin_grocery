import { describe, expect, it } from 'vitest';
import { AFFINITY_TAGS, BUFF_ORDER, ENEMY_ORDER, ITEM_ORDER, RECIPE_ORDER, SET_ORDER } from '../../src/engine/define';
import { Buff, Combo, Enemy, Item, Set as SetIds, Tag, idEnum } from '../../src/engine/ids';

// The ids lint (docs/item-hooks-refactor.md, "Ids"): content and sims write ids through the typed constants of src/engine/ids.ts
// (`Item.pan`, `Enemy.milk`, `Tag.heat` ...), never as bare strings, so a typo is a compile error and the ids can be found and renamed.
//
// Heuristic: a bare id is a string literal whose WHOLE content equals a known item / combo / enemy / set / buff / tag id ('mop', "frost").
//   - Prose cannot match: a text, a name or a comment that merely contains the word is never a whole-literal match, and comment lines
//     and trailing `// comments` are skipped altogether. Template literals are skipped.
//   - A literal that is the VALUE of a key which holds something else that happens to share the word is allowed (NOT_ID_KEYS: the weapon
//     `pattern: 'laser'`, the enemy `behavior: 'boss'`, the starter `character: 'toaster'`, the `department` / `theme` 'checkout', a tune
//     row `key: 'electric'`), and so is the audio name in `sound('frost')`.
//   - A sim's own top-level `id: '<file name>'` is not an item or an enemy id even when a sim is called `boss` or `blast`.
//   - `// ids-ok` on the line is the escape hatch for anything else (say why).
// Scanned: src/content/** and src/sims/**. Object keys (`weak: { heat: 0.3 }`, `mix: { milk: 1 }`) are typed by their Record and not literals.

const KNOWN = new Set<string>([...ITEM_ORDER, ...RECIPE_ORDER, ...ENEMY_ORDER, ...SET_ORDER, ...BUFF_ORDER, ...AFFINITY_TAGS]);
const NOT_ID_KEYS = new Set(['pattern', 'behavior', 'theme', 'department', 'character', 'key', 'kind', 'special', 'shot', 'label', 'name', 'blurb', 'summary', 'detail', 'rules']);

export interface BareId { line: number; id: string; text: string }

/** The bare ids in one file's source. `fileId` = the file name without `.ts` (a sim's own id may equal it). */
export function findBareIds(source: string, fileId = ''): BareId[] {
  const hits: BareId[] = [];
  source.split('\n').forEach((raw, i) => {
    if (/^\s*(\/\/|\/\*|\*)/.test(raw) || /\bids-ok\b/.test(raw)) return;
    let code = raw;
    for (let k = 0, q: string | null = null; k < raw.length; k++) { // cut a trailing `// comment` (outside strings, not `://`)
      const ch = raw[k];
      if (q) { if (ch === '\\') k++; else if (ch === q) q = null; }
      else if (ch === "'" || ch === '"' || ch === '`') q = ch;
      else if (ch === '/' && raw[k + 1] === '/' && raw[k - 1] !== ':') { code = raw.slice(0, k); break; }
    }
    for (const m of code.matchAll(/(['"])([A-Za-z_]+)\1/g)) {
      const id = m[2];
      if (!KNOWN.has(id)) continue;
      const before = code.slice(0, m.index);
      const key = /\b(\w+):\s*$/.exec(before)?.[1];
      if (key && NOT_ID_KEYS.has(key)) continue;
      if (/\bsound\(\s*$/.test(before)) continue;
      if (key === 'id' && id === fileId && /^\s*id:\s*$/.test(before)) continue;
      hits.push({ line: i + 1, id, text: raw.trim() });
    }
  });
  return hits;
}

const FILES = {
  ...(import.meta.glob('../../src/content/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...(import.meta.glob('../../src/sims/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
};

describe('ids lint: content and sims use the typed id constants', () => {
  it('src/content/** and src/sims/** contain no bare item/combo/enemy/set/buff/tag id', () => {
    expect(Object.keys(FILES).length).toBeGreaterThan(150); // the glob found the files
    const hits = Object.entries(FILES).flatMap(([f, source]) =>
      findBareIds(source, f.replace(/^.*\/|\.ts$/g, '')).map((h) => `${f.replace('../../', '')}:${h.line}: bare id '${h.id}' (use the constant from engine/ids): ${h.text}`));
    expect(hits).toEqual([]);
  });

  it('catches a planted bare id, in lists, scalars and calls', () => {
    expect(findBareIds("  id: 'x', requires: ['mop', 'ice'],").map((h) => h.id)).toEqual(['mop', 'ice']);
    expect(findBareIds("const sugar = c.stateOf('sugarRush');")).toHaveLength(1);
    expect(findBareIds("  suppresses: [\"fan\"],\n  buff: 'fan',")).toEqual([
      { line: 1, id: 'fan', text: 'suppresses: ["fan"],' }, { line: 2, id: 'fan', text: "buff: 'fan'," },
    ]);
    expect(findBareIds("sets: ['kitchen', 'heat'], tags: ['blast']").map((h) => h.id)).toEqual(['kitchen', 'heat', 'blast']);
    expect(findBareIds("{ id: 'milk', count: 3 }").map((h) => h.id)).toEqual(['milk']);
  });

  it('lets prose, other keys, the sim own id and the escape hatch through', () => {
    expect(findBareIds("  pattern: 'laser', behavior: 'boss', character: 'toaster', theme: 'checkout',")).toEqual([]);
    expect(findBareIds("ctx.sound('frost', { rate: 1.3 });")).toEqual([]);
    expect(findBareIds("text: { en: 'Pan the fan and heat the ice', rules: 'mop' },")).toEqual([]);
    expect(findBareIds("// requires: ['mop']\n/* 'pan' */\n * 'ice'")).toEqual([]);
    expect(findBareIds("requires: [Item.mop], // was 'mop'")).toEqual([]);
    expect(findBareIds("  id: 'blast',", 'blast')).toEqual([]);
    expect(findBareIds("  id: 'blast',", 'other')).toHaveLength(1);
    expect(findBareIds("{ id: 'blast' } // ids-ok: a sim file")).toEqual([]);
  });
});

describe('ids constants', () => {
  const cases = { Item: [Item, ITEM_ORDER], Combo: [Combo, RECIPE_ORDER], Enemy: [Enemy, ENEMY_ORDER], Set: [SetIds, SET_ORDER], Buff: [Buff, BUFF_ORDER], Tag: [Tag, AFFINITY_TAGS] } as const;
  for (const [name, [enumObj, order]] of Object.entries(cases)) {
    it(`${name}: keys equal the order list, values equal keys, frozen`, () => {
      expect(Object.keys(enumObj).sort()).toEqual([...order].sort());
      for (const [k, v] of Object.entries(enumObj)) expect(v).toBe(k);
      expect(Object.isFrozen(enumObj)).toBe(true);
    });
  }

  it('idEnum maps every id to itself', () => {
    expect(idEnum(['a', 'b'] as const)).toEqual({ a: 'a', b: 'b' });
  });

  it('keeps the literal types (Item.pan is \'pan\')', () => {
    const pan: 'pan' = Item.pan;
    const heat: 'heat' = Tag.heat;
    expect([pan, heat]).toEqual(['pan', 'heat']);
  });
});
