# tsvcols.py <prefix>...: balance-hillclimb.tsv metric columns from <prefix>-{d1,d2,e1,l1}.json (same formulas as balance/tsvrows.sh).
import json, sys
for p in sys.argv[1:]:
    L = lambda k: json.load(open(f'{p}-{k}.json'))['runs']
    win = lambda rs: '%.1f%%' % (100 * sum(x['result'] == 'win' for x in rs) / len(rs))
    d1 = L('d1')
    reach = lambda rs, k: sum(1 for x in rs if (8 if x['result'] == 'win' else x.get('diedAt', x['aislesPlayed'])) >= k)
    died = lambda rs, k: sum(1 for x in rs if x['result'] != 'win' and x.get('diedAt') == k)
    rates = ['%.0f%%' % (100 * died(d1, k) / reach(d1, k)) for k in (4, 5, 6, 7)]
    dead = sum(1 for x in d1 if x['result'] != 'win')
    print('\t'.join([p.split('/')[-1], win(d1), win(L('d2')), *rates, win(L('e1')), win(L('l1')), 'a4 share %.1f%%' % (100 * died(d1, 4) / dead)]))
