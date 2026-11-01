#!/bin/bash
# screen.sh <tag> <batches> [stop_wave=2] [n=12]: <batches> x n parallel single-run bots that stop on entering aisle <stop_wave>, then tally.py.
S=/private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/aisle-pace
STOP=${3:-2}; N=${4:-12}; cd $S
for b in $(seq 1 $2); do
  for i in $(seq 0 $((N-1))); do STOP_WAVE=$STOP node botrun.mjs http://localhost:5181/ 1 > $S/scr-$1-$b-$i.log 2>&1 & done; wait
done
python3 $S/tally.py $1 $S/scr-$1-*.log
