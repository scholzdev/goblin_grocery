// golden-prefixes.mjs <beforeDir> <afterDir>: changed leaf paths of the golden snapshots, grouped by their first two/three keys.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const [before, after] = process.argv.slice(2);
const flatten = (v, path, out) => { if (v && typeof v === 'object') { const k = Object.keys(v); if (!k.length) out.set(path, JSON.stringify(v)); for (const x of k) flatten(v[x], path ? `${path}.${x}` : x, out); } else out.set(path, JSON.stringify(v)); return out; };
for (const f of readdirSync(after).filter((x) => x.endsWith('.json'))) {
  const a = flatten(JSON.parse(readFileSync(join(before, f), 'utf8')), '', new Map()), b = flatten(JSON.parse(readFileSync(join(after, f), 'utf8')), '', new Map());
  const groups = new Map();
  for (const p of new Set([...a.keys(), ...b.keys()])) if (a.get(p) !== b.get(p)) { const g = p.split('.').slice(0, 2).join('.'); groups.set(g, (groups.get(g) ?? 0) + 1); }
  console.log(`## ${f}: ${[...groups.values()].reduce((x, y) => x + y, 0)} changed leaves`);
  for (const [g, n] of [...groups].sort()) console.log(`  ${g}  ${n}`);
}
