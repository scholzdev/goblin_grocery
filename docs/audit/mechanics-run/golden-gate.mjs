// usage: node golden-gate.mjs <beforeDir> <afterDir> <results.json>
// results.json: the workflow result array; each unit's declared prefixes come from fix ?? impl.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [beforeDir, afterDir, resultsPath] = process.argv.slice(2);
const units = JSON.parse(readFileSync(resultsPath, 'utf8'));
const declared = units.flatMap((u) => ((u.fix ?? u.impl)?.goldenPrefixes ?? []).map((p) => ({ unit: u.id, p: p.replace(/\.?\*$/, '') })));

const flatten = (v, path, out) => {
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (!keys.length) out.set(path, JSON.stringify(v));
    for (const k of keys) flatten(v[k], path ? `${path}.${k}` : k, out);
  } else out.set(path, JSON.stringify(v));
  return out;
};

let undeclared = 0;
let changed = 0;
for (const file of readdirSync(afterDir).filter((f) => f.endsWith('.json'))) {
  const a = flatten(JSON.parse(readFileSync(join(beforeDir, file), 'utf8')), '', new Map());
  const b = flatten(JSON.parse(readFileSync(join(afterDir, file), 'utf8')), '', new Map());
  const paths = new Set([...a.keys(), ...b.keys()]);
  const byUnit = new Map();
  const bad = [];
  for (const p of paths) {
    if (a.get(p) === b.get(p)) continue;
    changed++;
    const hit = declared.find((d) => p === d.p || p.startsWith(`${d.p}.`));
    if (hit) byUnit.set(hit.unit, (byUnit.get(hit.unit) ?? 0) + 1);
    else bad.push(p);
  }
  console.log(`## ${file}`);
  for (const [u, n] of byUnit) console.log(`  declared by ${u}: ${n} changed leaves`);
  const roots = new Map();
  for (const p of bad) {
    const root = p.split('.').slice(0, 3).join('.');
    roots.set(root, (roots.get(root) ?? 0) + 1);
  }
  for (const [r, n] of roots) console.log(`  UNDECLARED ${r}: ${n} changed leaves`);
  undeclared += bad.length;
}
console.log(`changed leaves: ${changed}, undeclared: ${undeclared}`);
process.exit(undeclared ? 1 : 0);
