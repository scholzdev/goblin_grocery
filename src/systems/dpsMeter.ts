// Test Lab damage meter: a pure reader of the run's damage totals. It is fed `(timeSeconds, total damage, damage per source)` and keeps its own baseline,
// so it never touches the run. The totals it is fed are the HP enemies really lost (`RunStats.removedByWeapon`), so overkill is not damage. The clock is the run's own combat clock (`stats.timeSeconds`), which stands still while paused or in the shop.

/** Length of the rolling window, in seconds. */
export const METER_WINDOW = 5;

/** A frozen reading: the previous fight ("last") or the one pinned for comparison. */
export interface MeterSummary {
  total: number;
  average: number;
  peak: number;
  seconds: number;
  sources: [string, number][];
}

export interface MeterReading extends MeterSummary {
  /** Damage of the last `METER_WINDOW` seconds per second (the window is shorter at the start of a fight, never below one second). */
  rolling: number;
  /** The fight before this one (a reset or a new fight files the finished one here), once it dealt damage. */
  last: MeterSummary | null;
  pinned: MeterSummary | null;
  /** Average DPS against the pin in whole percent; null without a pin or a fight. */
  vsPin: number | null;
}

interface Sample { t: number; total: number }

export class DpsMeter {
  private baseTotal = 0;
  private baseBy: Record<string, number> = {};
  private by: Record<string, number> = {};
  private samples: Sample[] = [];
  private first = -1;
  private lastHit = -1;
  private now = 0;
  private cur = 0;
  private peak = 0;
  private last: MeterSummary | null = null;
  private pinned: MeterSummary | null = null;

  /** Starts counting from these totals. A fight that dealt damage becomes `last`; the pin stays. */
  reset(t: number, total: number, by: Record<string, number>): void {
    this.last = this.summary() ?? this.last;
    this.baseTotal = total;
    this.baseBy = { ...by };
    this.by = { ...by };
    this.samples = [{ t, total }];
    this.first = this.lastHit = -1;
    this.now = t;
    this.cur = total;
    this.peak = 0;
  }

  /** Takes the run's current totals; a clock or total that went backwards (a new run) restarts the meter. */
  observe(t: number, total: number, by: Record<string, number>): void {
    if (!this.samples.length || t < this.now || total < this.cur) { this.reset(t, total, by); return; }
    if (total > this.cur) {
      if (this.first < 0) this.first = this.now;
      this.lastHit = t;
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

  /** Pins the current fight (once it dealt damage), the previous one, or clears the pin. */
  pin(from: 'live' | 'last' | null): void {
    this.pinned = from === 'live' ? this.summary() ?? this.pinned : from === 'last' ? this.last ?? this.pinned : null;
  }

  /** The fight so far as a frozen reading; null before the first hit. */
  private summary(): MeterSummary | null {
    if (this.first < 0) return null;
    const total = this.cur - this.baseTotal;
    const sources = Object.entries(this.by)
      .map(([k, v]): [string, number] => [k, v - (this.baseBy[k] ?? 0)])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    return { total, average: total / Math.max(1, this.lastHit - this.first), peak: this.peak, seconds: this.now - this.first, sources };
  }

  read(): MeterReading {
    const live = this.summary() ?? { total: 0, average: 0, peak: 0, seconds: 0, sources: [] };
    return { ...live, rolling: this.rolling(), last: this.last, pinned: this.pinned, vsPin: this.first >= 0 ? deltaPct(live.average, this.pinned?.average ?? 0) : null };
  }
}

/** Relative change of `now` against `base` in whole percent; null when there is no base to compare with. */
export const deltaPct = (now: number, base: number): number | null => (base > 0 ? Math.round(((now - base) / base) * 100) : null);

/** Total damage at time `t` between the two samples around it. */
function interpolate(samples: Sample[], t: number): number {
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if (b.t >= t) return b.t === a.t ? b.total : a.total + ((b.total - a.total) * (t - a.t)) / (b.t - a.t);
  }
  return samples[samples.length - 1].total;
}
