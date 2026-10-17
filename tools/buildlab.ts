import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ALL_STARTERS, runBatch } from '../src/buildlab/run';
import { createGreedyPolicy, type PolicyFactory } from '../src/buildlab/policy';
import { formatSummary } from '../src/buildlab/report';
import type { DepartmentId, StarterId, StarterWeapon } from '../src/types';

// The build-lab CLI (docs/buildlab.md). Run through tools/buildlab.mjs (Vite's SSR loader), never with plain node.

const USAGE = `usage: npm run buildlab -- [options]
  --runs N          runs per starter/weapon pair (default 50)
  --seed N          base seed (default 1)
  --starter ID|all  character: toaster | pan | coupon | night | all (default toaster)
  --weapon ID|all   starting weapon: toaster | pan | nailgun | all (default toaster)
  --shift N         difficulty, 0 = Day Shift (default 0)
  --theme ID        run theme: main | frozen | bakery | electronics | checkout (default main)
  --pool all|starting   items that may appear in shops (default all)
  --policy NAME     greedy (default)
  --out FILE        JSON report (default buildlab-out/run.json)
  --quiet           no summary on stdout`;

const POLICIES: Record<string, PolicyFactory> = { greedy: () => createGreedyPolicy() };
const WEAPONS: StarterWeapon[] = ['toaster', 'pan', 'nailgun'];

export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument "${a}"\n${USAGE}`);
    const key = a.slice(2), next = argv[i + 1];
    if (key === 'quiet' || key === 'help') out[key] = true;
    else if (next === undefined || next.startsWith('--')) throw new Error(`--${key} needs a value\n${USAGE}`);
    else { out[key] = next; i++; }
  }
  return out;
}

const num = (v: string | true | undefined, name: string, d: number): number => {
  if (v === undefined) return d;
  const n = Number(v);
  if (typeof v !== 'string' || !Number.isFinite(n)) throw new Error(`--${name} needs a number`);
  return n;
};

export async function main(argv: string[]): Promise<number> {
  const a = parseArgs(argv);
  if (a.help) { console.log(USAGE); return 0; }
  const runs = num(a.runs, 'runs', 50), seed = num(a.seed, 'seed', 1), shift = num(a.shift, 'shift', 0);
  const starter = String(a.starter ?? 'toaster'), weapon = String(a.weapon ?? 'toaster');
  const starters = starter === 'all' ? ALL_STARTERS : [starter as StarterId];
  const weapons = weapon === 'all' ? WEAPONS : [weapon as StarterWeapon];
  for (const s of starters) if (!ALL_STARTERS.includes(s)) throw new Error(`unknown starter "${s}" (${ALL_STARTERS.join(', ')}, all)`);
  for (const w of weapons) if (!WEAPONS.includes(w)) throw new Error(`unknown weapon "${w}" (${WEAPONS.join(', ')}, all)`);
  const pool = String(a.pool ?? 'all');
  if (pool !== 'all' && pool !== 'starting') throw new Error('--pool is all or starting');
  const policy = POLICIES[String(a.policy ?? 'greedy')];
  if (!policy) throw new Error(`unknown policy "${a.policy}" (${Object.keys(POLICIES).join(', ')})`);
  const out = String(a.out ?? 'buildlab-out/run.json');

  const report = runBatch({ seed, runs, starters, weapons, shift, theme: (a.theme as DepartmentId | undefined) ?? 'main', pool, policy });
  try { report.meta.gitRev = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  if (!a.quiet) {
    console.log(formatSummary(report.summary, report.meta));
    console.log(`report: ${out}`);
  }
  return 0;
}
