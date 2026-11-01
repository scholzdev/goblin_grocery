# paired.py <before-tag> <after-tag>: run-by-run comparison of two m2.sh batches (same seeds): wins lost, wins gained, sign-test z.
import json, sys
def load(tag): return [x['result'] == 'win' for s in (1, 2) for x in json.load(open(f'{sys.argv[3] if len(sys.argv) > 3 else "."}/{tag}-d{s}.json'))['runs']]
a, b = load(sys.argv[1]), load(sys.argv[2])
lost = sum(1 for x, y in zip(a, b) if x and not y); gained = sum(1 for x, y in zip(a, b) if y and not x)
n = lost + gained
print(f'{sys.argv[1]} -> {sys.argv[2]}: {len(a)} paired runs, wins lost {lost}, gained {gained}, net {gained - lost:+d}, sign z {(gained - lost) / max(1, n) ** 0.5:+.2f}')
