# tally.py <tag> <log>...: per-config summary of single-run bot logs (aisle reached, deaths by aisle, shop HP, aisle-1 kills, peak alive).
import sys, re
tag, files = sys.argv[1], sys.argv[2:]
die = {1: 0, 2: 0}; reach3 = 0; n = 0; s1 = []; s2 = []; k1 = []; p1 = []; fps = []
for f in files:
    t = open(f).read()
    m = re.search(r"^run 0: (\w+) wave=(\d+).*?fps=(\d+)", t, re.M)
    if not m: continue
    n += 1; fps.append(int(m[3]))
    if m[1] == 'defeat' and int(m[2]) in die: die[int(m[2])] += 1
    if int(m[2]) >= 3: reach3 += 1
    a = re.search(r"shop 1 lv1: hp=(\d+)/\d+.*?peakAlive=(\d+)@.*?kills=(\d+)", t)
    if a: s1.append(int(a[1])); p1.append(int(a[2])); k1.append(int(a[3]))
    b = re.search(r"shop 2 lv1: hp=(\d+)/", t)
    if b: s2.append(int(b[1]))
mean = lambda xs: sum(xs) / len(xs) if xs else float('nan')
print(f"{tag}: runs {n} | die a1 {die[1]}/{n} | die a2 {die[2]}/{n} | reach a3 {reach3}/{n} | shop1 hp mean {mean(s1):.1f} | shop2 hp mean {mean(s2):.1f} | a1 kills {min(k1, default=0)}-{max(k1, default=0)} | a1 peak alive {min(p1, default=0)}-{max(p1, default=0)} | fps min {min(fps, default=0)}")
