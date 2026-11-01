# Per-aisle combat means for build-lab reports: python3 aisles.py a.json [b.json...]
import json, sys
for f in sys.argv[1:]:
  r = json.load(open(f)); print('##', f.split('/')[-1])
  for k in range(1, 9):
    aa = [a for x in r['runs'] for a in x['aisles'] if a['aisle'] == k and a['kind'] != 'stockroom']
    if not aa: continue
    m = lambda key: sum((a[key] or 0) for a in aa) / len(aa)
    print(k, 'n', len(aa), 'spawned %.1f kills %.1f leftover %.1f coins %.1f dps %.1f secs %.1f hpLost %.2f' % (m('spawned'), m('kills'), m('leftover'), m('coins'), m('dps'), m('seconds'), m('damageTaken')))
  shops = {}
  for x in r['runs']:
    for s in x['shopLog']: shops.setdefault(s['shop'], []).append(s['moneyIn'])
  print('coins at shop', ' '.join('%d:%.1f' % (k, sum(v) / len(v)) for k, v in sorted(shops.items())))
