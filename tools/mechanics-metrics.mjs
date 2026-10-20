// Mechanics metrics over build-lab output: `node tools/mechanics-metrics.mjs a.json [b.json] [--json]` (docs/buildlab.md).
// src/buildlab/metrics.ts is TypeScript and imports game data, so it is loaded through Vite's SSR loader, like tools/buildlab.mjs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const files = args.filter((a) => a !== '--json');
if (files.length < 1 || files.length > 2 || files.some((f) => f.startsWith('--'))) {
  console.error('usage: node tools/mechanics-metrics.mjs <a.json> [<b.json>] [--json]');
  process.exit(2);
}

function load(file) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  if (!report.runs?.length) throw new Error(`${file}: no runs`);
  if (!report.runs.every((r) => ['merges', 'rerolls', 'sells'].every((k) => typeof r[k] === 'number'))) {
    throw new Error(`${file}: the runs have no merges / rerolls / sells counts. Regenerate it with the current build lab (npm run buildlab).`);
  }
  return report;
}

let reports;
try {
  reports = files.map(load);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  appType: 'custom',
  logLevel: 'error',
  clearScreen: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false, watch: null },
});
let code = 0;
try {
  const { computeMetrics, formatMetrics } = await server.ssrLoadModule('/src/buildlab/metrics.ts');
  const cols = reports.map((report, i) => ({ name: 'AB'[i], file: files[i], meta: report.meta, metrics: computeMetrics(report) }));
  if (!args.includes('--json')) console.log(formatMetrics(cols));
  else console.log(JSON.stringify(cols.length === 1 ? cols[0].metrics : { a: cols[0].metrics, b: cols[1].metrics }, null, 2));
} catch (e) {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  code = 1;
} finally {
  await server.close();
}
process.exit(code);
