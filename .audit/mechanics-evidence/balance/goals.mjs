// Goal-need calibration over build-lab reports (pooled): node goals.mjs a.json [b.json...]. Prints each measure's share at candidate needs.
import { readFileSync } from 'node:fs';
const runs = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).runs);
const sum = (r, f) => r.aisles.reduce((a, x) => a + (f(x) ?? 0), 0);
const won = (r) => r.result === 'win';
const weapons = (r) => r.aisles.at(-1).weapons;
const sets = (r) => r.finalBuild.sets;
const maxSet = (r) => Math.max(0, ...Object.values(sets(r)));
const goals = {
  pricegun: { m: (r) => (won(r) ? sets(r).checkout ?? 0 : 0), needs: [1, 2] },
  'pricegun-any': { m: (r) => sets(r).checkout ?? 0, needs: [1, 2, 3] },
  snowcone: { m: (r) => (won(r) ? sets(r).frost ?? 0 : 0), needs: [1, 2] },
  'snowcone-any': { m: (r) => sets(r).frost ?? 0, needs: [1, 2] },
  leafblower: { m: (r) => (weapons(r) === 1 ? r.aislesPlayed : 0), needs: [3, 4, 5, 6] },
  energy: { m: (r) => r.kills, needs: [200, 220, 250, 280] },
  doublebag: { m: (r) => r.finalBuild.combos.length, needs: [3, 4, 5] },
  goldstar: { m: (r) => Math.max(1, ...r.finalBuild.items.map((i) => i.tier)) - 1, needs: [1, 2] },
  scoby: { m: (r) => Math.floor(sum(r, (a) => a.damage?.byType.poison)), needs: [300, 400, 500, 600, 750, 1000] },
  barter: { m: (r) => r.coinsEarned, needs: [300, 320, 340, 360, 380, 400] },
  binder: { m: maxSet, needs: [2, 3] },
  'binder-won': { m: (r) => (won(r) ? maxSet(r) : 0), needs: [2, 3] },
  'binder-2xL3': { m: (r) => Object.values(sets(r)).filter((v) => v >= 3).length, needs: [1, 2] },
  'binder-3xL2': { m: (r) => Object.values(sets(r)).filter((v) => v >= 2).length, needs: [2, 3, 4] },
  bowlingball: { m: (r) => sum(r, (a) => a.damage?.reactions.shatter), needs: [5, 10, 15, 20, 25] },
  laser: { m: (r) => (won(r) ? weapons(r) : 0), needs: [2, 3, 4] },
  moldybread: { m: (r) => sum(r, (a) => a.damage?.reactions.detonate), needs: [1, 2, 3, 4, 5] },
};
const pct = (n) => `${((100 * n) / runs.length).toFixed(1)}%`;
console.log(`${runs.length} runs, ${pct(runs.filter(won).length)} won`);
for (const [id, g] of Object.entries(goals)) {
  const v = runs.map(g.m);
  console.log(`${id.padEnd(13)} ${g.needs.map((n) => `>=${n}: ${pct(v.filter((x) => x >= n).length)}`).join('  ')}`);
}
