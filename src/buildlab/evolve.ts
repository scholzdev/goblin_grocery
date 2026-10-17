import { BOSS_WAVE } from '../data/waves';
import { mulberry32 } from '../systems/rng';
import type { DepartmentId, StarterId, StarterWeapon } from '../types';
import { crossover, distance, genomePolicy, greedyGenome, mutate, randomGenome, type Genome } from './genome';
import type { RunRecord } from './report';
import { playRun, runSeed } from './run';

// The Phase 1b optimizer (docs/buildlab.md "Optimizer"): a seeded (mu + lambda) evolution strategy over `Genome`s. Elites are kept and never
// re-evaluated (the eval seeds are fixed for the whole run, common random numbers), offspring are mutated or crossed elites. Everything is
// deterministic for the same options.

/** What one run is worth. Progress first, a win on top, and two small terms that make the landscape smoother than "died in aisle k". */
export function runFitness(r: RunRecord): number {
  const last = r.aisles.at(-1);
  if (r.result === 'win') return BOSS_WAVE + 3 + (last ? last.hpAfter / Math.max(1, r.finalBuild.maxHp) : 0);
  // aisles survived, plus up to half an aisle for how much of the deadly aisle's enemies were killed
  const cleared = (r.diedAt ?? r.aislesPlayed) - 1;
  return cleared + (last && last.spawned > 0 ? 0.5 * Math.min(1, last.kills / last.spawned) : 0);
}

export interface EvolveOptions {
  seed?: number;
  /** Genomes per generation (default 12). */
  pop?: number;
  /** Generations after the initial one (default 8). */
  gens?: number;
  /** Runs per genome in the fitness (default 32): one (seed, character) pair each, the same for every genome. */
  seedsPerEval?: number;
  starters?: StarterId[];
  weapons?: StarterWeapon[];
  shift?: number;
  theme?: DepartmentId;
  pool?: 'all' | 'starting';
  /** Distinct best genomes kept for the report (default 8). */
  topK?: number;
  /** Runs per genome on the held-out seeds (default 48). */
  heldOut?: number;
  /** Random genomes in the control population (default 12). */
  control?: number;
  onGeneration?: (g: GenStat) => void;
  now?: () => number;
}

export interface Scored { genome: Genome; fitness: number; winRate: number; avgAisle: number; gen: number }

export interface GenStat { gen: number; best: number; mean: number; bestWinRate: number; bestAvgAisle: number; evaluated: number }

export interface HeldOut {
  label: string;
  genome: Genome;
  /** Fitness during the evolution (the training seeds); absent for the control and greedy. */
  trainFitness?: number;
  fitness: number;
  winRate: number;
  avgAisle: number;
  runs: RunRecord[];
}

export interface EvolveResult {
  options: Required<Pick<EvolveOptions, 'seed' | 'pop' | 'gens' | 'seedsPerEval' | 'topK' | 'heldOut' | 'control' | 'shift' | 'theme' | 'pool'>> & { starters: StarterId[]; weapons: StarterWeapon[] };
  generations: GenStat[];
  /** Distinct best genomes by training fitness, best first. */
  top: Scored[];
  heldOut: { top: HeldOut[]; control: HeldOut[]; greedy: HeldOut };
  durationMs: number;
}

interface Pair { seed: number; starter: StarterId; weapon: StarterWeapon }

/** n (seed, character, weapon) pairs: the characters and weapons cycle, so every genome meets the same mix. */
export function evalPairs(base: number, n: number, starters: StarterId[], weapons: StarterWeapon[]): Pair[] {
  return Array.from({ length: n }, (_, i) => ({ seed: runSeed(base, i), starter: starters[i % starters.length], weapon: weapons[Math.floor(i / starters.length) % weapons.length] }));
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function evaluate(genome: Genome, pairs: Pair[], o: { shift?: number; theme?: DepartmentId; pool?: 'all' | 'starting'; name?: string }): { fitness: number; winRate: number; avgAisle: number; runs: RunRecord[] } {
  const policy = genomePolicy(genome, o.name);
  const runs = pairs.map((p) => playRun({ ...p, shift: o.shift, theme: o.theme, pool: o.pool, policy }));
  return {
    fitness: mean(runs.map(runFitness)),
    winRate: runs.filter((r) => r.result === 'win').length / Math.max(1, runs.length),
    avgAisle: mean(runs.map((r) => (r.result === 'win' ? BOSS_WAVE : r.diedAt ?? r.aislesPlayed))),
    runs,
  };
}

export function evolve(opt: EvolveOptions = {}): EvolveResult {
  const now = opt.now ?? (() => Date.now());
  const t0 = now();
  const o = {
    seed: opt.seed ?? 1, pop: Math.max(4, opt.pop ?? 12), gens: opt.gens ?? 8, seedsPerEval: opt.seedsPerEval ?? 32, topK: opt.topK ?? 8, heldOut: opt.heldOut ?? 48, control: opt.control ?? 12,
    shift: opt.shift ?? 0, theme: (opt.theme ?? 'main') as DepartmentId, pool: opt.pool ?? 'all', starters: opt.starters ?? ['toaster'], weapons: opt.weapons ?? ['toaster'],
  };
  const ev = { shift: o.shift, theme: o.theme, pool: o.pool };
  const rng = mulberry32(o.seed ^ 0xe701);
  const train = evalPairs(o.seed ^ 0x7a1f, o.seedsPerEval, o.starters, o.weapons);
  const all: Scored[] = [];
  const score = (genome: Genome, gen: number): Scored => {
    const r = evaluate(genome, train, ev);
    const s: Scored = { genome, fitness: r.fitness, winRate: r.winRate, avgAisle: r.avgAisle, gen };
    all.push(s);
    return s;
  };
  const byFitness = (a: Scored, b: Scored): number => b.fitness - a.fitness;

  // generation 0: the greedy policy, mutants of it, and a few random genomes
  const greedy = greedyGenome();
  let popu: Scored[] = [score(greedy, 0)];
  const nRandom = Math.floor((o.pop - 1) / 4);
  while (popu.length < o.pop - nRandom) popu.push(score(mutate(greedy, rng, 0.3, 0.15), 0));
  while (popu.length < o.pop) popu.push(score(randomGenome(rng), 0));
  const generations: GenStat[] = [];
  const record = (gen: number, evaluated: number): void => {
    const best = [...popu].sort(byFitness)[0];
    const g: GenStat = { gen, best: best.fitness, mean: mean(popu.map((p) => p.fitness)), bestWinRate: best.winRate, bestAvgAisle: best.avgAisle, evaluated };
    generations.push(g);
    opt.onGeneration?.(g);
  };
  record(0, popu.length);

  const mu = Math.max(2, Math.ceil(o.pop / 4));
  for (let gen = 1; gen <= o.gens; gen++) {
    popu.sort(byFitness);
    const elites = popu.slice(0, mu);
    const sigma = 0.25 - 0.17 * (gen / Math.max(1, o.gens)), rate = 0.12;
    const kids: Scored[] = [];
    while (elites.length + kids.length < o.pop) {
      const pick = (): Genome => elites[Math.floor(rng() ** 2 * elites.length)].genome; // rank-biased: the best parents most often
      let child = pick();
      if (rng() < 0.25) child = crossover(child, pick(), rng);
      kids.push(score(mutate(child, rng, sigma, rate), gen));
    }
    popu = [...elites, ...kids];
    record(gen, kids.length);
  }

  // the top K distinct genomes by training fitness (a lineage's near-copies count once)
  const top: Scored[] = [];
  for (const s of [...all].sort(byFitness)) {
    if (top.length >= o.topK) break;
    if (top.every((t) => distance(t.genome, s.genome) >= 0.03)) top.push(s);
  }

  // held-out seeds the evolution never saw
  const held = evalPairs(o.seed ^ 0x4e1d, o.heldOut, o.starters, o.weapons);
  const run = (label: string, genome: Genome, trainFitness?: number): HeldOut => ({ label, genome, ...(trainFitness !== undefined ? { trainFitness } : {}), ...evaluate(genome, held, { ...ev, name: label }) });
  const crng = mulberry32(o.seed ^ 0xc0ffee);
  return {
    options: o, generations, top,
    heldOut: {
      top: top.map((t, i) => run(`top${i + 1}`, t.genome, t.fitness)),
      control: Array.from({ length: o.control }, (_, i) => run(`random${i + 1}`, randomGenome(crng))),
      greedy: run('greedy', greedy),
    },
    durationMs: now() - t0,
  };
}
