import type { Bar } from "./data";
import type { Series } from "./indicator-model";

const blank = (length: number): Series => new Array(length).fill(null);

/** Runs `fn` on the part of `values` that has started, then pads the result back to the full length. */
const trimmed = (values: Series, fn: (inner: number[], start: number) => Series): Series => {
  const start = values.findIndex((v) => v !== null && Number.isFinite(v));
  if (start < 0) return blank(values.length);
  const inner = fn(values.slice(start) as number[], start);
  return [...blank(start), ...inner];
};

export const sma = (values: Series, length: number): Series =>
  trimmed(values, (v) => {
    const out = blank(v.length);
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
      sum += v[i];
      if (i >= length) sum -= v[i - length];
      if (i >= length - 1) out[i] = sum / length;
    }
    return out;
  });

export const ema = (values: Series, length: number): Series =>
  trimmed(values, (v) => {
    const out = blank(v.length);
    if (v.length < length) return out;
    const k = 2 / (length + 1);
    let prev = 0;
    for (let i = 0; i < length; i++) prev += v[i];
    prev /= length;
    out[length - 1] = prev;
    for (let i = length; i < v.length; i++) {
      prev = v[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  });

/** Wilder's smoothing, also called RMA or SMMA. */
export const rma = (values: Series, length: number): Series =>
  trimmed(values, (v) => {
    const out = blank(v.length);
    if (v.length < length) return out;
    let prev = 0;
    for (let i = 0; i < length; i++) prev += v[i];
    prev /= length;
    out[length - 1] = prev;
    for (let i = length; i < v.length; i++) {
      prev = (prev * (length - 1) + v[i]) / length;
      out[i] = prev;
    }
    return out;
  });

export const wma = (values: Series, length: number): Series =>
  trimmed(values, (v) => {
    const out = blank(v.length);
    const weights = (length * (length + 1)) / 2;
    for (let i = length - 1; i < v.length; i++) {
      let sum = 0;
      for (let j = 0; j < length; j++) sum += v[i - j] * (length - j);
      out[i] = sum / weights;
    }
    return out;
  });

export const vwma = (values: Series, volumes: number[], length: number): Series => {
  const out = blank(values.length);
  const start = values.findIndex((v) => v !== null);
  if (start < 0) return out;
  for (let i = start + length - 1; i < values.length; i++) {
    let num = 0;
    let den = 0;
    for (let j = 0; j < length; j++) {
      num += (values[i - j] as number) * volumes[i - j];
      den += volumes[i - j];
    }
    out[i] = den === 0 ? (values[i] as number) : num / den;
  }
  return out;
};

/** Population standard deviation, the way TradingView's `ta.stdev` computes it. */
export const stdev = (values: Series, length: number): Series =>
  trimmed(values, (v) => {
    const out = blank(v.length);
    for (let i = length - 1; i < v.length; i++) {
      let mean = 0;
      for (let j = 0; j < length; j++) mean += v[i - j];
      mean /= length;
      let variance = 0;
      for (let j = 0; j < length; j++) variance += (v[i - j] - mean) ** 2;
      out[i] = Math.sqrt(variance / length);
    }
    return out;
  });

export const rsi = (src: number[], length: number): Series => {
  const out = blank(src.length);
  if (src.length <= length) return out;
  const level = (up: number, down: number) => (down === 0 ? 100 : up === 0 ? 0 : 100 - 100 / (1 + up / down));
  let up = 0;
  let down = 0;
  for (let i = 1; i <= length; i++) {
    const change = src[i] - src[i - 1];
    up += Math.max(change, 0);
    down += Math.max(-change, 0);
  }
  up /= length;
  down /= length;
  out[length] = level(up, down);
  for (let i = length + 1; i < src.length; i++) {
    const change = src[i] - src[i - 1];
    up = (up * (length - 1) + Math.max(change, 0)) / length;
    down = (down * (length - 1) + Math.max(-change, 0)) / length;
    out[i] = level(up, down);
  }
  return out;
};

export type MaType = "none" | "sma" | "smabb" | "ema" | "smma" | "wma" | "vwma";

export const MA_TYPES = [
  { value: "none", label: "None" },
  { value: "sma", label: "SMA" },
  { value: "smabb", label: "SMA + Bollinger Bands" },
  { value: "ema", label: "EMA" },
  { value: "smma", label: "SMMA (RMA)" },
  { value: "wma", label: "WMA" },
  { value: "vwma", label: "VWMA" },
];

export const movingAverage = (type: Exclude<MaType, "none">, values: Series, volumes: number[], length: number): Series => {
  switch (type) {
    case "ema":
      return ema(values, length);
    case "smma":
      return rma(values, length);
    case "wma":
      return wma(values, length);
    case "vwma":
      return vwma(values, volumes, length);
    default:
      return sma(values, length);
  }
};

export interface Smoothing {
  ma: Series;
  upper: Series;
  lower: Series;
}

/** The "SMOOTHING" block TradingView adds under most oscillators and moving averages. */
export const smooth = (type: MaType, values: Series, volumes: number[], length: number, mult: number): Smoothing => {
  if (type === "none") return { ma: blank(values.length), upper: blank(values.length), lower: blank(values.length) };
  const ma = movingAverage(type === "smabb" ? "sma" : type, values, volumes, length);
  if (type !== "smabb") return { ma, upper: blank(values.length), lower: blank(values.length) };
  const dev = stdev(values, length);
  return {
    ma,
    upper: ma.map((m, i) => (m === null || dev[i] === null ? null : m + (dev[i] as number) * mult)),
    lower: ma.map((m, i) => (m === null || dev[i] === null ? null : m - (dev[i] as number) * mult)),
  };
};

export const TIMEFRAMES = [
  { value: "chart", label: "Chart" },
  { value: "60", label: "1 minute" },
  { value: "180", label: "3 minutes" },
  { value: "300", label: "5 minutes" },
  { value: "900", label: "15 minutes" },
  { value: "1800", label: "30 minutes" },
  { value: "3600", label: "1 hour" },
  { value: "7200", label: "2 hours" },
  { value: "14400", label: "4 hours" },
  { value: "86400", label: "1 day" },
  { value: "604800", label: "1 week" },
  { value: "2592000", label: "1 month" },
];

const MONTH = 2592000;
const WEEK = 604800;

/** Which higher-timeframe bar a chart bar belongs to. */
const bucketOf = (time: number, tf: number) => {
  if (tf >= MONTH) {
    const d = new Date(time * 1000);
    return d.getUTCFullYear() * 12 + d.getUTCMonth();
  }
  // Weeks start on Monday; the epoch was a Thursday.
  if (tf === WEEK) return Math.floor((time - 4 * 86400) / WEEK);
  return Math.floor(time / tf);
};

/**
 * Runs `fn` on bars of a higher timeframe and spreads the results back over the chart's bars.
 * With `wait`, a higher bar's value shows only once that bar has closed (no repainting).
 */
export const onTimeframe = <T extends Record<string, Series>>(bars: Bar[], tf: number, wait: boolean, fn: (htf: Bar[]) => T): T => {
  const buckets: Bar[] = [];
  const index: number[] = [];
  const last: boolean[] = [];
  bars.forEach((bar, i) => {
    const key = bucketOf(bar.time, tf);
    const prevKey = i > 0 ? bucketOf(bars[i - 1].time, tf) : null;
    if (prevKey !== key) buckets.push({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
    else {
      const b = buckets[buckets.length - 1];
      b.high = Math.max(b.high, bar.high);
      b.low = Math.min(b.low, bar.low);
      b.close = bar.close;
      b.volume += bar.volume;
    }
    index.push(buckets.length - 1);
    last.push(i === bars.length - 1 ? false : bucketOf(bars[i + 1].time, tf) !== key);
  });
  const result = fn(buckets);
  return Object.fromEntries(
    Object.entries(result).map(([id, values]) => [
      id,
      bars.map((_, i) => {
        const b = index[i];
        if (!wait) return values[b] ?? null;
        return last[i] ? (values[b] ?? null) : (values[b - 1] ?? null);
      }),
    ]),
  ) as T;
};
