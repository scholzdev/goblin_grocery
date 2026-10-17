import { formatValue, rowSpecs } from '../../src/engine/text';
import type { Lang, Tune } from '../../src/engine/define';

/**
 * The item rules "template" form the golden text snapshot has recorded since before the content system: `{0}`, `{1}`, ... index the
 * scaling rows (the shop fills them per tier), and a placeholder on a scalar tune becomes its literal ★1 text. Only the golden test
 * renders it, so the snapshot keeps comparing byte for byte; the game renders rules straight from the tune (`renderText`).
 */
interface RowSource { tune?: Tune; rows?: Parameters<typeof rowSpecs>[0]['rows'] }

export function legacyRules(template: string, content: RowSource, lang: Lang): string {
  const rows = rowSpecs(content);
  return template.replace(/\{(\w+)(?:\|([^{}|]*))?\}/g, (_, key: string, fmt: string | undefined) => {
    const f = fmt ?? 'n';
    const i = rows.findIndex((r) => r.key === key && r.fmt === f);
    if (i >= 0) return `{${i}}`;
    const v = content.tune?.[key];
    if (typeof v === 'number') return formatValue(v, f, lang);
    throw new Error(`text: per-tier placeholder {${key}|${f}} in "${template}" has no matching row`);
  });
}
