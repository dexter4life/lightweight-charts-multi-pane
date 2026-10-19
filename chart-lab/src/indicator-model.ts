import type { Bar } from "./data";
import { VIS_UNITS, type VisRange, type VisUnit } from "./volume-study";

export type PriceSource = "open" | "high" | "low" | "close" | "volume" | "hl2" | "hlc3" | "ohlc4" | "hlcc4";

export const SOURCES: Array<{ id: PriceSource; label: string }> = [
  { id: "open", label: "Open" },
  { id: "high", label: "High" },
  { id: "low", label: "Low" },
  { id: "close", label: "Close" },
  { id: "volume", label: "Volume" },
  { id: "hl2", label: "(H + L)/2" },
  { id: "hlc3", label: "(H + L + C)/3" },
  { id: "ohlc4", label: "(O + H + L + C)/4" },
  { id: "hlcc4", label: "(H + L + C + C)/4" },
];

export const pickSource = (bar: Bar, source: PriceSource): number => {
  switch (source) {
    case "hl2":
      return (bar.high + bar.low) / 2;
    case "hlc3":
      return (bar.high + bar.low + bar.close) / 3;
    case "ohlc4":
      return (bar.open + bar.high + bar.low + bar.close) / 4;
    case "hlcc4":
      return (bar.high + bar.low + bar.close * 2) / 4;
    default:
      return bar[source];
  }
};

export type PlotType = "line" | "linebr" | "stepline" | "histogram" | "area" | "circles";
export type DashStyle = "solid" | "dashed" | "dotted";

export const PLOT_TYPES: Array<{ id: PlotType; label: string }> = [
  { id: "line", label: "Line" },
  { id: "linebr", label: "Line with breaks" },
  { id: "stepline", label: "Step line" },
  { id: "histogram", label: "Histogram" },
  { id: "area", label: "Area" },
  { id: "circles", label: "Circles" },
];

export type InputValue = number | string | boolean;
export type InputValues = Record<string, InputValue>;

export interface Option {
  value: string;
  label: string;
}

export interface InputDef {
  id: string;
  label: string;
  type: "int" | "float" | "select" | "bool";
  default: InputValue;
  /** Heading shown above this input and the ones after it, e.g. "SMOOTHING". */
  section?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Option[];
  tooltip?: string;
  /** False greys the field out for the current values of the other inputs. */
  enabled?: (values: InputValues) => boolean;
}

export interface PlotDef {
  id: string;
  name: string;
  color: string;
  /** 0-100, defaults to opaque. */
  opacity?: number;
  width?: number;
  dash?: DashStyle;
  type?: PlotType;
  /** Plotted only while this holds for the inputs (e.g. the smoothing line). */
  active?: (values: InputValues) => boolean;
}

export interface LevelDef {
  id: string;
  name: string;
  value: number;
  color: string;
  opacity?: number;
  dash?: DashStyle;
}

/** "plot:<id>" or "level:<id>". */
export type FillRef = string;

export interface FillDef {
  id: string;
  name: string;
  /** band: everywhere between the two refs. over/under: only where `from` is above/below `to`. */
  mode: "band" | "over" | "under";
  from: FillRef;
  to: FillRef;
  color: string;
  opacity: number;
  /** Gradient fades to this colour/opacity at `to`, starting from `color` at `gradientEnd`. */
  gradient?: { end: number; color2: string; opacity2: number };
  active?: (values: InputValues) => boolean;
}

export interface Marker {
  index: number;
  position: "aboveBar" | "belowBar";
  text: string;
  color: string;
}

export type Series = Array<number | null>;

export interface ComputeResult {
  plots: Record<string, Series>;
  /** Signals drawn on the main plot. */
  markers?: Marker[];
}

export interface IndicatorSpec {
  id: string;
  name: string;
  short: string;
  /** Name shown in the legend and dialog title when `short` is only a picker code. */
  legend?: string;
  description: string;
  pane: "main" | "separate";
  /** Fixed value range of a separate pane, e.g. [0, 100] for RSI. */
  range?: [number, number];
  /** Decimals of the values in the legend. Null follows the chart. */
  decimals: number | null;
  inputs: InputDef[];
  plots: PlotDef[];
  levels?: LevelDef[];
  fills?: FillDef[];
  /** The input values shown after the name in the legend, e.g. ["9", "close"]. */
  title(values: InputValues): string[];
  /** Bars the plot is displaced by (positive = into the future). */
  shift?(values: InputValues, plotId: string): number;
  compute(bars: Bar[], values: InputValues, resolutionSec: number): Promise<ComputeResult> | ComputeResult;
}

export interface PlotStyle {
  visible: boolean;
  color: string;
  /** 0 (clear) to 100 (solid). */
  opacity: number;
  width: number;
  dash: DashStyle;
  type: PlotType;
  priceLine: boolean;
}

export interface LevelStyle {
  visible: boolean;
  value: number;
  color: string;
  opacity: number;
  width: number;
  dash: DashStyle;
}

export interface FillStyle {
  visible: boolean;
  color: string;
  opacity: number;
  color2: string;
  opacity2: number;
}

export interface IndicatorSettings {
  inputs: InputValues;
  plots: Record<string, PlotStyle>;
  levels: Record<string, LevelStyle>;
  fills: Record<string, FillStyle>;
  /** Decimals shown for values; null keeps the automatic precision. */
  precision: number | null;
  labelsOnScale: boolean;
  valuesInStatus: boolean;
  inputsInStatus: boolean;
  visibility: Record<VisUnit, VisRange>;
}

export const fullVisibility = () =>
  Object.fromEntries(VIS_UNITS.map((u) => [u.id, { on: true, min: 1, max: u.limit ?? 1 }])) as Record<VisUnit, VisRange>;

export const defaultSettings = (spec: IndicatorSpec): IndicatorSettings => ({
  inputs: Object.fromEntries(spec.inputs.map((input) => [input.id, input.default])),
  plots: Object.fromEntries(
    spec.plots.map((p) => [p.id, { visible: true, color: p.color, opacity: p.opacity ?? 100, width: p.width ?? 1, dash: p.dash ?? "solid", type: p.type ?? "line", priceLine: false } satisfies PlotStyle]),
  ),
  levels: Object.fromEntries(
    (spec.levels ?? []).map((l) => [l.id, { visible: true, value: l.value, color: l.color, opacity: l.opacity ?? 100, width: 1, dash: l.dash ?? "dashed" } satisfies LevelStyle]),
  ),
  fills: Object.fromEntries(
    (spec.fills ?? []).map((f) => [f.id, { visible: true, color: f.color, opacity: f.opacity, color2: f.gradient?.color2 ?? f.color, opacity2: f.gradient?.opacity2 ?? f.opacity } satisfies FillStyle]),
  ),
  precision: null,
  labelsOnScale: true,
  valuesInStatus: true,
  inputsInStatus: true,
  visibility: fullVisibility(),
});

export const cloneSettings = (settings: IndicatorSettings): IndicatorSettings => JSON.parse(JSON.stringify(settings));

/** Lays `saved` over the spec's defaults, so settings saved for an older version of an indicator still load. */
export const mergeSettings = (spec: IndicatorSpec, saved: Partial<IndicatorSettings> | null | undefined): IndicatorSettings => {
  const base = defaultSettings(spec);
  if (!saved) return base;
  const layer = <T extends object>(defaults: Record<string, T>, over: Record<string, Partial<T>> | undefined) =>
    Object.fromEntries(Object.entries(defaults).map(([id, value]) => [id, { ...value, ...(over?.[id] ?? {}) }])) as Record<string, T>;
  return {
    inputs: { ...base.inputs, ...Object.fromEntries(Object.entries(saved.inputs ?? {}).filter(([id]) => id in base.inputs)) },
    plots: layer(base.plots, saved.plots),
    levels: layer(base.levels, saved.levels),
    fills: layer(base.fills, saved.fills),
    precision: saved.precision === undefined ? base.precision : saved.precision,
    labelsOnScale: saved.labelsOnScale ?? base.labelsOnScale,
    valuesInStatus: saved.valuesInStatus ?? base.valuesInStatus,
    inputsInStatus: saved.inputsInStatus ?? base.inputsInStatus,
    visibility: { ...base.visibility, ...(saved.visibility ?? {}) },
  };
};

export const rgba = (hex: string, opacity: number) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(opacity) / 100})`;
};

/** True when the resolution is inside the ranges the user allowed (seconds-based resolutions only). */
export const visibleAt = (visibility: Record<VisUnit, VisRange>, sec: number) => {
  const test = (unit: VisUnit, n: number) => visibility[unit].on && n >= visibility[unit].min && n <= visibility[unit].max;
  if (sec < 60) return test("seconds", sec);
  if (sec < 3600) return test("minutes", sec / 60);
  if (sec < 86400) return test("hours", sec / 3600);
  if (sec < 604800) return test("days", sec / 86400);
  if (sec < 2592000) return test("weeks", sec / 604800);
  return test("months", sec / 2592000);
};

export type IntervalVisibility = "all" | "above" | "below" | "only";

const UNIT_ORDER: VisUnit[] = ["seconds", "minutes", "hours", "days", "weeks", "months"];

const unitOf = (sec: number): { unit: VisUnit; n: number } => {
  if (sec < 60) return { unit: "seconds", n: sec };
  if (sec < 3600) return { unit: "minutes", n: Math.round(sec / 60) };
  if (sec < 86400) return { unit: "hours", n: Math.round(sec / 3600) };
  if (sec < 604800) return { unit: "days", n: Math.round(sec / 86400) };
  if (sec < 2592000) return { unit: "weeks", n: Math.round(sec / 604800) };
  return { unit: "months", n: Math.round(sec / 2592000) };
};

/** The "Visibility on intervals" menu: rewrites the Visibility tab around the current resolution. */
export const visibilityFor = (mode: IntervalVisibility, sec: number): Record<VisUnit, VisRange> => {
  const result = fullVisibility();
  if (mode === "all") return result;
  const { unit, n } = unitOf(sec);
  const at = UNIT_ORDER.indexOf(unit);
  UNIT_ORDER.forEach((id, i) => {
    const limit = VIS_UNITS.find((u) => u.id === id)!.limit ?? 1;
    if (i === at) result[id] = { on: true, min: mode === "below" ? 1 : n, max: mode === "above" ? limit : n };
    else result[id] = { ...result[id], on: mode === "only" ? false : mode === "above" ? i > at : i < at };
  });
  return result;
};

/** Which of the three interval modes the settings currently match, or null when customised. */
export const intervalMode = (visibility: Record<VisUnit, VisRange>, sec: number): IntervalVisibility | null => {
  const same = (a: Record<VisUnit, VisRange>, b: Record<VisUnit, VisRange>) => UNIT_ORDER.every((u) => a[u].on === b[u].on && (!a[u].on || (a[u].min === b[u].min && a[u].max === b[u].max)));
  return (["all", "above", "below", "only"] as const).find((mode) => same(visibility, visibilityFor(mode, sec))) ?? null;
};

const DEFAULTS_KEY = "chart-lab:indicator-defaults:";

export const loadSavedSettings = (kind: string): Partial<IndicatorSettings> | null => {
  try {
    return JSON.parse(localStorage.getItem(DEFAULTS_KEY + kind) ?? "null");
  } catch {
    return null;
  }
};

export const saveSettingsAsDefault = (kind: string, settings: IndicatorSettings) => {
  try {
    localStorage.setItem(DEFAULTS_KEY + kind, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
};

export const clearSavedSettings = (kind: string) => {
  try {
    localStorage.removeItem(DEFAULTS_KEY + kind);
  } catch {
    /* storage unavailable */
  }
};

export const isPlotActive = (def: PlotDef, values: InputValues) => !def.active || def.active(values);
export const isFillActive = (def: FillDef, values: InputValues) => !def.active || def.active(values);
