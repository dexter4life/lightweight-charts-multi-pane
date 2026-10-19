import { AreaSeries, HistogramSeries, LineSeries, createSeriesMarkers } from "lightweight-charts-multi-pane";
import type { IChartApi, IPriceLine, ISeriesApi, ISeriesMarkersPluginApi, Time } from "lightweight-charts-multi-pane";
import type { Bar } from "./data";
import type { Market } from "./market";
import { BUILTIN_SPECS } from "./indicator-defs";
import {
  SOURCES,
  cloneSettings,
  isFillActive,
  isPlotActive,
  loadSavedSettings,
  mergeSettings,
  pickSource,
  rgba,
  visibilityFor,
  visibleAt,
  type ComputeResult,
  type DashStyle,
  type IndicatorSettings,
  type IndicatorSpec,
  type InputDef,
  type InputValues,
  type IntervalVisibility,
  type PlotDef,
  type PriceSource,
  type Series,
} from "./indicator-model";
import { FillPrimitive } from "./fills";

export { SOURCES, pickSource };
export type { PriceSource };

export type BuiltinIndicatorKind = "sma" | "ema" | "wma" | "rsi";
/** Indicators supplied by an {@link IndicatorSource} use the `ext:` prefix. */
export type IndicatorKind = BuiltinIndicatorKind | `ext:${string}`;

/** An input a script exposes for the Settings dialog. */
export type ExternalInput = Pick<InputDef, "id" | "label" | "type" | "min" | "max" | "step" | "options" | "tooltip" | "section"> & { default: number | string | boolean };

type LineValues = Promise<Array<number | null>>;
type ShiftOf = number | ((inputs: InputValues) => number);
const shiftValue = (shift: ShiftOf | undefined, values: InputValues) => (typeof shift === "function" ? shift(values) : (shift ?? 0));

/** An indicator computed outside chart-lab (e.g. a Lua script) and drawn by it. */
export interface ExternalIndicator {
  id: string;
  short: string;
  /** Name shown in the legend and dialog title; defaults to `short`. */
  legend?: string;
  name: string;
  description: string;
  /** Where it comes from, shown in the picker in place of "Built-in". */
  origin: string;
  color: string;
  pane: "main" | "separate";
  /** Fixed value range of a separate pane, e.g. [0, 100] for RSI. */
  range?: [number, number];
  /** Horizontal guide lines drawn in a separate pane. */
  levels?: number[];
  /** Adjustable parameters; their values are passed back to `compute`. */
  inputs?: ExternalInput[];
  /** One value per bar, null while warming up. */
  compute(bars: Bar[], inputs?: InputValues): LineValues;
  /** Further lines of the same indicator (e.g. the outer Bollinger bands), drawn in the same pane. */
  extraLines?: Array<{ name?: string; color: string; compute(bars: Bar[], inputs?: InputValues): LineValues; shift?: ShiftOf }>;
  /** Bars the main line is displaced by (positive = into the future), fixed or following the inputs. */
  shift?: ShiftOf;
  /** Fills the area between two extra lines (indices into `extraLines`). */
  cloud?: { from: number; to: number; up: string; down: string };
  /** Opens the script behind the indicator; enables the legend's "Source code" button. */
  openSource?(): void;
}

export interface IndicatorSource {
  load(): Promise<ExternalIndicator[]>;
}

const sources = new Set<IndicatorSource>();
const externals = new Map<string, ExternalIndicator>();
const externalSpecs = new Map<string, IndicatorSpec>();

/** Makes a source's indicators available in the Indicators dialog. Returns an unregister function. */
export const registerIndicatorSource = (source: IndicatorSource) => {
  sources.add(source);
  return () => void sources.delete(source);
};

export const loadExternalIndicators = async (): Promise<ExternalIndicator[]> => {
  const lists = await Promise.all(
    [...sources].map((source) =>
      source.load().catch((error) => {
        console.warn("[chart-lab] indicator source unavailable:", error);
        return [] as ExternalIndicator[];
      }),
    ),
  );
  const all = lists.flat();
  all.forEach((item) => {
    externals.set(item.id, item);
    externalSpecs.delete(item.id);
  });
  return all;
};

/** Every live indicator manager, so a script saved elsewhere can refresh all charts at once. */
const managers = new Set<Indicators>();

/** Re-reads the sources and redraws every chart's indicators that come from them (e.g. after a script was edited). */
export const reloadExternalIndicators = async () => {
  await loadExternalIndicators();
  managers.forEach((manager) => manager.reload());
};

export const externalKind = (id: string): IndicatorKind => `ext:${id}`;
export const isExternalKind = (kind: IndicatorKind): kind is `ext:${string}` => kind.startsWith("ext:");
export const externalOf = (kind: IndicatorKind) => (isExternalKind(kind) ? externals.get(kind.slice(4)) : undefined);

/** `#rrggbb` plus a 0-100 opacity from any CSS colour the scripts give. */
const splitColor = (css: string): { hex: string; opacity: number } => {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim());
  if (hex) return { hex: `#${hex[1].toLowerCase()}`, opacity: 100 };
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?/i.exec(css);
  if (!m) return { hex: "#2962ff", opacity: 100 };
  const channels = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  return { hex: `#${channels}`, opacity: m[4] === undefined ? 100 : Math.round(Number(m[4]) * 100) };
};

const specOfExternal = (ext: ExternalIndicator): IndicatorSpec => {
  const cached = externalSpecs.get(ext.id);
  if (cached) return cached;
  const extras = ext.extraLines ?? [];
  const main = splitColor(ext.color);
  const inputs: InputDef[] = (ext.inputs ?? []).map((input) => ({ ...input }));
  const cloud = ext.cloud;
  const spec: IndicatorSpec = {
    id: ext.id,
    name: ext.name,
    short: ext.short,
    legend: ext.legend,
    description: ext.description,
    pane: ext.pane,
    range: ext.range,
    decimals: null,
    inputs,
    plots: [
      { id: "main", name: ext.name, color: main.hex, opacity: main.opacity },
      ...extras.map((line, i) => {
        const c = splitColor(line.color);
        return { id: `l${i}`, name: line.name ?? `Line ${i + 2}`, color: c.hex, opacity: c.opacity };
      }),
    ],
    levels: ext.pane === "separate" ? (ext.levels ?? []).map((value, i) => ({ id: `lv${i}`, name: `Level ${i + 1}`, value, color: "#969aa0", opacity: 45 })) : [],
    fills: cloud
      ? [
          { id: "cloudUp", name: "Cloud fill (above)", mode: "over" as const, from: `plot:l${cloud.from}`, to: `plot:l${cloud.to}`, color: splitColor(cloud.up).hex, opacity: splitColor(cloud.up).opacity },
          { id: "cloudDown", name: "Cloud fill (below)", mode: "under" as const, from: `plot:l${cloud.from}`, to: `plot:l${cloud.to}`, color: splitColor(cloud.down).hex, opacity: splitColor(cloud.down).opacity },
        ]
      : [],
    title: (values) => inputs.map((input) => String(values[input.id])),
    shift: (values, plotId) => shiftValue(plotId === "main" ? ext.shift : extras[Number(plotId.slice(1))]?.shift, values),
    async compute(bars, values) {
      const plots: Record<string, Series> = { main: await ext.compute(bars, values) };
      await Promise.all(extras.map(async (line, i) => (plots[`l${i}`] = await line.compute(bars, values))));
      return { plots };
    },
  };
  externalSpecs.set(ext.id, spec);
  return spec;
};

const UNKNOWN: IndicatorSpec = {
  id: "unknown",
  name: "Unavailable indicator",
  short: "?",
  description: "",
  pane: "main",
  decimals: null,
  inputs: [],
  plots: [{ id: "main", name: "Value", color: "#2962ff" }],
  title: () => [],
  compute: () => ({ plots: { main: [] } }),
};

/** The schema (inputs, plots, levels, fills) behind an indicator kind. */
export const specOf = (kind: IndicatorKind): IndicatorSpec => {
  const builtin = BUILTIN_SPECS.find((spec) => spec.id === kind);
  if (builtin) return builtin;
  const ext = externalOf(kind);
  return ext ? specOfExternal(ext) : { ...UNKNOWN, short: kind.replace(/^ext:/, "") };
};

export const INDICATOR_SPECS = BUILTIN_SPECS;

/** The settings a new indicator of this kind starts with: the user's saved defaults, else the built-ins. */
export const initialSettings = (kind: IndicatorKind) => mergeSettings(specOf(kind), loadSavedSettings(kind));

export interface IndicatorSnapshot {
  /** Kept on restore, so later undo steps still find the indicator. */
  id: string;
  kind: IndicatorKind;
  visible: boolean;
  settings: IndicatorSettings;
}

type PlotSeries = ISeriesApi<"Line"> | ISeriesApi<"Histogram"> | ISeriesApi<"Area">;

export interface PlotRuntime {
  def: PlotDef;
  series: PlotSeries;
  /** One value per market bar, null while warming up. */
  values: Series;
}

export interface IndicatorInstance {
  readonly id: string;
  readonly kind: IndicatorKind;
  readonly spec: IndicatorSpec;
  /** The user's eye toggle; the Visibility tab can hide the indicator on top of that. */
  visible: boolean;
  settings: IndicatorSettings;
  plots: PlotRuntime[];
  /** Values of the first plot, one per market bar. */
  values: Series;
  /** The first plot's series: where the legend anchors, price lines and fills live. */
  series: PlotSeries;
  /** The main plot's colour with its opacity applied. */
  readonly color: string;
}

interface Item extends IndicatorInstance {
  result: ComputeResult | null;
  signature: string;
  levelLines: IPriceLine[];
  fills: Array<{ id: string; primitive: FillPrimitive }>;
  markers: ISeriesMarkersPluginApi<Time> | null;
  color: string;
}

type Listener = () => void;

const PALETTE = ["#2962ff", "#ff6d00", "#089981", "#9c27b0", "#f23645", "#00bcd4"];

/** The name shown in the legend and the input values after it (when the status line shows inputs). */
export const indicatorTitle = (ind: Pick<IndicatorInstance, "spec" | "settings">) => ({
  name: ind.spec.legend ?? ind.spec.short,
  inputs: ind.settings.inputsInStatus ? ind.spec.title(ind.settings.inputs) : [],
});

export const indicatorLabel = (ind: Pick<IndicatorInstance, "spec" | "settings">) => {
  const { name, inputs } = indicatorTitle(ind);
  return [name, ...inputs].join(" ");
};

const dash = (style: DashStyle) => (style === "dashed" ? 2 : style === "dotted" ? 1 : 0);

export type PaneMove = "above" | "below" | "new-above" | "new-below";

/** Owns the indicator series drawn on the chart's panes and keeps them in step with the market's bars and the indicators' settings. */
export class Indicators {
  private items: Item[] = [];
  private listeners = new Set<Listener>();
  private unsubMarket: () => void;
  private counter = 0;
  private runs = new Map<string, number>();

  constructor(
    private chart: IChartApi,
    private host: ISeriesApi<"Candlestick">,
    private market: Market,
  ) {
    this.unsubMarket = market.subscribe(() => this.refresh());
    managers.add(this);
  }

  get list(): readonly IndicatorInstance[] {
    return this.items;
  }

  get(id: string): IndicatorInstance | undefined {
    return this.items.find((item) => item.id === id);
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** True while the indicator is drawn: the eye is on and the current resolution is inside its Visibility ranges. */
  isShown(item: Pick<IndicatorInstance, "visible" | "settings">) {
    return item.visible && visibleAt(item.settings.visibility, this.market.resolution.sec);
  }

  paneIndexOf(item: IndicatorInstance) {
    return item.series.getPane().paneIndex();
  }

  add(kind: IndicatorKind, settings?: IndicatorSettings, id?: string): IndicatorInstance {
    const spec = specOf(kind);
    const base = settings ? mergeSettings(spec, settings) : initialSettings(kind);
    // Without saved settings each further indicator of a kind takes the next colour from the palette.
    const same = this.items.filter((i) => i.kind === kind).length;
    if (!settings && same && !loadSavedSettings(kind)) base.plots[spec.plots[0].id].color = PALETTE[same % PALETTE.length];
    const item = {
      id: id ?? `ind-${++this.counter}`,
      kind,
      spec,
      visible: true,
      settings: base,
      plots: [],
      values: [],
      color: "",
      result: null,
      signature: "",
      levelLines: [],
      fills: [],
      markers: null,
    } as unknown as Item;
    this.items.push(item);
    this.build(item, spec.pane === "separate" ? this.newPane() : this.host.getPane().paneIndex());
    this.compute(item);
    this.emit();
    return item;
  }

  remove(id: string) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const [item] = this.items.splice(index, 1);
    this.runs.delete(item.id);
    this.teardown(item);
    item.plots.forEach((plot) => this.chart.removeSeries(plot.series));
    this.emit();
  }

  snapshot(id: string): IndicatorSnapshot | null {
    const item = this.items.find((i) => i.id === id);
    return item ? { id: item.id, kind: item.kind, visible: item.visible, settings: cloneSettings(item.settings) } : null;
  }

  /** Puts a removed indicator back (same settings, new series) so undo can restore it. */
  restore(snapshot: IndicatorSnapshot): IndicatorInstance {
    const item = this.add(snapshot.kind, snapshot.settings, snapshot.id);
    if (!snapshot.visible) this.setVisible(item.id, false);
    return item;
  }

  /** Replaces all settings of an indicator; the Settings dialog applies edits through this while it is open. */
  update(id: string, settings: IndicatorSettings) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.settings = cloneSettings(settings);
    if (this.structure(item) !== item.signature) this.build(item, this.paneIndexOf(item));
    else this.applyStyle(item);
    this.compute(item);
    this.emit();
  }

  setVisible(id: string, visible: boolean) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.visible = visible;
    this.applyStyle(item);
    this.emit();
  }

  /** The "Visibility on intervals" menu entries. */
  setIntervalVisibility(id: string, mode: IntervalVisibility) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    this.update(id, { ...item.settings, visibility: visibilityFor(mode, this.market.resolution.sec) });
  }

  refresh() {
    this.items.forEach((item) => {
      this.applyStyle(item, false);
      this.compute(item);
    });
    this.emit();
  }

  /** Picks up a changed script: new inputs and plots take effect, the user's styling of the rest is kept. */
  reload() {
    this.items.forEach((item) => {
      if (!isExternalKind(item.kind) || !externalOf(item.kind)) return;
      const previous = item.spec;
      Object.assign(item, { spec: specOf(item.kind) });
      const settings = mergeSettings(item.spec, item.settings);
      // An input the user never changed keeps following the script's default.
      for (const input of item.spec.inputs) {
        const was = previous.inputs.find((i) => i.id === input.id);
        if (was && item.settings.inputs[input.id] === was.default) settings.inputs[input.id] = input.default;
      }
      item.settings = settings;
      if (this.structure(item) !== item.signature) this.build(item, this.paneIndexOf(item));
      else this.applyStyle(item, false);
      this.compute(item);
    });
    this.emit();
  }

  dispose() {
    managers.delete(this);
    this.unsubMarket();
    this.listeners.clear();
    this.items = [];
  }

  // ---------- panes ----------

  /** Whether the indicator shares its pane with another series. */
  sharesPane(item: IndicatorInstance) {
    return item.series.getPane().getSeries().length > item.plots.length;
  }

  /** Indicators drawn in a pane, in the order they were added. */
  inPane(paneIndex: number) {
    return this.items.filter((item) => this.paneIndexOf(item) === paneIndex);
  }

  /** Removes every indicator in a pane (the pane goes with them). */
  removePane(paneIndex: number) {
    this.inPane(paneIndex).forEach((item) => this.remove(item.id));
  }

  moveTo(id: string, where: PaneMove) {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    const from = this.paneIndexOf(item);
    if (where === "above" || where === "below") {
      const target = where === "above" ? from - 1 : from + 1;
      if (target < 0 || target >= this.chart.panes().length) return;
      item.plots.forEach((plot) => plot.series.moveToPane(target));
    } else {
      // Alone in its pane it already is in a pane of its own.
      if (!this.sharesPane(item)) return;
      const created = this.chart.addPane().paneIndex();
      item.plots.forEach((plot) => plot.series.moveToPane(created));
      item.series.getPane().moveTo(where === "new-above" ? from : from + 1);
    }
    this.items.forEach((i) => this.applyStyle(i));
    this.emit();
  }

  /** Moves within the series sharing its pane: to the front/back or one step, keeping the indicator's plots together. */
  reorder(id: string, op: "front" | "back" | "forward" | "backward") {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    const pane = item.series.getPane();
    const last = pane.getSeries().length - 1;
    const own = [...item.plots].sort((a, b) => a.series.seriesOrder() - b.series.seriesOrder());
    if (op === "front") own.forEach((p) => p.series.setSeriesOrder(last));
    else if (op === "back") [...own].reverse().forEach((p) => p.series.setSeriesOrder(0));
    else {
      const low = own[0].series.seriesOrder();
      const high = own[own.length - 1].series.seriesOrder();
      // Hop the neighbour on the other side over the whole block.
      const neighbour = pane.getSeries().find((s) => s.seriesOrder() === (op === "forward" ? high + 1 : low - 1));
      if (neighbour) neighbour.setSeriesOrder(op === "forward" ? low : high);
    }
    this.emit();
  }

  /** Where the indicator's block of plots sits among the series of its pane, for enabling the Visual order menu. */
  orderOf(item: IndicatorInstance) {
    const orders = item.plots.map((p) => p.series.seriesOrder());
    return { order: Math.min(...orders), last: item.series.getPane().getSeries().length - item.plots.length };
  }

  // ---------- building ----------

  private newPane() {
    const pane = this.chart.addPane();
    pane.setStretchFactor(0.5);
    return pane.paneIndex();
  }

  /** What forces the series to be recreated: which plots exist and how each is drawn. */
  private structure(item: Item) {
    const { spec, settings } = item;
    return JSON.stringify([
      spec.plots.filter((p) => isPlotActive(p, settings.inputs)).map((p) => [p.id, settings.plots[p.id].type]),
      (spec.fills ?? []).filter((f) => isFillActive(f, settings.inputs)).map((f) => f.id),
    ]);
  }

  private teardown(item: Item) {
    item.levelLines.forEach((line) => {
      try {
        item.series?.removePriceLine(line);
      } catch {
        /* the series is already gone */
      }
    });
    item.levelLines = [];
    item.fills = [];
    try {
      item.markers?.detach();
    } catch {
      /* the series is already gone */
    }
    item.markers = null;
  }

  /** The price scale for the item in a pane: its own where a fixed range would otherwise squash the pane's other series. */
  private scaleId(item: Item, paneIndex: number) {
    const own = new Set(item.plots.map((p) => p.series));
    const pane = this.chart.panes()[paneIndex];
    const foreign = !!pane && pane.getSeries().some((s) => !own.has(s as PlotSeries));
    if (!foreign) return "right";
    if (item.spec.range) return `ind-${item.id}`;
    return paneIndex === this.host.getPane().paneIndex() && this.host.options().priceScaleId === "left" ? "left" : "right";
  }

  /** (Re)creates the item's series in `paneIndex`. New series go in before the old ones leave, so the pane is never empty. */
  private build(item: Item, paneIndex: number) {
    const { spec, settings } = item;
    const old = item.plots.map((p) => p.series);
    if (old.length) this.teardown(item);
    const plots = spec.plots
      .filter((def) => isPlotActive(def, settings.inputs))
      .map((def) => {
        const options = this.seriesOptions(item, def, paneIndex);
        const type = settings.plots[def.id].type;
        const series =
          type === "histogram"
            ? this.chart.addSeries(HistogramSeries, options as never, paneIndex)
            : type === "area"
              ? this.chart.addSeries(AreaSeries, options as never, paneIndex)
              : this.chart.addSeries(LineSeries, options as never, paneIndex);
        return { def, series, values: item.result?.plots[def.id] ?? [] } as PlotRuntime;
      });
    old.forEach((series) => this.chart.removeSeries(series));
    item.plots = plots;
    item.series = plots[0].series;
    item.signature = this.structure(item);
    item.fills = (spec.fills ?? [])
      .filter((fill) => isFillActive(fill, settings.inputs))
      .map((fill) => {
        const primitive = new FillPrimitive({ mode: fill.mode, color: "transparent" });
        item.series.attachPrimitive(primitive);
        return { id: fill.id, primitive };
      });
    this.applyStyle(item);
  }

  private seriesOptions(item: Item, def: PlotDef, paneIndex: number) {
    const { settings, spec } = item;
    const style = settings.plots[def.id];
    const hidden = !style.visible;
    const color = rgba(style.color, style.opacity);
    const digits = settings.precision ?? spec.decimals;
    const common = {
      visible: this.isShown(item),
      priceScaleId: this.scaleId(item, paneIndex),
      priceLineVisible: style.priceLine && !hidden,
      lastValueVisible: settings.labelsOnScale && !hidden,
      crosshairMarkerVisible: false,
      title: "",
      ...(digits === null ? {} : { priceFormat: { type: "price", precision: digits, minMove: 10 ** -digits } }),
      ...(spec.range ? { autoscaleInfoProvider: () => ({ priceRange: { minValue: spec.range![0], maxValue: spec.range![1] } }) } : {}),
    };
    if (style.type === "histogram") return { ...common, color: hidden ? "rgba(0,0,0,0)" : color };
    if (style.type === "area") {
      return {
        ...common,
        lineColor: color,
        topColor: hidden ? "rgba(0,0,0,0)" : rgba(style.color, style.opacity * 0.4),
        bottomColor: "rgba(0,0,0,0)",
        lineWidth: style.width as never,
        lineStyle: dash(style.dash),
        lineVisible: !hidden,
      };
    }
    return {
      ...common,
      color,
      lineWidth: style.width as never,
      lineStyle: dash(style.dash),
      lineType: style.type === "stepline" ? 1 : 0,
      lineVisible: style.type !== "circles" && !hidden,
      pointMarkersVisible: style.type === "circles" && !hidden,
    };
  }

  /** Pushes the current style/visibility settings to the existing series, price lines and fills. */
  private applyStyle(item: Item, repaint = true) {
    const { settings, spec } = item;
    const shown = this.isShown(item);
    const paneIndex = this.paneIndexOf(item);
    item.plots.forEach((plot) => plot.series.applyOptions(this.seriesOptions(item, plot.def, paneIndex) as never));
    const main = settings.plots[spec.plots[0].id];
    item.color = rgba(main.color, main.opacity);

    item.levelLines.forEach((line) => item.series.removePriceLine(line));
    item.levelLines = shown
      ? (spec.levels ?? []).flatMap((level) => {
          const style = settings.levels[level.id];
          if (!style?.visible) return [];
          return [
            item.series.createPriceLine({
              price: style.value,
              color: rgba(style.color, style.opacity),
              lineWidth: style.width as never,
              lineStyle: dash(style.dash),
              axisLabelVisible: false,
              title: "",
            }),
          ];
        })
      : [];

    (spec.fills ?? []).forEach((fill) => {
      const runtime = item.fills.find((f) => f.id === fill.id);
      const style = settings.fills[fill.id];
      if (!runtime || !style) return;
      runtime.primitive.setVisible(shown && style.visible);
      runtime.primitive.setOptions({
        mode: fill.mode,
        color: rgba(style.color, style.opacity),
        gradient: fill.gradient ? { end: fill.gradient.end, color2: rgba(style.color2, style.opacity2) } : undefined,
      });
    });
    if (repaint) this.paint(item);
  }

  // ---------- data ----------

  private compute(item: Item) {
    const run = (this.runs.get(item.id) ?? 0) + 1;
    this.runs.set(item.id, run);
    const done = (result: ComputeResult, notify: boolean) => {
      // A newer run or a removal superseded this one while it was computing.
      if (this.runs.get(item.id) !== run || !this.items.includes(item)) return;
      item.result = result;
      this.paint(item);
      if (notify) this.emit();
    };
    const failed = (error: unknown) => console.warn(`[chart-lab] indicator ${item.spec.name} failed:`, error);
    try {
      const out = item.spec.compute(this.market.bars, item.settings.inputs, this.market.resolution.sec);
      if (out instanceof Promise) out.then((result) => done(result, true), failed);
      else done(out, false);
    } catch (error) {
      failed(error);
    }
  }

  /** The time `at` bars into the market's bars; past the newest bar the last bar's spacing continues. */
  private timeAt(bars: Bar[], at: number): number | null {
    const n = bars.length;
    if (at < 0 || !n) return null;
    if (at < n) return bars[at].time;
    const step = n > 1 ? bars[n - 1].time - bars[n - 2].time : 0;
    return step ? bars[n - 1].time + (at - n + 1) * step : null;
  }

  private toData(bars: Bar[], values: Series, shift: number, breaks: boolean) {
    const data: Array<{ time: Time; value?: number }> = [];
    let started = false;
    values.forEach((value, index) => {
      const time = this.timeAt(bars, index + shift);
      if (time === null) return;
      if (value === null || value === undefined || !Number.isFinite(value)) {
        if (breaks && started) data.push({ time: time as Time });
        return;
      }
      started = true;
      data.push({ time: time as Time, value });
    });
    return data;
  }

  private paint(item: Item) {
    const result = item.result;
    if (!result || !item.plots.length) return;
    const bars = this.market.bars;
    const { spec, settings } = item;
    const shiftOf = (id: string) => spec.shift?.(settings.inputs, id) ?? 0;
    item.plots.forEach((plot) => {
      plot.values = result.plots[plot.def.id] ?? [];
      plot.series.setData(this.toData(bars, plot.values, shiftOf(plot.def.id), settings.plots[plot.def.id].type === "linebr") as never);
    });
    item.values = item.plots[0].values;

    (spec.fills ?? []).forEach((fill) => {
      const runtime = item.fills.find((f) => f.id === fill.id);
      if (!runtime) return;
      const edge = (ref: string) => {
        const [kind, id] = ref.split(":");
        return kind === "level" ? { constant: settings.levels[id]?.value ?? 0, values: null, shift: 0 } : { constant: 0, values: result.plots[id] ?? [], shift: shiftOf(id) };
      };
      const a = edge(fill.from);
      const b = edge(fill.to);
      const end = bars.length + Math.max(0, a.shift, b.shift);
      const points: Array<{ time: number; a: number; b: number }> = [];
      for (let at = 0; at < end; at++) {
        const va = a.values ? a.values[at - a.shift] : a.constant;
        const vb = b.values ? b.values[at - b.shift] : b.constant;
        const time = this.timeAt(bars, at);
        if (time === null || va === null || va === undefined || vb === null || vb === undefined) continue;
        points.push({ time, a: va, b: vb });
      }
      runtime.primitive.setPoints(points);
    });

    const markers = result.markers ?? [];
    if (markers.length && !item.markers) item.markers = createSeriesMarkers(item.series as ISeriesApi<"Line">, []);
    item.markers?.setMarkers(
      markers.flatMap((m) => {
        const time = this.timeAt(bars, m.index);
        return time === null ? [] : [{ time: time as Time, position: m.position, shape: m.position === "belowBar" ? ("arrowUp" as const) : ("arrowDown" as const), color: m.color, text: m.text }];
      }),
    );
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }
}
