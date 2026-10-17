import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { analyze, toMarkdown } from '../src/buildlab/balance';
import { evolve } from '../src/buildlab/evolve';
import { ALL_STARTERS, runBatch } from '../src/buildlab/run';
import { createGreedyPolicy, type PolicyFactory } from '../src/buildlab/policy';
import { formatSummary } from '../src/buildlab/report';
import type { DepartmentId, StarterId, StarterWeapon } from '../src/types';

// The build-lab CLI (docs/buildlab.md). Run through tools/buildlab.mjs (Vite's SSR loader), never with plain node.

const USAGE = `usage: npm run buildlab -- [options]
       npm run buildlab -- evolve [evolve options]
  --runs N          runs per starter/weapon pair (default 50)
  --seed N          base seed (default 1)
  --starter ID|all  character: toaster | pan | coupon | night | all (default toaster)
  --weapon ID|all   starting weapon: toaster | pan | nailgun | all (default toaster)
  --shift N         difficulty, 0 = Day Shift (default 0)
  --theme ID        run theme: main | frozen | bakery | electronics | checkout (default main)
  --pool all|starting   items that may appear in shops (default all)
  --policy NAME     greedy (default)
  --out FILE        JSON report (default buildlab-out/run.json)
  --quiet           no summary on stdout

evolve options (optimizer + balance report, docs/buildlab.md):
  --pop N           genomes per generation (default 12)
  --gens N          generations (default 8)
  --seeds-per-eval N   runs per genome in the fitness (default 32)
  --starter ID|all  characters in every evaluation (default toaster)
  --weapon ID|all   starting weapons (default toaster)
  --seed N          evolution seed (default 1)
  --top-k N         distinct best genomes kept (default 8)
  --held-out N      held-out runs per reported genome (default 48)
  --control N       random genomes in the control population (default 12)
  --shift N --theme ID --pool all|starting   as above
  --out PATH        writes PATH.json and PATH.md (default buildlab-out/evolve)
  --quiet           no progress on stdout`;

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

async function mainEvolve(argv: string[]): Promise<number> {
  const a = parseArgs(argv);
  if (a.help) { console.log(USAGE); return 0; }
  const starter = String(a.starter ?? 'toaster'), weapon = String(a.weapon ?? 'toaster');
  const starters = starter === 'all' ? ALL_STARTERS : [starter as StarterId];
  const weapons = weapon === 'all' ? WEAPONS : [weapon as StarterWeapon];
  for (const s of starters) if (!ALL_STARTERS.includes(s)) throw new Error(`unknown starter "${s}" (${ALL_STARTERS.join(', ')}, all)`);
  for (const w of weapons) if (!WEAPONS.includes(w)) throw new Error(`unknown weapon "${w}" (${WEAPONS.join(', ')}, all)`);
  const pool = String(a.pool ?? 'all');
  if (pool !== 'all' && pool !== 'starting') throw new Error('--pool is all or starting');
  const base = String(a.out ?? 'buildlab-out/evolve').replace(/\.(json|md)$/, '');
  const quiet = !!a.quiet, pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const res = evolve({
    seed: num(a.seed, 'seed', 1), pop: num(a.pop, 'pop', 12), gens: num(a.gens, 'gens', 8), seedsPerEval: num(a['seeds-per-eval'], 'seeds-per-eval', 32),
    topK: num(a['top-k'], 'top-k', 8), heldOut: num(a['held-out'], 'held-out', 48), control: num(a.control, 'control', 12),
    starters, weapons, shift: num(a.shift, 'shift', 0), theme: (a.theme as DepartmentId | undefined) ?? 'main', pool,
    onGeneration: quiet ? undefined : (g) => console.log(`gen ${String(g.gen).padStart(2)}  best ${g.best.toFixed(3)}  mean ${g.mean.toFixed(3)}  best win ${pct(g.bestWinRate)}  best aisle ${g.bestAvgAisle.toFixed(2)}  (${g.evaluated} evaluated)`),
  });
  const bal = analyze(res, basename(base));
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.json`, JSON.stringify(bal, null, 2) + '\n');
  writeFileSync(`${base}.md`, toMarkdown(bal));
  if (!quiet) {
    const g = bal.groups;
    console.log(`held-out win rate: top ${pct(g.top.winRate)} (aisle ${g.top.avgAisle.toFixed(2)}), greedy ${pct(g.greedy.winRate)} (${g.greedy.avgAisle.toFixed(2)}), random ${pct(g.control.winRate)} (${g.control.avgAisle.toFixed(2)}); best single ${g.bestSingle.label} ${pct(g.bestSingle.winRate)}`);
    console.log(`took ${(res.durationMs / 1000).toFixed(1)} s`);
    console.log(`report: ${base}.json, ${base}.md`);
  }
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  if (argv[0] === 'evolve') return mainEvolve(argv.slice(1));
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
