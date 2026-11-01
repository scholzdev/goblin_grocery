#!/bin/bash
# tsvrows.sh <sha>...: for each commit, Day seeds 1 and 2, Evening and Late seed 1 (stock pool, 600 runs each) in a scratch worktree;
# prints one TSV metric block per commit: day_win_s1, day_win_s2, deaths_a4..a7 (death rate among runs that reached it, seed 1), eve_win, late_win, a4 share.
B=/private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/balance
WT=$B/wt
[ -d $WT ] || { git -C /Users/scholzf/dev/goblin_grocery worktree add -q --detach $WT HEAD && ln -s /Users/scholzf/dev/goblin_grocery/node_modules $WT/node_modules; }
for sha in "$@"; do
  git -C $WT checkout -q --detach $sha
  cd $WT
  run() { npm run buildlab -- --runs 50 --seed $1 --starter all --weapon all --pool stock --shift $2 --quiet --out $B/tsv-$sha-$3.json >/dev/null 2>&1; }
  run 1 0 d1 & run 2 0 d2 & run 1 1 e1 & run 1 2 l1 & wait
  python3 - $B/tsv-$sha <<'PY'
import json, sys
p = sys.argv[1]
L = lambda k: json.load(open(f'{p}-{k}.json'))['runs']
win = lambda rs: '%.1f%%' % (100 * sum(x['result'] == 'win' for x in rs) / len(rs))
d1 = L('d1')
reach = lambda rs, k: sum(1 for x in rs if (8 if x['result'] == 'win' else x.get('diedAt', x['aislesPlayed'])) >= k)
died = lambda rs, k: sum(1 for x in rs if x['result'] != 'win' and x.get('diedAt') == k)
rates = ['%.0f%%' % (100 * died(d1, k) / reach(d1, k)) for k in (4, 5, 6, 7)]
dead = sum(1 for x in d1 if x['result'] != 'win')
print('\t'.join([p.split('tsv-')[1], win(d1), win(L('d2')), *rates, win(L('e1')), win(L('l1')), 'a4 share %.1f%%' % (100 * died(d1, 4) / dead)]))
PY
done
