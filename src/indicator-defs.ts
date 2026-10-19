import type { Bar } from "./data";
import { SOURCES, pickSource, type ComputeResult, type IndicatorSpec, type InputDef, type InputValues, type Marker, type PlotDef, type Series, type PriceSource } from "./indicator-model";
import { MA_TYPES, TIMEFRAMES, ema, onTimeframe, rsi, sma, smooth, wma, type MaType } from "./indicator-math";

const sourceInput = (): InputDef => ({
  id: "source",
  label: "Source",
  type: "select",
  default: "close",
  options: SOURCES.map((s) => ({ value: s.id, label: s.label })),
});

const smoothingInputs = (type: MaType): InputDef[] => [
  { id: "smoothType", label: "Type", type: "select", section: "SMOOTHING", default: type, options: MA_TYPES },
  { id: "smoothLength", label: "Length", type: "int", default: 14, min: 1, max: 5000, enabled: (v) => v.smoothType !== "none" },
  {
    id: "bbMult",
    label: "BB StdDev",
    type: "float",
    default: 2,
    min: 0.001,
    max: 50,
    step: 0.1,
    tooltip: "Only applies when 'SMA + Bollinger Bands' is selected. Sets the standard deviation multiplier for the bands.",
    enabled: (v) => v.smoothType === "smabb",
  },
];

const calculationInputs = (): InputDef[] => [
  { id: "timeframe", label: "Timeframe", type: "select", section: "CALCULATION", default: "chart", options: TIMEFRAMES },
  {
    id: "waitClose",
    label: "Wait for timeframe closes",
    type: "bool",
    default: true,
    tooltip: "Show a higher-timeframe value only once that bar has closed, so the line does not repaint.",
    enabled: (v) => v.timeframe !== "chart",
  },
];

const smoothingPlots = (label: string): PlotDef[] => [
  { id: "smooth", name: label, color: "#fdd835", active: (v) => v.smoothType !== "none" },
  { id: "bbUpper", name: "Upper Bollinger Band", color: "#089981", active: (v) => v.smoothType === "smabb" },
  { id: "bbLower", name: "Lower Bollinger Band", color: "#089981", active: (v) => v.smoothType === "smabb" },
];

const num = (values: InputValues, id: string) => Math.max(1, Math.floor(Number(values[id]) || 1));

/** A timeframe input the chart can honour: a higher one than the chart's own resolution. */
const higherTimeframe = (values: InputValues, resolutionSec: number) => {
  const tf = Number(values.timeframe);
  return Number.isFinite(tf) && tf > resolutionSec ? tf : null;
};

const run = (bars: Bar[], values: InputValues, resolutionSec: number, fn: (bars: Bar[]) => Record<string, Series>): Record<string, Series> => {
  const tf = higherTimeframe(values, resolutionSec);
  return tf ? onTimeframe(bars, tf, values.waitClose !== false, fn) : fn(bars);
};

const maSpec = (id: "sma" | "ema" | "wma", name: string, short: string, description: string, average: (values: Series, length: number) => Series): IndicatorSpec => ({
  id,
  name,
  short,
  description,
  pane: "main",
  decimals: null,
  inputs: [
    { id: "length", label: "Length", type: "int", default: 9, min: 1, max: 5000 },
    sourceInput(),
    { id: "offset", label: "Offset", type: "int", default: 0, min: -500, max: 500 },
    ...smoothingInputs("none"),
    ...calculationInputs(),
  ],
  plots: [{ id: "ma", name: short, color: "#2962ff" }, ...smoothingPlots("Smoothing Line")],
  fills: [{ id: "bbFill", name: "Bollinger Bands Background Fill", mode: "band", from: "plot:bbUpper", to: "plot:bbLower", color: "#089981", opacity: 10, active: (v) => v.smoothType === "smabb" }],
  title: (v) => [String(v.length), String(v.source)],
  shift: (v, plot) => (plot === "ma" ? Number(v.offset) || 0 : 0),
  compute(bars, values, resolutionSec): ComputeResult {
    const length = num(values, "length");
    const plots = run(bars, values, resolutionSec, (b) => {
      const source = b.map((bar) => pickSource(bar, values.source as PriceSource));
      const ma = average(source, length);
      const s = smooth(values.smoothType as MaType, ma, b.map((bar) => bar.volume), num(values, "smoothLength"), Number(values.bbMult) || 2);
      return { ma, smooth: s.ma, bbUpper: s.upper, bbLower: s.lower };
    });
    return { plots };
  },
});

/** Regular divergences between price and the oscillator, found from pivots the way TradingView's RSI script does. */
const divergences = (bars: Bar[], osc: Series): Marker[] => {
  const LEFT = 5;
  const RIGHT = 5;
  const RANGE_LOWER = 5;
  const RANGE_UPPER = 60;
  const markers: Marker[] = [];
  let lastLow: { osc: number; price: number; foundAt: number } | null = null;
  let lastHigh: { osc: number; price: number; foundAt: number } | null = null;
  const inRange = (foundAt: number, now: number) => {
    const since = now - (foundAt + 1);
    return since >= RANGE_LOWER && since <= RANGE_UPPER;
  };
  for (let i = LEFT + RIGHT; i < osc.length; i++) {
    const c = i - RIGHT;
    const v = osc[c];
    if (v === null) continue;
    let low = true;
    let high = true;
    for (let j = c - LEFT; j <= c + RIGHT && (low || high); j++) {
      if (j === c) continue;
      const o = osc[j];
      if (o === null) {
        low = false;
        high = false;
        break;
      }
      if (j < c ? o <= v : o < v) low = false;
      if (j < c ? o >= v : o > v) high = false;
    }
    if (low) {
      if (lastLow && v > lastLow.osc && bars[c].low < lastLow.price && inRange(lastLow.foundAt, i)) markers.push({ index: c, position: "belowBar", text: "Bull", color: "#089981" });
      lastLow = { osc: v, price: bars[c].low, foundAt: i };
    }
    if (high) {
      if (lastHigh && v < lastHigh.osc && bars[c].high > lastHigh.price && inRange(lastHigh.foundAt, i)) markers.push({ index: c, position: "aboveBar", text: "Bear", color: "#f23645" });
      lastHigh = { osc: v, price: bars[c].high, foundAt: i };
    }
  }
  return markers;
};

const rsiSpec: IndicatorSpec = {
  id: "rsi",
  name: "Relative Strength Index",
  short: "RSI",
  description: "Momentum oscillator on a 0-100 scale",
  pane: "separate",
  range: [0, 100],
  decimals: 2,
  inputs: [
    { id: "length", label: "RSI Length", type: "int", section: "RSI SETTINGS", default: 14, min: 1, max: 5000 },
    sourceInput(),
    { id: "divergence", label: "Calculate Divergence", type: "bool", default: false, tooltip: "Marks regular bullish and bearish divergences between price and RSI." },
    ...smoothingInputs("sma"),
    ...calculationInputs(),
  ],
  plots: [{ id: "rsi", name: "RSI", color: "#7e57c2" }, ...smoothingPlots("RSI-based MA")],
  levels: [
    { id: "upper", name: "RSI Upper Band", value: 70, color: "#787b86" },
    { id: "middle", name: "RSI Middle Band", value: 50, color: "#787b86", opacity: 50 },
    { id: "lower", name: "RSI Lower Band", value: 30, color: "#787b86" },
  ],
  fills: [
    { id: "bg", name: "RSI Background Fill", mode: "band", from: "level:upper", to: "level:lower", color: "#7e57c2", opacity: 10 },
    { id: "bbFill", name: "Bollinger Bands Background Fill", mode: "band", from: "plot:bbUpper", to: "plot:bbLower", color: "#089981", opacity: 10, active: (v) => v.smoothType === "smabb" },
    { id: "over", name: "Overbought Gradient Fill", mode: "over", from: "plot:rsi", to: "level:upper", color: "#089981", opacity: 40, gradient: { end: 100, color2: "#089981", opacity2: 0 } },
    { id: "under", name: "Oversold Gradient Fill", mode: "under", from: "plot:rsi", to: "level:lower", color: "#f23645", opacity: 40, gradient: { end: 0, color2: "#f23645", opacity2: 0 } },
  ],
  title: (v) => [String(v.length), String(v.source)],
  compute(bars, values, resolutionSec): ComputeResult {
    const length = num(values, "length");
    const plots = run(bars, values, resolutionSec, (b) => {
      const line = rsi(b.map((bar) => pickSource(bar, values.source as PriceSource)), length);
      const s = smooth(values.smoothType as MaType, line, b.map((bar) => bar.volume), num(values, "smoothLength"), Number(values.bbMult) || 2);
      return { rsi: line, smooth: s.ma, bbUpper: s.upper, bbLower: s.lower };
    });
    return { plots, markers: values.divergence ? divergences(bars, plots.rsi) : undefined };
  },
};

export const BUILTIN_SPECS: IndicatorSpec[] = [
  maSpec("sma", "Moving Average", "SMA", "Simple moving average", sma),
  maSpec("ema", "Moving Average Exponential", "EMA", "Exponential moving average", ema),
  maSpec("wma", "Moving Average Weighted", "WMA", "Weighted moving average", wma),
  rsiSpec,
];
