// Test Lab damage meter: a pure reader of the run's damage totals. It is fed `(timeSeconds, total damage, damage per source)` and keeps its own baseline,
// so it never touches the run. The clock is the run's own combat clock (`stats.timeSeconds`), which stands still while paused or in the shop.

/** Length of the rolling window, in seconds. */
export const METER_WINDOW = 5;

export interface MeterReading {
  /** Damage since the last reset. */
  total: number;
  /** Damage of the last `METER_WINDOW` seconds per second (the window is shorter at the start of a fight, never below one second). */
  rolling: number;
  /** Total over the time from the first to the last hit (at least one second). */
  average: number;
  /** Highest `rolling` seen since the reset, once the fight is a second old. */
  peak: number;
  /** Seconds from the first hit to now. */
  seconds: number;
  /** Damage per source (the `damageByWeapon` keys) since the reset, biggest first. */
  sources: [string, number][];
}

interface Sample { t: number; total: number }

export class DpsMeter {
  private baseTotal = 0;
  private baseBy: Record<string, number> = {};
  private by: Record<string, number> = {};
  private samples: Sample[] = [];
  private first = -1;
  private last = -1;
  private now = 0;
  private cur = 0;
  private peak = 0;

  /** Starts counting from these totals. */
  reset(t: number, total: number, by: Record<string, number>): void {
    this.baseTotal = total;
    this.baseBy = { ...by };
    this.by = { ...by };
    this.samples = [{ t, total }];
    this.first = this.last = -1;
    this.now = t;
    this.cur = total;
    this.peak = 0;
  }

  /** Takes the run's current totals; a clock or total that went backwards (a new run) restarts the meter. */
  observe(t: number, total: number, by: Record<string, number>): void {
    if (!this.samples.length || t < this.now || total < this.cur) { this.reset(t, total, by); return; }
    if (total > this.cur) {
      if (this.first < 0) this.first = this.now;
      this.last = t;
    }
    this.now = t;
    this.cur = total;
    this.by = by;
    this.samples.push({ t, total });
    while (this.samples.length > 2 && this.samples[1].t <= t - METER_WINDOW) this.samples.shift();
    if (this.first >= 0 && t - this.first >= 1) this.peak = Math.max(this.peak, this.rolling());
  }

  private rolling(): number {
    if (this.first < 0) return 0;
    const from = this.samples[0];
    const span = Math.min(METER_WINDOW, Math.max(1, this.now - this.first));
    const inside = from.t < this.now - METER_WINDOW ? this.cur - interpolate(this.samples, this.now - METER_WINDOW) : this.cur - from.total;
    return inside / span;
  }

  read(): MeterReading {
    const total = this.cur - this.baseTotal;
    const sources = Object.entries(this.by)
      .map(([k, v]): [string, number] => [k, v - (this.baseBy[k] ?? 0)])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    return {
      total,
      rolling: this.rolling(),
      average: this.first < 0 ? 0 : total / Math.max(1, this.last - this.first),
      peak: this.peak,
      seconds: this.first < 0 ? 0 : this.now - this.first,
      sources,
    };
  }
}

/** Total damage at time `t` between the two samples around it. */
function interpolate(samples: Sample[], t: number): number {
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (b.t >= t) return b.t === a.t ? b.total : a.total + ((b.total - a.total) * (t - a.t)) / (b.t - a.t);
  }
  return samples[samples.length - 1].total;
}
