// Balance targets over build-lab reports: `node targets.ts <worktree> <report.json>...`. Goal shares use <worktree>'s UNLOCKS.
import { readFileSync } from 'node:fs';

const [wt, ...files] = process.argv.slice(2);
const { UNLOCKS } = await import(`${wt}/src/data/unlocks.ts`);
const WEAPONS = 'blender cooker fizz laser leafblower mop microwave popcorn nailgun pan spray snowcone toaster vacuum'.split(' ');
const SETS = ['kitchen', 'cleaning', 'tools', 'snacks', 'checkout', 'heat', 'frost', 'blast', 'electric'];

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
const add = (a: Record<string, number>, b: Record<string, number>) => { for (const k in b) a[k] = (a[k] ?? 0) + b[k]; return a; };

for (const file of files) {
  const rep = JSON.parse(readFileSync(file, 'utf8'));
  const runs: any[] = rep.runs, n = runs.length;
  const won = (r: any) => r.result === 'win';
  const wins = runs.filter(won).length;
  const sum = (f: (r: any) => number) => runs.reduce((a, r) => a + f(r), 0);
  const deaths = runs.filter((r) => !won(r));
  const diedIn = (k: number) => deaths.filter((r) => r.diedAt === k).length;
  const hpLost = (k: number) => { const xs = runs.flatMap((r) => r.aisles.filter((a: any) => a.aisle === k && a.kind !== 'stockroom')); return xs.reduce((a, x) => a + x.damageTaken, 0) / (xs.length || 1); };
  const items = (r: any) => [...r.finalBuild.items, ...r.finalBuild.shelf];
  console.log(`\n## ${file.split('/').pop()}  (${n} runs, pool ${rep.meta.pool}, shift ${rep.meta.shift}, rev ${rep.meta.gitRev})`);
  console.log(`win ${pct(wins, n)} | merges ${(sum((r) => r.merges) / n).toFixed(2)} | combos ${(sum((r) => r.finalBuild.combos.length) / n).toFixed(2)} | ★3 ${(sum((r) => items(r).filter((i: any) => i.tier >= 3).length) / n).toFixed(2)} | a4 death share ${pct(diedIn(4), deaths.length)}`);
  console.log(`deaths by aisle ${[1, 2, 3, 4, 5, 6, 7, 8].map((k) => `${k}:${pct(diedIn(k), deaths.length)}`).join(' ')}`);
  console.log(`HP lost by aisle ${[1, 2, 3, 4, 5, 6, 7, 8].map((k) => `${k}:${hpLost(k).toFixed(2)}`).join(' ')}`);
  const by = (key: (r: any) => string[]) => {
    const m = new Map<string, { n: number; w: number }>();
    for (const r of runs) for (const k of new Set(key(r))) { const e = m.get(k) ?? { n: 0, w: 0 }; e.n++; if (won(r)) e.w++; m.set(k, e); }
    return [...m].sort((a, b) => b[1].n - a[1].n).map(([k, e]) => `${k} ${pct(e.w, e.n)} (${e.n})`).join(' | ');
  };
  console.log(`by start weapon: ${by((r) => [r.weapon])}`);
  console.log(`by starter: ${by((r) => [r.starter])}`);
  console.log(`by final weapon: ${by((r) => r.finalBuild.items.map((i: any) => i.id).filter((id: string) => WEAPONS.includes(id)))}`);
  const dmg: Record<string, number> = {};
  for (const r of runs) for (const a of r.aisles) if (a.damage) add(dmg, a.damage.bySource);
  const tot = Object.values(dmg).reduce((a, b) => a + b, 0);
  console.log(`damage share: ${Object.entries(dmg).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${k} ${pct(v, tot)}`).join(' ')}`);
  console.log(`sets L2/L3 at end: ${SETS.map((s) => `${s} ${pct(runs.filter((r) => (r.finalBuild.sets[s] ?? 0) >= 2).length, n)}/${pct(runs.filter((r) => (r.finalBuild.sets[s] ?? 0) >= 3).length, n)}`).join(' ')}`);
  const summaries = runs.map((r) => ({
    won: won(r), wave: r.aislesPlayed, starter: r.starter, weapon: r.weapon, theme: r.theme, shift: r.shift, daily: false,
    kills: r.kills, coins: r.coinsEarned,
    sets: Object.fromEntries(SETS.map((s) => [s, r.finalBuild.sets[s] ?? 0])), combos: r.finalBuild.combos, weapons: r.aisles.at(-1).weapons,
    maxTier: Math.max(1, ...r.finalBuild.items.map((i: any) => i.tier)),
    reactions: r.aisles.reduce((a: any, x: any) => add(a, x.damage?.reactions ?? {}), {}), damageByType: r.aisles.reduce((a: any, x: any) => add(a, x.damage?.byType ?? {}), {}), damageByWeapon: {},
  }));
  const goals = UNLOCKS.filter((u: any) => u.type === 'goal').map((u: any) => `${u.id}>=${u.target} ${pct(summaries.filter((s) => u.measure(s) >= u.target).length, n)}`);
  console.log(`goals: ${goals.join(' | ')}`);
}
