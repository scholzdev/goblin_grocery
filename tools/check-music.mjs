// Sanity check for the department music loops: exists, 28-36 s, peak <= 0.95, RMS within 6 dB of each other.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');
const rows = ['main', 'frozen', 'bakery', 'electronics', 'checkout', 'clearance', 'boss'].map((d) => {
  const b = readFileSync(join(dir, `music_${d}.wav`)), n = (b.length - 44) / 2; let pk = 0, sq = 0;
  for (let i = 0; i < n; i++) { const v = b.readInt16LE(44 + i * 2) / 32768; pk = Math.max(pk, Math.abs(v)); sq += v * v; }
  return { track: d, sec: +(n / b.readUInt32LE(24)).toFixed(2), peak: +pk.toFixed(3), rmsDb: +(20 * Math.log10(Math.sqrt(sq / n))).toFixed(1), MB: +(b.length / 1e6).toFixed(2) };
});
console.table(rows);
const rm = rows.map((r) => r.rmsDb);
const bad = rows.filter((r) => r.sec < 28 || r.sec > 36 || r.peak > 0.95);
if (bad.length || Math.max(...rm) - Math.min(...rm) > 6) { console.error('FAIL', bad); process.exit(1); }
console.log('ok');
