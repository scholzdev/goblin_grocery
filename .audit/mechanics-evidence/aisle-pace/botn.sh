#!/bin/bash
# botn.sh <tag> <n> [url]: n single-run bot processes in parallel against one dev server (a run stops once it enters aisle 3).
S=/private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/aisle-pace
N=${2:-3}; URL=${3:-http://localhost:5181/}
cd $S
for i in $(seq 0 $((N-1))); do node botrun.mjs $URL 1 > $S/bot-$1-$i.log 2>&1 & done; wait
for i in $(seq 0 $((N-1))); do echo "== $1 #$i"; sed "s/^run 0:/run $i:/" $S/bot-$1-$i.log | grep -v "door:"; done
