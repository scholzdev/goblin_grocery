import { describe, expect, it } from 'vitest';
import { defineItem, resolveTune, tuneValue } from '../../src/engine/define';
import { formatValue, legacyRules, placeholders, renderText, tierRows } from '../../src/engine/text';

describe('formatValue', () => {
  it('pct rounds x100 and adds %', () => {
    expect(formatValue(0.3, 'pct', 'en')).toBe('30%');
    expect(formatValue(0.375, 'pct', 'en')).toBe('38%');
    expect(formatValue(1.5, 'pct', 'en')).toBe('150%');
  });
  it('pct1 keeps one decimal (German comma)', () => {
    expect(formatValue(0.375, 'pct1', 'en')).toBe('37.5%');
    expect(formatValue(0.375, 'pct1', 'de')).toBe('37,5%');
    expect(formatValue(0.3, 'pct1', 'en')).toBe('30%');
  });
  it('s, ps, x and deg add their unit', () => {
    expect(formatValue(1.5, 's', 'en')).toBe('1.5 s');
    expect(formatValue(1.5, 's', 'de')).toBe('1,5 s');
    expect(formatValue(2.5, 'ps', 'en')).toBe('2.5/s');
    expect(formatValue(2, 'x', 'en')).toBe('2×');
    expect(formatValue(1.5, 'x', 'en')).toBe('1.5×');
    expect(formatValue(29.6, 'deg', 'en')).toBe('30°');
  });
  it('plain numbers match the legacy fmt: up to 2 decimals, German comma, int rounds', () => {
    expect(formatValue(3.75, 'n', 'en')).toBe('3.75');
    expect(formatValue(3.75, 'n', 'de')).toBe('3,75');
    expect(formatValue(1.2345, 'n', 'en')).toBe('1.23');
    expect(formatValue(5, 'n', 'en')).toBe('5');
    expect(formatValue(2.5, 'int', 'en')).toBe('3');
  });
  it('a leading + or − only prepends that literal sign', () => {
    expect(formatValue(0.25, '+pct', 'en')).toBe('+25%');
    expect(formatValue(0.5, '−s', 'en')).toBe('−0.5 s');
    expect(formatValue(1, '+int', 'en')).toBe('+1');
    expect(formatValue(-0.25, 'pct', 'en')).toBe('-25%'); // never derived from the value
  });
  it('rejects unknown formatters', () => {
    expect(() => formatValue(1, 'bogus', 'en')).toThrow(/unknown formatter "bogus"/);
    expect(() => formatValue(1, '+', 'en')).toThrow(/unknown formatter/);
  });
});

describe('renderText', () => {
  const tune = { dps: [2.5, 3.75, 5], duration: 2, pct: [0.25, 0.375, 0.5] } as const;
  it('fills {key} and {key|fmt}, picking the tier for per-tier arrays', () => {
    const tpl = 'Burn {dps|ps} for {duration|s} (slow {pct|pct}), {dps} raw.';
    expect(renderText(tpl, tune, 1, 'en')).toBe('Burn 2.5/s for 2 s (slow 25%), 2.5 raw.');
    expect(renderText(tpl, tune, 3, 'en')).toBe('Burn 5/s for 2 s (slow 50%), 5 raw.');
    expect(renderText(tpl, tune, 2, 'de')).toBe('Burn 3,75/s for 2 s (slow 38%), 3,75 raw.');
  });
  it('continues the last step above ★3 (Gold Star on a ★3 module)', () => {
    expect(tuneValue([0.25, 0.375, 0.5], 4)).toBe(0.625);
    expect(tuneValue([2.5, 3.75, 5], 4)).toBe(6.25);
    expect(tuneValue(7, 4)).toBe(7);
    expect(resolveTune({ a: [1, 2, 3], b: 4 }, 2)).toEqual({ a: 2, b: 4 });
  });
  it('throws on a placeholder with no tune key', () => {
    expect(() => renderText('Deal {dmg} damage', tune, 1, 'en')).toThrow(/no tune key "dmg"/);
    expect(() => renderText('Deal {dmg}', undefined, 1, 'en')).toThrow(/no tune key "dmg"/);
  });
  it('throws on an unknown formatter', () => {
    expect(() => renderText('{dps|bogus}', tune, 1, 'en')).toThrow(/unknown formatter "bogus"/);
  });
  it('leaves text without placeholders alone', () => {
    expect(renderText('Plain text, 5 range.', undefined, 1, 'en')).toBe('Plain text, 5 range.');
  });
  it('lists placeholders', () => {
    expect(placeholders('a {x} b {y|pct}')).toEqual([{ key: 'x', fmt: 'n' }, { key: 'y', fmt: 'pct' }]);
  });
});

const fixture = defineItem({
  id: 'fuel', kind: 'module', sets: ['tools', 'heat'], shape: '1x2', price: 11, buff: 'fuel',
  tune: { dps: [2.5, 3.75, 5], duration: 2, reach: [0.3, 0.45, 0.6] },
  text: {
    en: { name: 'Fuel Can', blurb: 'x', rules: 'Burn {dps|ps} for {duration|s}, reach {reach|+pct}.' },
    de: { name: 'Benzinkanister', blurb: 'x', rules: 'Brand {dps|ps} für {duration|s}, Reichweite {reach|+pct}.' },
  },
  rows: [
    { label: { en: 'Burn', de: 'Brand' }, key: 'dps', fmt: 'ps' },
    { label: { en: 'Reach', de: 'Reichweite' }, key: 'reach', fmt: '+pct' },
  ],
});

describe('tierRows', () => {
  it('builds label + ★1/★2/★3 values from the per-tier arrays', () => {
    expect(tierRows(fixture, 'en')).toEqual([
      { label: 'Burn', values: ['2.5/s', '3.75/s', '5/s'] },
      { label: 'Reach', values: ['+30%', '+45%', '+60%'] },
    ]);
    expect(tierRows(fixture, 'de')[0]).toEqual({ label: 'Brand', values: ['2,5/s', '3,75/s', '5/s'] });
  });
  it('without a rows spec, makes one plain row per array-valued key', () => {
    const { rows: _rows, ...bare } = fixture;
    expect(tierRows(bare, 'en')).toEqual([
      { label: 'dps', values: ['2.5', '3.75', '5'] },
      { label: 'reach', values: ['0.3', '0.45', '0.6'] },
    ]);
  });
  it('throws on a row whose tune key is missing', () => {
    expect(() => tierRows({ tune: {}, rows: [{ label: { en: 'x', de: 'x' }, key: 'nope' }] }, 'en')).toThrow(/no tune key "nope"/);
  });
});

describe('legacyRules', () => {
  it('turns placeholders that match a row into {index} and inlines scalars', () => {
    expect(legacyRules(fixture.text.en.rules, fixture, 'en')).toBe('Burn {0} for 2 s, reach {1}.');
    expect(legacyRules(fixture.text.de.rules, fixture, 'de')).toBe('Brand {0} für 2 s, Reichweite {1}.');
  });
  it('throws for a per-tier placeholder that has no row', () => {
    expect(() => legacyRules('Burn {dps}', fixture, 'en')).toThrow(/no matching row/);
  });
});
