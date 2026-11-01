#!/bin/bash
# lab.sh <tree> <tag>: the balance unit's build-lab cells in parallel: Day seeds 1 and 2, Evening and Late seed 1 (stock), Day seed 1 starting pool.
S=/private/tmp/claude-501/-Users-scholzf-dev-goblin-grocery/a0007cf2-762c-44b4-85e3-3eb518ab8d10/scratchpad/aisle-pace
cd $1
npm run buildlab -- --runs 50 --seed 1 --starter all --weapon all --pool stock --quiet --out $S/lab-$2-d1.json >$S/lab-$2-d1.log 2>&1 &
npm run buildlab -- --runs 50 --seed 2 --starter all --weapon all --pool stock --quiet --out $S/lab-$2-d2.json >$S/lab-$2-d2.log 2>&1 &
npm run buildlab -- --runs 50 --seed 1 --starter all --weapon all --pool stock --shift 1 --quiet --out $S/lab-$2-e1.json >$S/lab-$2-e1.log 2>&1 &
npm run buildlab -- --runs 50 --seed 1 --starter all --weapon all --pool stock --shift 2 --quiet --out $S/lab-$2-l1.json >$S/lab-$2-l1.log 2>&1 &
npm run buildlab -- --runs 50 --seed 1 --starter all --weapon all --pool starting --quiet --out $S/lab-$2-st.json >$S/lab-$2-st.log 2>&1 &
wait
