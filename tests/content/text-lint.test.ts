import { describe, expect, it } from 'vitest';
import { contentCombos, contentEnemies, contentItems, contentSets } from '../../src/engine/registry';

// The bare-number lint: a number in a player-facing text that is not a `{key}` placeholder is a number that can drift from the tune. Every text
// of every item, combo, set and enemy (EN and DE) is scanned. `★2`/`★3` (tier names) are not numbers. What is left is listed below, each with the reason
// it is a fixed fact of the rule or a joke, not a tuned value.
type Texts = Record<string, string | readonly string[]>;
const ALLOWED: Record<string, string> = {
  'item:coupon.rules': 'one coin per drop: the unit of a coin drop, not a tuned amount',
  'item:pricegun.blurb': 'a joke ("50% OFF"), not the crit chance',
  'item:fortune.blurb': 'a joke (lucky numbers 2, 2, 2)',
  'combo:expressCheckout.detail': 'the cooldown is written "1.0 s" (the s formatter prints "1 s"); tune.icd is 1.0, pinned in expressCheckout.test.ts',
};

const bare = (s: string): string[] => s.replace(/\{[^{}]*\}/g, '').replace(/★\d/g, '').match(/\d+(?:[.,]\d+)?/g) ?? [];

function scan(kind: string, id: string, text: Record<'en' | 'de', Texts>): string[] {
  const hits: string[] = [];
  for (const lang of ['en', 'de'] as const) {
    for (const [field, v] of Object.entries(text[lang])) {
      if (field === 'name') continue;
      for (const s of typeof v === 'string' ? [v] : v) {
        const n = bare(s);
        if (n.length && !(`${kind}:${id}.${field}` in ALLOWED)) hits.push(`${kind}:${id} ${lang}.${field} has bare ${n.join(', ')}: ${s}`);
      }
    }
  }
  return hits;
}

describe('text lint: no bare numbers', () => {
  it('items, combos, sets and enemies write every number as a {placeholder} (except the listed facts and jokes)', () => {
    const hits = [
      ...contentItems().flatMap((c) => scan('item', c.id, c.text as never)),
      ...contentCombos().flatMap((c) => scan('combo', c.id, c.text as never)),
      ...contentSets().flatMap((c) => scan('set', c.id, c.text as never)),
      ...contentEnemies().flatMap((c) => scan('enemy', c.id, c.text as never)),
    ];
    expect(hits).toEqual([]);
  });

  it('the allowlist has no stale entries: each one still has a bare number', () => {
    const all = [
      ...contentItems().map((c) => ['item', c.id, c.text] as const),
      ...contentCombos().map((c) => ['combo', c.id, c.text] as const),
      ...contentSets().map((c) => ['set', c.id, c.text] as const),
      ...contentEnemies().map((c) => ['enemy', c.id, c.text] as const),
    ];
    for (const key of Object.keys(ALLOWED)) {
      const [kind, rest] = key.split(':'), [id, field] = rest.split('.');
      const entry = all.find(([k, i]) => k === kind && i === id);
      expect(entry, key).toBeDefined();
      const t = (entry![2] as unknown as Record<'en' | 'de', Texts>).en[field];
      expect([t].flat().some((s) => bare(s).length > 0), key).toBe(true);
    }
  });

  it('catches a number that mirrors the tune (the lint itself)', () => {
    expect(bare('Burns for 2 s, {dps|ps} damage')).toEqual(['2']);
    expect(bare('{hp|+int} max HP, ★2 and ★3')).toEqual([]);
    expect(bare('Brand 2,5/s')).toEqual(['2,5']);
  });
});
