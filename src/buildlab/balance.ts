import { BOSS_WAVE } from '../data/waves';
import { ITEM_ORDER, RECIPE_ORDER, SET_ORDER } from '../engine/define';
import { GENOME_SPEC, greedyGenome, type Genome } from './genome';
import type { EvolveResult } from './evolve';
import type { RunRecord } from './report';

// The Phase 1b balance report (docs/buildlab.md "Reading the report"): what the best evolved builds do differently from random play, so a
// designer can see which items, combos and sets dominate and which nobody wants. Everything here is a pure function of the held-out runs.

/** Every threshold of the flags, in one place. */
export const BALANCE_CONFIG = {
  /** An item or combo is a candidate for "dominant" when at least this share of the top builds hold it at the end ... */
  dominantHeld: 0.6,
  /** ... and the top builds hold it at least this many times as often as the random control does ... */
  dominantLift: 1.5,
  /** ... and (when enough runs hold it) the runs holding it win at least this much more often than the others (absolute; 0 = it must not lower the win rate; wins are rare in the proxy, so a positive margin would flag nothing). */
  dominantWinLift: 0,
  /** Dead: at most this share of the top builds hold the item ... */
  deadHeld: 0.05,
  /** ... although it is modelled and the random control holds it at least this often (so it is offered and affordable). */
  deadControlMin: 0.05,
  /** Fewer top runs holding the item than this: no win-rate claim. */
  minSample: 8,
  /** Top builds shown in the report. */
  topBuilds: 5,
} as const;

/** Items the proxy cannot value: they act through movement, the dash, the pickup radius or the shove, none of which exists in the headless fight. */
export const UNMODELLED: Record<string, string> = {
  bell: 'dash / shove effect', bumper: 'dash / shove effect', boot: 'dash effect', energy: 'move speed / dash',
  flag: 'movement effect', magnet: 'pickup radius', sparewheel: 'dash effect', tipjar: 'pickup effect', tinfoilhat: 'movement / dodge effect',
  vacuum: 'pickup pull (its weapon part is modelled)',
};
/** Combos whose effect needs the dash or movement. */
export const UNMODELLED_COMBOS: Record<string, string> = {
  expressCheckout: 'dash', potSlam: 'dash', sugarRush: 'dash', tailwind: 'dash / move speed', bagIt: 'pickup',
};

export interface ItemRow {
  id: string;
  modelled: boolean;
  /** Share of the top / control / greedy runs that hold the item in the cart at the end. */
  heldTop: number; heldControl: number; heldGreedy: number;
  /** heldTop / heldControl (null when the control never holds it). */
  lift: number | null;
  /** Share of the top runs that ever acquired it (shop, crate, stockroom, start). */
  pickTop: number;
  winHeld: number | null; winNot: number | null;
  /** Mean share of the damage dealt that came from the item's weapon, over the top runs holding it. */
  damageShare: number | null;
  runsHeld: number;
  dominant: boolean; dead: boolean;
}
export interface FormRow { id: string; unmodelled?: string; formTop: number; formControl: number; winHeld: number | null; winNot: number | null; winLift: number | null; dominant: boolean; levels?: number[] }
export interface ReactionRow { id: string; totalTop: number; perRunTop: number; perRunControl: number }
export interface StarterRow { starter: string; runs: number; bestWinRate: number; bestAvgAisle: number; greedyWinRate: number; greedyAvgAisle: number }
export interface BuildRow { rank: number; label: string; starter: string; weapon: string; result: string; aisle: number; cart: string; items: string; shelf: string; combos: string; sets: string; maxHp: number }
export interface ThresholdRow { key: string; greedy: number; topMedian: number; topMin: number; topMax: number }
export interface Balance {
  name: string;
  options: EvolveResult['options'];
  durationMs: number;
  config: typeof BALANCE_CONFIG;
  groups: { top: { genomes: number; runs: number; winRate: number; avgAisle: number }; control: { genomes: number; runs: number; winRate: number; avgAisle: number }; greedy: { runs: number; winRate: number; avgAisle: number }; bestSingle: { label: string; winRate: number; avgAisle: number; trainFitness?: number; heldFitness: number } };
  generations: EvolveResult['generations'];
  items: ItemRow[];
  unmodelledItems: Record<string, string>;
  combos: FormRow[];
  sets: FormRow[];
  reactions: ReactionRow[];
  starters: StarterRow[];
  builds: BuildRow[];
  thresholds: ThresholdRow[];
  genomes: { label: string; trainFitness?: number; heldFitness: number; winRate: number; avgAisle: number; genome: Genome }[];
  findings: string[];
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const reachedOf = (r: RunRecord): number => (r.result === 'win' ? BOSS_WAVE : r.diedAt ?? r.aislesPlayed);
const share = (n: number, d: number): number => (d > 0 ? n / d : 0);
const winRate = (runs: RunRecord[]): number => share(runs.filter((r) => r.result === 'win').length, runs.length);
const avgAisle = (runs: RunRecord[]): number => share(runs.reduce((a, r) => a + reachedOf(r), 0), runs.length);
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

const holds = (r: RunRecord, id: string): boolean => r.finalBuild.items.some((i) => i.id === id);
function split(runs: RunRecord[], has: (r: RunRecord) => boolean): { held: RunRecord[]; not: RunRecord[]; share: number; winHeld: number | null; winNot: number | null } {
  const held = runs.filter(has), not = runs.filter((r) => !has(r));
  return { held, not, share: share(held.length, runs.length), winHeld: held.length ? winRate(held) : null, winNot: not.length ? winRate(not) : null };
}
const lift = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** A run's damage by weapon id, summed over its aisles, and the total dealt. */
function damageOf(r: RunRecord): { by: Record<string, number>; total: number } {
  const by: Record<string, number> = {};
  let total = 0;
  for (const a of r.aisles) { total += a.dealt; for (const [k, v] of Object.entries(a.damage.bySource)) by[k] = (by[k] ?? 0) + v; }
  return { by, total };
}

export function analyze(res: Pick<EvolveResult, 'options' | 'generations' | 'heldOut' | 'durationMs'>, name = 'evolve'): Balance {
  const C = BALANCE_CONFIG;
  const { top, control, greedy } = res.heldOut;
  const topRuns = top.flatMap((h) => h.runs), ctrlRuns = control.flatMap((h) => h.runs), greedyRuns = greedy.runs;
  const dmg = new Map<RunRecord, ReturnType<typeof damageOf>>();
  for (const r of topRuns) dmg.set(r, damageOf(r));

  const items: ItemRow[] = ITEM_ORDER.map((id) => {
    const t = split(topRuns, (r) => holds(r, id)), c = split(ctrlRuns, (r) => holds(r, id)), g = split(greedyRuns, (r) => holds(r, id));
    const shares = t.held.map((r) => { const d = dmg.get(r)!; return share(d.by[id] ?? 0, d.total); });
    const l = lift(t.share, c.share);
    const modelled = !(id in UNMODELLED);
    const winOk = t.winHeld === null || t.winNot === null || t.held.length < C.minSample || t.winHeld - t.winNot >= C.dominantWinLift;
    return {
      id, modelled,
      heldTop: r3(t.share), heldControl: r3(c.share), heldGreedy: r3(g.share), lift: l === null ? null : r3(l),
      pickTop: r3(share(topRuns.filter((r) => r.acquired.some((a) => a.item === id)).length, topRuns.length)),
      winHeld: t.winHeld === null ? null : r3(t.winHeld), winNot: t.winNot === null ? null : r3(t.winNot),
      damageShare: shares.length ? r3(shares.reduce((a, b) => a + b, 0) / shares.length) : null,
      runsHeld: t.held.length,
      dominant: modelled && t.share >= C.dominantHeld && (l === null || l >= C.dominantLift) && winOk,
      dead: modelled && t.share <= C.deadHeld && c.share >= C.deadControlMin,
    };
  });

  const formRow = (id: string, has: (r: RunRecord) => boolean, unmodelled?: string): FormRow => {
    const t = split(topRuns, has), c = split(ctrlRuns, has);
    const l = t.winHeld !== null && t.winNot !== null ? t.winHeld - t.winNot : null;
    return {
      id, ...(unmodelled ? { unmodelled } : {}), formTop: r3(t.share), formControl: r3(c.share),
      winHeld: t.winHeld === null ? null : r3(t.winHeld), winNot: t.winNot === null ? null : r3(t.winNot), winLift: l === null ? null : r3(l),
      dominant: !unmodelled && t.share >= C.dominantHeld && (lift(t.share, c.share) ?? Infinity) >= C.dominantLift && (l === null || t.held.length < C.minSample || l >= C.dominantWinLift),
    };
  };
  const combos = RECIPE_ORDER.map((id) => formRow(id, (r) => r.finalBuild.combos.includes(id), UNMODELLED_COMBOS[id]));
  const sets = SET_ORDER.map((id): FormRow => {
    const row = formRow(id, (r) => (r.finalBuild.sets[id] ?? 0) >= 1);
    return { ...row, levels: [1, 2, 3].map((lv) => r3(share(topRuns.filter((r) => (r.finalBuild.sets[id] ?? 0) >= lv).length, topRuns.length))) };
  });

  const reactionIds = [...new Set([...topRuns, ...ctrlRuns].flatMap((r) => r.aisles.flatMap((a) => Object.keys(a.damage.reactions))))].sort();
  const reactionSum = (runs: RunRecord[], id: string): number => runs.reduce((a, r) => a + r.aisles.reduce((b, x) => b + (x.damage.reactions[id as keyof typeof x.damage.reactions] ?? 0), 0), 0);
  const reactions: ReactionRow[] = reactionIds.map((id) => ({ id, totalTop: reactionSum(topRuns, id), perRunTop: r3(share(reactionSum(topRuns, id), topRuns.length)), perRunControl: r3(share(reactionSum(ctrlRuns, id), ctrlRuns.length)) }));

  const starters: StarterRow[] = [...new Set(topRuns.map((r) => r.starter))].map((s) => {
    const per = top.map((h) => h.runs.filter((r) => r.starter === s)).filter((rs) => rs.length);
    const g = greedyRuns.filter((r) => r.starter === s);
    return {
      starter: s, runs: per.reduce((a, rs) => a + rs.length, 0),
      bestWinRate: r3(Math.max(0, ...per.map(winRate))), bestAvgAisle: r3(Math.max(0, ...per.map(avgAisle))),
      greedyWinRate: r3(winRate(g)), greedyAvgAisle: r3(avgAisle(g)),
    };
  });

  // the best runs among the top genomes' held-out runs: wins first, then the furthest aisle, then the most hp left
  const hpLeft = (r: RunRecord): number => { const a = r.aisles.at(-1); return a ? a.hpAfter / Math.max(1, r.finalBuild.maxHp) : 0; };
  const ranked = top.flatMap((h) => h.runs.map((r) => ({ h, r }))).sort((a, b) => (b.r.result === 'win' ? 1 : 0) - (a.r.result === 'win' ? 1 : 0) || reachedOf(b.r) - reachedOf(a.r) || hpLeft(b.r) - hpLeft(a.r));
  const builds: BuildRow[] = ranked.slice(0, C.topBuilds).map(({ h, r }, i) => ({
    rank: i + 1, label: h.label, starter: r.starter, weapon: r.weapon, result: r.result === 'win' ? 'win' : `died in aisle ${r.diedAt ?? r.aislesPlayed}`, aisle: reachedOf(r),
    cart: `${r.finalBuild.cartSize[0]}x${r.finalBuild.cartSize[1]}`,
    items: [...r.finalBuild.items].sort((a, b) => (a.id < b.id ? -1 : 1)).map((x) => `${x.id} T${x.tier}`).join(', '),
    shelf: r.finalBuild.shelf.map((x) => `${x.id} T${x.tier}`).join(', '),
    combos: r.finalBuild.combos.join(', '),
    sets: Object.entries(r.finalBuild.sets).map(([k, v]) => `${k} ${v}`).join(', '),
    maxHp: r.finalBuild.maxHp,
  }));

  const g0 = greedyGenome();
  const rule = (k: string): number[] => top.map((h) => h.genome.p[k]);
  const thresholds: ThresholdRow[] = GENOME_SPEC.filter((s) => s.group === 'rule').map((s) => ({ key: s.key, greedy: g0.p[s.key], topMedian: r3(median(rule(s.key))), topMin: Math.min(...rule(s.key)), topMax: Math.max(...rule(s.key)) }));

  const best = [...top].sort((a, b) => b.fitness - a.fitness)[0];
  const groups: Balance['groups'] = {
    top: { genomes: top.length, runs: topRuns.length, winRate: r3(winRate(topRuns)), avgAisle: r3(avgAisle(topRuns)) },
    control: { genomes: control.length, runs: ctrlRuns.length, winRate: r3(winRate(ctrlRuns)), avgAisle: r3(avgAisle(ctrlRuns)) },
    greedy: { runs: greedyRuns.length, winRate: r3(winRate(greedyRuns)), avgAisle: r3(avgAisle(greedyRuns)) },
    bestSingle: best ? { label: best.label, winRate: r3(best.winRate), avgAisle: r3(best.avgAisle), heldFitness: r3(best.fitness), ...(best.trainFitness !== undefined ? { trainFitness: r3(best.trainFitness) } : {}) } : { label: '-', winRate: 0, avgAisle: 0, heldFitness: 0 },
  };

  const b: Balance = {
    name, options: res.options, durationMs: res.durationMs, config: C, groups, generations: res.generations, items, unmodelledItems: UNMODELLED, combos, sets, reactions, starters, builds, thresholds,
    genomes: [...top, greedy].map((h) => ({ label: h.label, ...(h.trainFitness !== undefined ? { trainFitness: r3(h.trainFitness) } : {}), heldFitness: r3(h.fitness), winRate: r3(h.winRate), avgAisle: r3(h.avgAisle), genome: h.genome })),
    findings: [],
  };
  b.findings = findings(b);
  return b;
}

const pct = (n: number | null): string => (n === null ? '-' : `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)}%`);
const pts = (n: number | null): string => (n === null ? '-' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(0)} pts`);

/** The "Findings" lines: only flags and numbers from the tables, no judgement the numbers do not carry. */
export function findings(b: Balance): string[] {
  const out: string[] = [];
  const g = b.groups;
  out.push(`Held-out: the best evolved genomes win ${pct(g.top.winRate)} (average aisle ${g.top.avgAisle.toFixed(2)}), the greedy policy ${pct(g.greedy.winRate)} (${g.greedy.avgAisle.toFixed(2)}), random genomes ${pct(g.control.winRate)} (${g.control.avgAisle.toFixed(2)}).`);
  const dom = b.items.filter((i) => i.dominant);
  out.push(dom.length
    ? `Dominant items (${dom.length}): ${dom.map((i) => `${i.id} (held in ${pct(i.heldTop)} of top builds vs ${pct(i.heldControl)} of random, win ${pts(i.winHeld !== null && i.winNot !== null ? i.winHeld - i.winNot : null)})`).join('; ')}.`
    : 'No item passes the dominance thresholds.');
  const dead = b.items.filter((i) => i.dead);
  out.push(dead.length ? `Dead items (${dead.length}): ${dead.map((i) => `${i.id} (top ${pct(i.heldTop)}, random ${pct(i.heldControl)})`).join('; ')}.` : 'No modelled item is dead.');
  const domC = b.combos.filter((c) => c.dominant), never = b.combos.filter((c) => !c.unmodelled && c.formTop === 0);
  if (domC.length) out.push(`Dominant combos: ${domC.map((c) => `${c.id} (${pct(c.formTop)} of top builds vs ${pct(c.formControl)})`).join('; ')}.`);
  if (never.length) out.push(`Combos no top build formed (${never.length}): ${never.map((c) => c.id).join(', ')}.`);
  const domS = b.sets.filter((s) => s.dominant);
  if (domS.length) out.push(`Dominant sets: ${domS.map((s) => `${s.id} (${pct(s.formTop)} of top builds vs ${pct(s.formControl)})`).join('; ')}.`);
  const dormant = b.reactions.filter((r) => r.totalTop === 0);
  if (dormant.length) out.push(`Reactions that never fired in the top builds: ${dormant.map((r) => r.id).join(', ')}.`);
  const busy = [...b.reactions].sort((x, y) => y.perRunTop - x.perRunTop)[0];
  if (busy && busy.totalTop > 0) out.push(`Most frequent reaction in the top builds: ${busy.id} (${busy.perRunTop.toFixed(2)} per run, ${busy.perRunControl.toFixed(2)} per run in random builds).`);
  const weakStarters = b.starters.filter((s) => s.bestWinRate < g.top.winRate / 2);
  if (b.starters.length > 1) out.push(`Best win rate per starter: ${b.starters.map((s) => `${s.starter} ${pct(s.bestWinRate)}`).join(', ')}${weakStarters.length ? `; far below the rest: ${weakStarters.map((s) => s.starter).join(', ')}` : ''}.`);
  out.push(`Not modelled by the proxy (read their rows as "unknown", not "dead"): ${Object.keys(b.unmodelledItems).join(', ')}.`);
  return out;
}

const esc = (s: string | number | null): string => (s === null ? '-' : String(s));
const table = (head: string[], rows: (string | number | null)[][]): string => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');

/** The Markdown report (tables render on GitHub). */
export function toMarkdown(b: Balance): string {
  const o = b.options, g = b.groups, C = b.config;
  const L: string[] = [];
  L.push(`# Build-lab balance report: ${b.name}`, '');
  L.push(`Evolution seed ${o.seed}, population ${o.pop}, ${o.gens} generations, ${o.seedsPerEval} training runs per genome, starters ${o.starters.join('/')}, weapons ${o.weapons.join('/')}, shift ${o.shift}, theme ${o.theme}, pool ${o.pool}. Took ${(b.durationMs / 1000).toFixed(1)} s. Numbers come from the combat proxy (see docs/buildlab.md): compare them with each other, do not read them as absolute balance.`, '');
  L.push('## Findings', '', ...b.findings.map((f) => `- ${f}`), '');
  L.push('## Held-out results', '', table(['group', 'genomes', 'runs', 'win rate', 'avg aisle'], [
    ['top (hall of fame)', g.top.genomes, g.top.runs, pct(g.top.winRate), g.top.avgAisle.toFixed(2)],
    ['random genomes (control)', g.control.genomes, g.control.runs, pct(g.control.winRate), g.control.avgAisle.toFixed(2)],
    ['greedy', 1, g.greedy.runs, pct(g.greedy.winRate), g.greedy.avgAisle.toFixed(2)],
  ]), '');
  L.push(`Best single genome: ${g.bestSingle.label}, held-out win ${pct(g.bestSingle.winRate)}, average aisle ${g.bestSingle.avgAisle.toFixed(2)}, fitness ${g.bestSingle.heldFitness}${g.bestSingle.trainFitness !== undefined ? ` (training fitness ${g.bestSingle.trainFitness})` : ''}. A big gap between training and held-out fitness means the genome overfits its training seeds.`, '');
  L.push('## Evolution', '', table(['gen', 'best', 'mean', 'best win rate', 'best avg aisle', 'evaluated'], b.generations.map((x) => [x.gen, x.best.toFixed(3), x.mean.toFixed(3), pct(x.bestWinRate), x.bestAvgAisle.toFixed(2), x.evaluated])), '');
  L.push('## Items', '', `Held = in the cart at the end of the run. Lift = held rate in top builds / held rate in random builds. **dominant**: held in at least ${pct(C.dominantHeld)} of top builds, lift at least ${C.dominantLift}, win rate when held no lower than when not (margin ${C.dominantWinLift * 100} points) (checked when at least ${C.minSample} top runs hold it). **dead**: held in at most ${pct(C.deadHeld)} of top builds although random builds hold it at least ${pct(C.deadControlMin)}. Unmodelled items are never flagged.`, '');
  L.push(table(['item', 'held top', 'held random', 'held greedy', 'lift', 'acquired top', 'win held', 'win not held', 'damage share', 'flag'], b.items.map((i) => [
    i.id, pct(i.heldTop), pct(i.heldControl), pct(i.heldGreedy), i.lift === null ? '-' : i.lift.toFixed(2), pct(i.pickTop), pct(i.winHeld), pct(i.winNot), i.damageShare === null ? '-' : pct(i.damageShare),
    i.dominant ? '**dominant**' : i.dead ? '**dead**' : i.modelled ? '' : 'unmodelled',
  ])), '');
  L.push('Unmodelled items (the proxy has no player movement, dash or pickup radius, so these do nothing there; their rows say nothing about their real strength):', '', ...Object.entries(b.unmodelledItems).map(([k, v]) => `- ${k}: ${v}`), '');
  L.push('## Combos', '', 'Formed = active in the final cart. Win lift = win rate when formed minus when not (top runs).', '', table(['combo', 'formed top', 'formed random', 'win formed', 'win not', 'win lift', 'flag'], b.combos.map((c) => [c.id, pct(c.formTop), pct(c.formControl), pct(c.winHeld), pct(c.winNot), pts(c.winLift), c.dominant ? '**dominant**' : c.unmodelled ? `unmodelled (${c.unmodelled})` : ''])), '');
  L.push('## Sets', '', 'Level 1/2/3 columns: share of top builds that reach the level at the end.', '', table(['set', 'lvl 1', 'lvl 2', 'lvl 3', 'formed random', 'win lift', 'flag'], b.sets.map((s) => [s.id, pct(s.levels![0]), pct(s.levels![1]), pct(s.levels![2]), pct(s.formControl), pts(s.winLift), s.dominant ? '**dominant**' : ''])), '');
  L.push('## Reactions', '', table(['reaction', 'total (top runs)', 'per run top', 'per run random'], b.reactions.map((r) => [r.id, r.totalTop, r.perRunTop, r.perRunControl])), '');
  L.push('## Starters', '', table(['starter', 'top runs', 'best win rate', 'best avg aisle', 'greedy win rate', 'greedy avg aisle'], b.starters.map((s) => [s.starter, s.runs, pct(s.bestWinRate), s.bestAvgAisle.toFixed(2), pct(s.greedyWinRate), s.greedyAvgAisle.toFixed(2)])), '');
  L.push(`## Top ${b.builds.length} final builds`, '');
  for (const x of b.builds) L.push(`${x.rank}. **${x.starter}** (${x.weapon} weapon, genome ${x.label}): ${x.result}. Cart ${x.cart}, ${x.maxHp} max hp.`, `   - Cart: ${x.items || '-'}`, `   - Shelf: ${x.shelf || '-'}`, `   - Combos: ${x.combos || '-'}; sets: ${x.sets || '-'}`);
  L.push('', '## What the optimizer changed', '', 'Rule parameters of the top genomes against the greedy values (item, combo and set weights are in the JSON).', '', table(['parameter', 'greedy', 'top median', 'top min', 'top max'], b.thresholds.map((t) => [t.key, t.greedy, t.topMedian, t.topMin, t.topMax])), '');
  return L.join('\n');
}

