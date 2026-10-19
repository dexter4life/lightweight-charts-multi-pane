import { createTextWatermark } from "lightweight-charts-multi-pane";
import type { LineWidth, IChartApi, IPriceLine, ISeriesApi } from "lightweight-charts-multi-pane";
import type { Market } from "./market";
import { EXCHANGE_ZONE, TIMEZONES, UTC_ZONE } from "./timezones";
import { PALETTES, type ColorScheme, type Palette } from "./theme";

const UP = "#089981";
const DOWN = "#f23645";
const CLEAR = "rgba(0,0,0,0)";

export interface ColorSet {
  on: boolean;
  up: string;
  down: string;
}
/** `color: null` follows the bar direction (last) or high/low colours. `style` is a library line style. */
export interface PriceLineSet {
  on: boolean;
  color: string | null;
  width: number;
  style: number;
}
export interface CrosshairSet {
  color: string;
  width: number;
  style: number;
}

export interface SettingsData {
  colorByPrev: boolean;
  body: ColorSet;
  border: ColorSet;
  wick: ColorSet;
  lastLine: PriceLineSet;
  hiLoLine: PriceLineSet;
  precision: string;
  timezone: string;

  titleOn: boolean;
  titleMode: "description" | "ticker" | "both";
  marketStatus: boolean;
  ohlc: boolean;
  change: boolean;
  volume: boolean;
  indTitles: boolean;
  indArgs: boolean;
  indValues: boolean;
  indBg: boolean;
  indBgOpacity: number;

  symName: boolean;
  lastPriceOn: boolean;
  lastPriceMode: "percent" | "value";
  hiLoLabel: boolean;
  indName: boolean;
  indValue: boolean;
  noOverlap: boolean;
  countdown: boolean;
  lockRatio: boolean;
  placement: "left" | "right" | "auto";
  dateFormat: string;
  hours: "24" | "12";

  bgType: "solid" | "gradient";
  bg: string;
  bgTop: string;
  bgBottom: string;
  vertGrid: string;
  horzGrid: string;
  crosshair: CrosshairSet;
  watermark: { on: boolean; color: string };
  textColor: string;
  fontSize: number;
  scaleLines: string;
  navVis: "hover" | "always" | "never";
  paneVis: "hover" | "always" | "never";
  marginTop: number;
  marginBottom: number;
  marginRight: number;
}

const DEFAULT_SETTINGS: SettingsData = {
  colorByPrev: false,
  body: { on: true, up: UP, down: DOWN },
  border: { on: true, up: UP, down: DOWN },
  wick: { on: true, up: UP, down: DOWN },
  lastLine: { on: true, color: null, width: 1, style: 4 },
  hiLoLine: { on: false, color: null, width: 1, style: 0 },
  precision: "Default",
  timezone: UTC_ZONE.id,

  titleOn: true,
  titleMode: "description",
  marketStatus: true,
  ohlc: true,
  change: true,
  volume: false,
  indTitles: true,
  indArgs: false,
  indValues: true,
  indBg: true,
  indBgOpacity: 0.5,

  symName: false,
  lastPriceOn: true,
  lastPriceMode: "value",
  hiLoLabel: false,
  indName: false,
  indValue: true,
  noOverlap: true,
  countdown: false,
  lockRatio: false,
  placement: "auto",
  dateFormat: "dd MMM 'yy",
  hours: "24",

  bgType: "solid",
  bg: PALETTES.light.bg,
  bgTop: PALETTES.light.bgTop,
  bgBottom: PALETTES.light.bgBottom,
  vertGrid: PALETTES.light.vertGrid,
  horzGrid: PALETTES.light.horzGrid,
  crosshair: { color: "#758696", width: 1, style: 3 },
  watermark: { on: false, color: "rgba(120, 123, 134, 0.18)" },
  textColor: PALETTES.light.textColor,
  fontSize: 12,
  scaleLines: PALETTES.light.scaleLines,
  navVis: "hover",
  paneVis: "hover",
  marginTop: 10,
  marginBottom: 8,
  marginRight: 10,
};

/** Precision menu entries; the value is the minimum price step shown (fractions are approximated with decimals). */
export const PRECISIONS: Array<{ value: string; step: number; decimals: number }> = [
  { value: "Default", step: 0.01, decimals: 2 },
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: `1/${10 ** n}`, step: 10 ** -n, decimals: n })),
  ...[2, 4, 8, 16, 32, 64, 128, 320].map((n) => ({
    value: `1/${n}`,
    step: 1 / n,
    decimals: Math.ceil(Math.log10(n)) + (n === 2 ? 0 : 1),
  })),
];

export const DATE_FORMATS: Array<{ value: string; label: string }> = [
  { value: "dd MMM 'yy", label: "29 Sep '97" },
  { value: "MMM dd, yyyy", label: "Sep 29, 1997" },
  { value: "MMM dd", label: "Sep 29" },
  { value: "dd MMM", label: "29 Sep" },
  { value: "yyyy-MM-dd", label: "1997-09-29" },
  { value: "yy-MM-dd", label: "97-09-29" },
  { value: "yy/MM/dd", label: "97/09/29" },
  { value: "yyyy/MM/dd", label: "1997/09/29" },
  { value: "dd-MM-yyyy", label: "29-09-1997" },
  { value: "dd-MM-yy", label: "29-09-97" },
  { value: "dd/MM/yy", label: "29/09/97" },
  { value: "dd/MM/yyyy", label: "29/09/1997" },
  { value: "MM/dd/yy", label: "09/29/97" },
  { value: "MM/dd/yyyy", label: "09/29/1997" },
];

type Listener = (keys: string[]) => void;

export interface SettingsContext {
  chart: IChartApi;
  candles: ISeriesApi<"Candlestick">;
  volume: () => ISeriesApi<"Histogram"> | null;
  market: Market;
  host: HTMLElement;
  scheme: ColorScheme;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** The defaults for a colour scheme: the light ones with that scheme's appearance palette on top. */
export const defaultSettings = (scheme: ColorScheme = "light"): SettingsData => ({ ...clone(DEFAULT_SETTINGS), ...PALETTES[scheme] });

const isDefaultScaleLines = (color: string) => Object.values(PALETTES).some((palette) => palette.scaleLines === color);

/**
 * Live "Chart settings" state. Each change is pushed to the chart straight away, as in the reference;
 * `snapshot`/`replace` let the dialog revert on Cancel. Candle options are read back by `ChartStyle`.
 */
export class ChartSettings {
  data: SettingsData;
  scheme: ColorScheme;
  private listeners = new Set<Listener>();
  private hiLines: { hi: IPriceLine; lo: IPriceLine; key: string } | null = null;
  private watermark: { applyOptions(o: never): void; detach(): void } | null = null;
  /** The colour scheme each snapshot was taken under, so it can be carried over if the scheme changes meanwhile. */
  private snapshotSchemes = new WeakMap<SettingsData, ColorScheme>();

  constructor(private ctx: SettingsContext) {
    const { chart, market } = ctx;
    this.scheme = ctx.scheme;
    this.data = defaultSettings(ctx.scheme);
    market.subscribe(() => {
      this.data.timezone = market.timezone.id;
      this.updateHiLo();
      this.updateWatermark();
      this.listeners.forEach((fn) => fn(["timezone"]));
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => this.updateHiLo());
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshot(): SettingsData {
    const copy = clone(this.data);
    this.snapshotSchemes.set(copy, this.scheme);
    return copy;
  }

  /** A snapshot taken under another colour scheme, with the colours it left at that scheme's defaults moved to the current one. */
  rebase(snapshot: SettingsData): SettingsData {
    const taken = this.snapshotSchemes.get(snapshot);
    if (!taken || taken === this.scheme) return snapshot;
    const from = PALETTES[taken];
    const to = PALETTES[this.scheme];
    const rebased = clone(snapshot);
    (Object.keys(to) as Array<keyof Palette>).forEach((key) => {
      if (rebased[key] === from[key]) rebased[key] = to[key];
    });
    this.snapshotSchemes.set(rebased, this.scheme);
    return rebased;
  }

  /** What "reset to defaults" restores for the current colour scheme. */
  defaults(): SettingsData {
    return defaultSettings(this.scheme);
  }

  /** Moves the appearance settings the user never changed over to the new scheme's palette; custom colours stay. */
  setScheme(next: ColorScheme) {
    if (next === this.scheme) return;
    const from = PALETTES[this.scheme];
    const to = PALETTES[next];
    this.scheme = next;
    const changed = (Object.keys(to) as Array<keyof Palette>).filter((key) => this.data[key] === from[key]);
    changed.forEach((key) => (this.data[key] = to[key]));
    if (changed.length) this.commit(changed);
  }

  /** Sets many keys at once (Cancel, Apply defaults, undo). */
  replace(snapshot: SettingsData) {
    const next = this.rebase(snapshot);
    const keys = Object.keys(next) as Array<keyof SettingsData>;
    const changed = keys.filter((k) => JSON.stringify(this.data[k]) !== JSON.stringify(next[k]));
    this.data = clone(next);
    this.commit(changed);
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    this.data[key] = value;
    this.commit([key]);
  }

  get step() {
    return PRECISIONS.find((p) => p.value === this.data.precision) ?? PRECISIONS[0];
  }

  /** Series options for the normal candle look; `ChartStyle` merges them for the candle and hollow types. */
  candleOptions() {
    const d = this.data;
    const bars = this.ctx.market.bars;
    const last = bars[bars.length - 1];
    const lastUp = !last || last.close >= last.open;
    return {
      upColor: d.body.on ? d.body.up : CLEAR,
      downColor: d.body.on ? d.body.down : CLEAR,
      borderUpColor: d.border.up,
      borderDownColor: d.border.down,
      wickUpColor: d.wick.up,
      wickDownColor: d.wick.down,
      borderVisible: d.border.on,
      wickVisible: d.wick.on,
      lastValueVisible: d.lastPriceOn,
      priceLineVisible: d.lastLine.on,
      priceLineColor: d.lastLine.color ?? (lastUp ? d.body.up : d.body.down),
      priceLineWidth: d.lastLine.width as LineWidth,
      priceLineStyle: d.lastLine.style,
      title: d.symName ? this.ctx.market.symbol.symbol : "",
    };
  }

  private commit(keys: string[]) {
    const groups = new Set<string>();
    const map: Array<[RegExp, string]> = [
      [/^(colorByPrev|body|border|wick)$/, "colors"],
      [/^(bgType|bg|bgTop|bgBottom|vertGrid|horzGrid|crosshair|textColor|fontSize|scaleLines)$/, "look"],
      [/^(marginTop|marginBottom|marginRight)$/, "margins"],
      [/^watermark$/, "watermark"],
      [/^(navVis|paneVis)$/, "nav"],
      [/^precision$/, "precision"],
      [/^timezone$/, "timezone"],
      [/^(dateFormat|hours)$/, "timefmt"],
      [/^(hiLoLine|hiLoLabel)$/, "hilo"],
      [/^(indName|indValue)$/, "volume"],
    ];
    keys.forEach((k) => map.forEach(([re, g]) => re.test(k) && groups.add(g)));
    groups.forEach((g) => this.applyGroup(g));
    this.listeners.forEach((fn) => fn(keys));
  }

  private applyGroup(group: string) {
    const { chart, candles, market, host } = this.ctx;
    const d = this.data;
    switch (group) {
      case "colors": {
        market.barColor = d.colorByPrev
          ? (b, prev) => {
              const up = b.close >= prev;
              return {
                color: d.body.on ? (up ? d.body.up : d.body.down) : CLEAR,
                borderColor: up ? d.border.up : d.border.down,
                wickColor: up ? d.wick.up : d.wick.down,
              };
            }
          : null;
        market.refreshCandles();
        break;
      }
      case "look": {
        const grad = d.bgType === "gradient";
        chart.applyOptions({
          layout: {
            background: grad ? { type: "gradient", topColor: d.bgTop, bottomColor: d.bgBottom } : { type: "solid", color: d.bg },
            textColor: d.textColor,
            fontSize: d.fontSize,
          },
          grid: { vertLines: { color: d.vertGrid }, horzLines: { color: d.horzGrid } },
          crosshair: {
            vertLine: { color: d.crosshair.color, width: d.crosshair.width, style: d.crosshair.style, labelBackgroundColor: d.crosshair.color },
            horzLine: { color: d.crosshair.color, width: d.crosshair.width, style: d.crosshair.style, labelBackgroundColor: d.crosshair.color },
          },
          timeScale: { borderColor: d.scaleLines },
          [`${candles.options().priceScaleId === "left" ? "left" : "right"}PriceScale`]:
            isDefaultScaleLines(d.scaleLines) ? { borderVisible: false } : { borderVisible: true, borderColor: d.scaleLines },
        } as never);
        break;
      }
      case "margins":
        candles.priceScale().applyOptions({ scaleMargins: { top: d.marginTop / 100, bottom: d.marginBottom / 100 } });
        chart.timeScale().applyOptions({ rightOffset: Math.max(0, d.marginRight - 1) });
        break;
      case "watermark":
        this.updateWatermark();
        break;
      case "nav":
        host.dataset.navMode = d.navVis;
        host.dataset.paneMode = d.paneVis;
        break;
      case "precision":
        candles.applyOptions({ priceFormat: { type: "price", precision: this.step.decimals, minMove: this.step.step } });
        break;
      case "timezone": {
        const tz = d.timezone === EXCHANGE_ZONE.id ? EXCHANGE_ZONE : [UTC_ZONE, ...TIMEZONES].find((t) => t.id === d.timezone) ?? UTC_ZONE;
        if (tz.id !== market.timezone.id) market.setTimezone(tz);
        break;
      }
      case "timefmt":
        market.setTimeFormat({ date: d.dateFormat, hours12: d.hours === "12" });
        break;
      case "hilo":
        this.updateHiLo(true);
        break;
      case "volume":
        this.ctx.volume()?.applyOptions({ lastValueVisible: d.indValue, title: d.indName ? "Volume" : "" } as never);
        break;
    }
  }

  private updateWatermark() {
    const { chart, market } = this.ctx;
    const w = this.data.watermark;
    if (!w.on) {
      this.watermark?.detach();
      this.watermark = null;
      return;
    }
    const lines = [
      { text: market.symbol.symbol, color: w.color, fontSize: 96, fontStyle: "bold" },
      { text: `${market.symbol.description}, ${market.resolution.legend}`, color: w.color, fontSize: 24 },
    ];
    if (this.watermark) this.watermark.applyOptions({ lines } as never);
    else this.watermark = createTextWatermark(chart.panes()[0], { lines } as never) as never;
  }

  /** Draws lines (and axis labels) for the highest high and lowest low of the visible bars. */
  private updateHiLo(force = false) {
    const { chart, candles, market } = this.ctx;
    const d = this.data;
    if (!d.hiLoLine.on && !d.hiLoLabel) {
      this.clearHiLo();
      return;
    }
    const r = chart.timeScale().getVisibleLogicalRange();
    const bars = market.bars;
    if (!r || !bars.length) return;
    const from = Math.max(0, Math.floor(r.from));
    const to = Math.min(bars.length - 1, Math.ceil(r.to));
    if (to < from) return;
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = from; i <= to; i++) {
      hi = Math.max(hi, bars[i].high);
      lo = Math.min(lo, bars[i].low);
    }
    const key = [hi, lo, d.hiLoLine.on, d.hiLoLabel, d.hiLoLine.color, d.hiLoLine.width, d.hiLoLine.style, d.body.up, d.body.down].join("|");
    if (!force && this.hiLines?.key === key) return;
    this.clearHiLo();
    const make = (price: number, color: string) =>
      candles.createPriceLine({
        price,
        color,
        lineWidth: d.hiLoLine.width as 1,
        lineStyle: d.hiLoLine.style,
        lineVisible: d.hiLoLine.on,
        axisLabelVisible: d.hiLoLabel,
        title: "",
      });
    this.hiLines = {
      hi: make(hi, d.hiLoLine.color ?? d.body.up),
      lo: make(lo, d.hiLoLine.color ?? d.body.down),
      key,
    };
  }

  private clearHiLo() {
    if (!this.hiLines) return;
    this.ctx.candles.removePriceLine(this.hiLines.hi);
    this.ctx.candles.removePriceLine(this.hiLines.lo);
    this.hiLines = null;
  }
}
