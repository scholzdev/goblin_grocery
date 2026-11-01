# patch.py <file> <old>=><new> ...: exact one-occurrence replacements (an experiment knob).
import sys
p = sys.argv[1]; s = open(p).read()
for arg in sys.argv[2:]:
  a, b = arg.split('=>')
  assert s.count(a) == 1, (a, s.count(a)); s = s.replace(a, b)
open(p, 'w').write(s)
