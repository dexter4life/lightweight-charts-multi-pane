import { LineSeries } from "lightweight-charts-multi-pane";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts-multi-pane";
import type { Bar } from "./data";
import type { Market } from "./market";

export type VisUnit = "ticks" | "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "ranges";

export interface VisRange {
  on: boolean;
  min: number;
  max: number;
}

export interface Tint {
  color: string;
  /** 0 (clear) to 100 (solid). */
  opacity: number;
}

export interface VolumeParams {
  maLength: number;
  colorByPrevClose: boolean;
  showVolume: boolean;
  growing: Tint;
  falling: Tint;
  showMA: boolean;
  maColor: string;
  maWidth: number;
  /** Decimals shown for values; null keeps the automatic precision. */
  precision: number | null;
  labelsOnScale: boolean;
  valuesInStatus: boolean;
  inputsInStatus: boolean;
  visibility: Record<VisUnit, VisRange>;
}

export const VIS_UNITS: Array<{ id: VisUnit; label: string; limit: number | null }> = [
  { id: "ticks", label: "Ticks", limit: null },
  { id: "seconds", label: "Seconds", limit: 59 },
  { id: "minutes", label: "Minutes", limit: 59 },
  { id: "hours", label: "Hours", limit: 24 },
  { id: "days", label: "Days", limit: 366 },
  { id: "weeks", label: "Weeks", limit: 52 },
  { id: "months", label: "Months", limit: 12 },
  { id: "ranges", label: "Ranges", limit: null },
];

export const defaultVolumeParams = (): VolumeParams => ({
  maLength: 20,
  colorByPrevClose: false,
  showVolume: true,
  growing: { color: "#089981", opacity: 50 },
  falling: { color: "#f23645", opacity: 50 },
  showMA: false,
  maColor: "#2962ff",
  maWidth: 1,
  precision: null,
  labelsOnScale: true,
  valuesInStatus: true,
  inputsInStatus: true,
  visibility: Object.fromEntries(VIS_UNITS.map((u) => [u.id, { on: true, min: 1, max: u.limit ?? 1 }])) as Record<VisUnit, VisRange>,
});

const rgba = (hex: string, opacity: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${(opacity / 100).toFixed(2)})`;
};

/** K/M/B-suffixed number the way the reference prints volume. */
export const formatVolume = (value: number, precision: number | null = null) => {
  const abs = Math.abs(value);
  const pick = (v: number, suffix: string) => {
    if (precision !== null) return `${v.toFixed(precision)}${suffix}`;
    return `${Number(v.toPrecision(3))}${suffix}`;
  };
  if (abs >= 1e9) return pick(value / 1e9, "B");
  if (abs >= 1e6) return pick(value / 1e6, "M");
  if (abs >= 1e3) return pick(value / 1e3, "K");
  return precision !== null ? value.toFixed(precision) : String(Number(value.toPrecision(4)));
};

const STORE = "chart-lab:volume-defaults";

/** Defaults the user saved from the dialog's "Defaults" menu, falling back to the built-ins. */
const loadSavedDefaults = (): VolumeParams => {
  const base = defaultVolumeParams();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    return saved ? { ...base, ...saved, visibility: { ...base.visibility, ...saved.visibility } } : base;
  } catch {
    return base;
  }
};

export const saveVolumeDefaults = (params: VolumeParams) => {
  try {
    localStorage.setItem(STORE, JSON.stringify(params));
  } catch {
    /* storage unavailable */
  }
};

type Listener = () => void;

/** Volume histogram settings plus the optional volume moving-average line; repaints whenever bars or settings change. */
export class VolumeStudy {
  private params = loadSavedDefaults();
  private listeners = new Set<Listener>();
  private ma: ISeriesApi<"Line"> | null = null;
  private maValues: Array<number | null> = [];
  private hiddenByUser = false;
  private unsub: () => void;
  private gone = false;

  constructor(
    private chart: IChartApi,
    private volume: ISeriesApi<"Histogram">,
    private market: Market,
  ) {
    this.unsub = market.subscribe(() => this.refresh());
    this.refresh();
  }

  get data(): VolumeParams {
    return this.params;
  }

  get maSeries() {
    return this.ma;
  }

  get hidden() {
    return this.hiddenByUser;
  }

  /** MA value at a bar index, null when the MA is off or still warming up. */
  maAt(index: number) {
    return this.params.showMA ? (this.maValues[index] ?? null) : null;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  snapshot(): VolumeParams {
    return JSON.parse(JSON.stringify(this.params));
  }

  set(patch: Partial<VolumeParams>) {
    this.params = { ...this.params, ...patch };
    this.refresh();
  }

  replace(next: VolumeParams) {
    this.params = JSON.parse(JSON.stringify(next));
    this.refresh();
  }

  setHidden(hidden: boolean) {
    this.hiddenByUser = hidden;
    this.refresh();
  }

  /** Follows the volume series when the legend moves it between scales. */
  syncScale() {
    if (!this.ma) return;
    const pane = this.volume.getPane().paneIndex();
    if (this.ma.getPane().paneIndex() !== pane) this.ma.moveToPane(pane);
    this.ma.applyOptions({ priceScaleId: this.volume.options().priceScaleId });
  }

  /** True when the resolution is inside the ranges the user allowed. */
  private inRange() {
    const sec = this.market.resolution.sec;
    const v = this.params.visibility;
    const test = (unit: VisUnit, n: number) => v[unit].on && n >= v[unit].min && n <= v[unit].max;
    if (sec < 60) return test("seconds", sec);
    if (sec < 3600) return test("minutes", sec / 60);
    if (sec < 86400) return test("hours", sec / 3600);
    if (sec < 604800) return test("days", sec / 86400);
    if (sec < 2592000) return test("weeks", sec / 604800);
    return test("months", sec / 2592000);
  }

  private colorOf(bar: Bar, prev: Bar | undefined) {
    const p = this.params;
    const up = p.colorByPrevClose && prev ? bar.close >= prev.close : bar.close >= bar.open;
    const tint = up ? p.growing : p.falling;
    return rgba(tint.color, tint.opacity);
  }

  refresh() {
    if (this.gone) return;
    const p = this.params;
    const bars = this.market.bars;
    const live = this.market.status === "loading" ? [] : bars;
    const visible = !this.hiddenByUser && this.inRange();
    const formatter = (value: number) => formatVolume(value, p.precision);
    this.volume.applyOptions({
      visible: visible && p.showVolume,
      lastValueVisible: p.labelsOnScale,
      priceFormat: { type: "custom", formatter, minMove: 0.01 },
    } as never);
    this.volume.setData(live.map((b, i) => ({ time: b.time as Time, value: b.volume, color: this.colorOf(b, bars[i - 1]) })));

    const wantMA = p.showMA && visible;
    if (wantMA && !this.ma) {
      this.ma = this.chart.addSeries(
        LineSeries,
        { priceLineVisible: false, crosshairMarkerVisible: false, title: "", priceScaleId: this.volume.options().priceScaleId },
        this.volume.getPane().paneIndex(),
      );
    }
    if (this.ma) {
      this.syncScale();
      this.ma.applyOptions({
        visible: wantMA,
        color: p.maColor,
        lineWidth: p.maWidth as never,
        lastValueVisible: p.labelsOnScale,
        priceFormat: { type: "custom", formatter, minMove: 0.01 },
      } as never);
      const length = Math.max(1, Math.floor(p.maLength));
      this.maValues = this.sma(live.map((b) => b.volume), length);
      const data: Array<{ time: Time; value: number }> = [];
      this.maValues.forEach((value, i) => {
        if (value !== null) data.push({ time: live[i].time as Time, value });
      });
      this.ma.setData(data);
    }
    this.listeners.forEach((fn) => fn());
  }

  private sma(values: number[], length: number) {
    const out: Array<number | null> = new Array(values.length).fill(null);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= length) sum -= values[i - length];
      if (i >= length - 1) out[i] = sum / length;
    }
    return out;
  }

  /** Drops the MA line; the engine removes the histogram itself. */
  detach() {
    this.gone = true;
    if (this.ma) {
      try {
        this.chart.removeSeries(this.ma);
      } catch {
        /* chart already disposed */
      }
      this.ma = null;
    }
    this.unsub();
  }

  dispose() {
    this.gone = true;
    this.unsub();
    this.listeners.clear();
  }
}
