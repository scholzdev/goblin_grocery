#!/bin/bash
# Frozen harness: measure.sh <tag> [full]. Day stock seed 1 always; `full` adds stock seed 2, starting pool, Evening, Late.
set -e
B=/private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/balance
W=/Users/scholzf/dev/goblin_grocery/.claude/worktrees/balance
tag=$1; cd $W
run() { npm run buildlab -- --runs 50 --seed $1 --starter all --weapon all --pool $2 --shift $3 --quiet --out $B/$tag-$4.json >/dev/null 2>&1; }
run 1 stock 0 stock &
files="$B/$tag-stock.json"
if [ "$2" = full ]; then
  run 2 stock 0 stock2 & run 1 starting 0 starting & run 1 stock 1 s1 & run 1 stock 2 s2 &
  files="$files $B/$tag-stock2.json $B/$tag-starting.json $B/$tag-s1.json $B/$tag-s2.json"
fi
wait
node $B/targets.ts $W $files 2>&1 | grep -v ExperimentalWarning
