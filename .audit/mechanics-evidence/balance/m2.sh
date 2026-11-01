#!/bin/bash
# m2.sh <tag>: Day stock seeds 1 and 2 in parallel, one summary line each plus the pooled win rate and aisle-4 share.
B=/private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/balance
W=/Users/scholzf/dev/goblin_grocery/.claude/worktrees/balance
cd $W
for s in 1 2; do npm run buildlab -- --runs 50 --seed $s --starter all --weapon all --pool stock --shift ${SHIFT:-0} --quiet --out $B/$1-d$s.json >/dev/null 2>&1 & done; wait
python3 - "$B/$1-d1.json" "$B/$1-d2.json" <<'PY'
import json, sys
runs = [x for f in sys.argv[1:] for x in json.load(open(f))['runs']]
dead = [x for x in runs if x['result'] != 'win']
n = len(runs); w = n - len(dead); a4 = sum(1 for x in dead if x.get('diedAt') == 4)
items = lambda x: x['finalBuild']['items'] + x['finalBuild']['shelf']
reached = lambda k: sum(1 for x in runs if (8 if x['result'] == 'win' else x.get('diedAt', x['aislesPlayed'])) >= k)
rate = ' '.join('%d:%.0f%%' % (k, 100 * sum(1 for x in dead if x.get('diedAt') == k) / max(1, reached(k))) for k in range(3, 9))
print('%s pooled %d runs: win %.1f%% (SE %.1f) | a4 share %.1f%% | merges %.2f combos %.2f ★3 %.2f | death rate %s' % (sys.argv[1].split('/')[-1][:-8], n, 100 * w / n, 100 * (w / n * (1 - w / n) / n) ** 0.5, 100 * a4 / len(dead), sum(x['merges'] for x in runs) / n, sum(len(x['finalBuild']['combos']) for x in runs) / n, sum(1 for x in runs for i in items(x) if i['tier'] >= 3) / n, rate))
PY
