import type { DatafeedBar, DatafeedSymbolInfo, BrandLogoOptions, IChartApi, IDatafeedChartApi, ISeriesApi, Time } from "lightweight-charts-multi-pane";
import { genBars, type Bar } from "./data";
import { NO_EXCHANGE, SYMBOLS, type SymbolInfo } from "./symbols";

/** Older saved tabs carry the retired placeholder exchange. */
const clean = (sym: SymbolInfo): SymbolInfo => (sym.exchange === "MOCK" ? { ...sym, exchange: NO_EXCHANGE } : sym);
import type { DrawingController } from "./controller";
import { DEFAULT_TIME_FORMAT, UTC_ZONE, crosshairLabel, tickLabel, type TimeFormat, type Timezone } from "./timezones";

export interface Resolution {
  id: string;
  /** Short text for the toolbar button. */
  label: string;
  title: string;
  sec: number;
  group: "Minutes" | "Hours" | "Days";
  /** Text shown in the legend after the symbol. */
  legend: string;
}

export const RESOLUTIONS: Resolution[] = [
  { id: "1", label: "1m", title: "1 minute", sec: 60, group: "Minutes", legend: "1" },
  { id: "3", label: "3m", title: "3 minutes", sec: 180, group: "Minutes", legend: "3" },
  { id: "5", label: "5m", title: "5 minutes", sec: 300, group: "Minutes", legend: "5" },
  { id: "15", label: "15m", title: "15 minutes", sec: 900, group: "Minutes", legend: "15" },
  { id: "30", label: "30m", title: "30 minutes", sec: 1800, group: "Minutes", legend: "30" },
  { id: "60", label: "1h", title: "1 hour", sec: 3600, group: "Hours", legend: "1h" },
  { id: "120", label: "2h", title: "2 hours", sec: 7200, group: "Hours", legend: "2h" },
  { id: "240", label: "4h", title: "4 hours", sec: 14400, group: "Hours", legend: "4h" },
  { id: "1D", label: "D", title: "1 day", sec: 86400, group: "Days", legend: "1D" },
  { id: "1W", label: "W", title: "1 week", sec: 604800, group: "Days", legend: "1W" },
];

export type RangePreset = "1d" | "5d" | "1m" | "3m" | "6m" | "ytd" | "1y" | "5y" | "all";

/** Resolution and visible span (in bars from the newest bar) each range button selects. */
const RANGE_PRESETS: Record<RangePreset, { res: string; back?: number }> = {
  "1d": { res: "15", back: 96 },
  "5d": { res: "60", back: 120 },
  "1m": { res: "1D", back: 30 },
  "3m": { res: "1D", back: 90 },
  "6m": { res: "1D", back: 180 },
  ytd: { res: "1D", back: -1 },
  "1y": { res: "1D", back: 365 },
  "5y": { res: "1W", back: 260 },
  all: { res: "1W" },
};

const FUTURE_BARS = 9;
const UP = "rgba(8,153,129,0.43)";
const DOWN = "rgba(242,54,69,0.43)";

type Listener = () => void;

/** Bars requested per page, for the first load and for each scroll-back. */
const PAGE_BARS = 500;
/** Bars visible after a feed loads. */
const DEFAULT_FEED_BARS = 120;
/** Fetch older history once fewer than this many bars are left to the left of the view. */
const SCROLL_BACK_THRESHOLD = 20;

export interface MarketOptions {
  /** Source of real bars. Without one the chart shows the seeded mock series. */
  datafeed?: IDatafeedChartApi;
  symbol?: SymbolInfo;
  /** Resolution id to start on. */
  resolution?: string;
  /** Custom brand-logo widget shown at the plot's bottom-left (collapses to an icon, expands on hover). */
  brandLogo?: BrandLogoOptions;
}

const fromFeed = (b: DatafeedBar): Bar => ({
  time: b.time as number,
  open: b.open,
  high: b.high,
  low: b.low,
  close: b.close,
  volume: b.volume ?? 0,
});

export type FeedStatus = "mock" | "loading" | "live" | "error";

/** Owns the loaded bars and the active resolution; everything that shows bars follows it. */
export class Market {
  resolution: Resolution = RESOLUTIONS.find((r) => r.id === "1D")!;
  symbol: SymbolInfo = SYMBOLS[0];
  bars: Bar[] = genBars(600, this.resolution.sec, this.symbol.base, this.symbol.seed);
  timezone: Timezone = UTC_ZONE;
  timeFormat: TimeFormat = DEFAULT_TIME_FORMAT;
  /** Per-bar colours for "colour bars based on previous close"; null keeps the series colours. */
  barColor: ((bar: Bar, prevClose: number) => { color: string; borderColor: string; wickColor: string }) | null = null;
  /** True while another chart type is drawn on top, so per-bar colours do not show through the hidden candles. */
  colorsSuspended = false;
  /** Where the bars come from: the host's datafeed once one is supplied and answering, the mock series otherwise. */
  status: FeedStatus = "mock";
  private listeners = new Set<Listener>();
  private feed?: IDatafeedChartApi;
  private feedInfo: DatafeedSymbolInfo | null = null;
  private feedToken = 0;
  private stopLive: (() => void) | null = null;
  private loadingOlder = false;
  private exhausted = false;
  private settling = false;
  private rangeSub: ((range: unknown) => void) | null = null;

  constructor(
    private chart: IChartApi,
    private candles: ISeriesApi<"Candlestick">,
    private volume: () => ISeriesApi<"Histogram"> | null,
    private ctl: DrawingController,
    opts: MarketOptions = {},
  ) {
    if (opts.symbol) this.symbol = clean(opts.symbol);
    const start = RESOLUTIONS.find((r) => r.id === opts.resolution);
    if (start) this.resolution = start;
    this.bars = genBars(600, this.resolution.sec, this.symbol.base, this.symbol.seed);
    this.feed = opts.datafeed;
    if (this.feed) {
      this.rangeSub = (range) => this.onRange(range as { from: number } | null);
      this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.rangeSub as never);
      this.status = "loading";
    }
    this.load();
    if (this.feed) void this.fetchBars(() => this.applyDefaultView());
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private load() {
    const bars = this.status === "loading" ? [] : this.bars;
    this.refreshCandles();
    this.volume()?.setData(
      bars.map((b) => ({ time: b.time as Time, value: b.volume, color: b.close >= b.open ? UP : DOWN })),
    );
    this.chart.timeScale().applyOptions({ timeVisible: this.resolution.sec < 86400 });
    this.applyZone();
    this.ctl.remapAnchors(this.bars.map((b) => b.time));
  }

  refreshCandles() {
    const barColor = this.colorsSuspended ? null : this.barColor;
    // Nothing is painted while the first page is in flight, so the placeholder series never flashes.
    const shown = this.status === "loading" ? [] : this.bars;
    this.candles.setData(
      shown.map((b, i) => ({ ...b, time: b.time as Time, ...(barColor ? barColor(b, i ? this.bars[i - 1].close : b.open) : {}) })),
    );
  }

  /** Applies the timezone, date format and hours format to the axis and crosshair; library defaults are kept when nothing differs. */
  private applyZone() {
    const iana = this.timezone.iana;
    const intraday = this.resolution.sec < 86400;
    const fmt = this.timeFormat;
    const customZone = iana !== "UTC" && intraday;
    const customTicks = customZone || (fmt.hours12 && intraday);
    const customLabel = customZone || fmt.date !== DEFAULT_TIME_FORMAT.date || (fmt.hours12 && intraday);
    this.chart.timeScale().applyOptions({
      tickMarkFormatter: customTicks ? (t: unknown, type: number) => tickLabel(t as number, type, iana, fmt.hours12) : undefined,
    } as never);
    this.chart.applyOptions({
      localization: { timeFormatter: customLabel ? (t: unknown) => crosshairLabel(t as number, iana, fmt, intraday) : undefined },
    } as never);
  }

  setTimeFormat(fmt: TimeFormat) {
    this.timeFormat = fmt;
    this.applyZone();
  }

  /** Loads another symbol's series at the current resolution. Not an undoable step, like the reference. */
  setSymbol(sym: SymbolInfo) {
    if (sym.symbol === this.symbol.symbol) return;
    this.symbol = clean(sym);
    const range = this.chart.timeScale().getVisibleLogicalRange();
    this.show(this.resolution.id, { range });
  }

  /** Switches resolution without recording an undo step; used to restore a saved chart. */
  restoreResolution(id: string) {
    if (id !== this.resolution.id && RESOLUTIONS.some((r) => r.id === id)) this.show(id);
  }

  setTimezone(tz: Timezone) {
    this.timezone = tz;
    this.applyZone();
    this.listeners.forEach((fn) => fn());
  }

  private applyDefaultView(back?: number) {
    const last = this.bars.length - 1;
    // A feed holds far more history than fits on screen; starting at bar 0 would also trigger scroll-back paging at once.
    const span = back ?? (this.feed && this.status === "live" ? DEFAULT_FEED_BARS : undefined);
    this.chart.timeScale().setVisibleLogicalRange({ from: span === undefined ? 0 : Math.max(0, last - span), to: last + FUTURE_BARS });
  }

  /** Swaps in the series for the current symbol and the given resolution, then positions the view. `done` runs once the bars are on screen, which is later when they come from a datafeed. */
  private show(id: string, opts: { back?: number; range?: { from: number; to: number } | null; done?: () => void } = {}) {
    this.resolution = RESOLUTIONS.find((r) => r.id === id) ?? this.resolution;
    this.bars = genBars(600, this.resolution.sec, this.symbol.base, this.symbol.seed);
    const place = () => {
      if (opts.range) this.chart.timeScale().setVisibleLogicalRange(opts.range);
      else this.applyDefaultView(opts.back);
      opts.done?.();
    };
    if (this.feed) {
      this.status = "loading";
      this.load();
      this.listeners.forEach((fn) => fn());
      void this.fetchBars(place);
      return;
    }
    this.load();
    place();
    this.listeners.forEach((fn) => fn());
  }

  private change(label: string, id: string, back?: number, force = false) {
    if (id === this.resolution.id && !force) return;
    const prevId = this.resolution.id;
    const before = this.ctl.captureView();
    this.show(id, {
      back,
      done: () => {
        const after = this.ctl.captureView();
        this.ctl.recordAction(
          label,
          () => this.show(prevId, { done: () => this.ctl.applyView(before) }),
          () => this.show(id, { done: () => this.ctl.applyView(after) }),
        );
      },
    });
  }

  setResolution(id: string) {
    this.change("change resolution", id);
  }

  setRange(preset: RangePreset) {
    const p = RANGE_PRESETS[preset];
    let back = p.back;
    if (back === -1) {
      const now = new Date();
      back = Math.max(1, Math.round((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000));
    }
    this.change("change date range", p.res, back, true);
  }

  /** Loads the first page for the current symbol and resolution, then follows live bars. A newer request supersedes this one. */
  private async fetchBars(done: () => void) {
    const feed = this.feed;
    if (!feed) return;
    const token = ++this.feedToken;
    this.stopLive?.();
    this.stopLive = null;
    this.exhausted = false;
    this.loadingOlder = false;
    const { symbol, resolution } = this;
    try {
      const info = await feed.resolveSymbol(symbol.symbol);
      const now = Math.floor(Date.now() / 1000);
      const page = await feed.getBars(info, resolution.id, {
        from: now - PAGE_BARS * resolution.sec,
        to: now,
        firstDataRequest: true,
        direction: "forward",
        count: PAGE_BARS,
      });
      if (token !== this.feedToken) return;
      if (!page.length) throw new Error(`no bars for ${symbol.symbol}`);
      this.feedInfo = info;
      this.bars = page.map(fromFeed);
      this.status = "live";
      // Replacing the data and moving the view both emit range changes; none of them is the user scrolling back.
      this.settling = true;
      this.load();
      done();
      setTimeout(() => (this.settling = false), 0);
      this.listeners.forEach((fn) => fn());
      this.stopLive = feed.subscribeBars(info, resolution.id, (bar) => this.onLive(token, bar), page[page.length - 1]);
    } catch (err) {
      if (token !== this.feedToken) return;
      console.warn("[chart-lab] datafeed unavailable, showing mock bars:", err);
      this.feedInfo = null;
      this.status = "error";
      this.load();
      done();
      this.listeners.forEach((fn) => fn());
    }
  }

  private onLive(token: number, tick: DatafeedBar) {
    if (token !== this.feedToken || this.status !== "live") return;
    const bar = fromFeed(tick);
    const last = this.bars[this.bars.length - 1];
    if (last && bar.time < last.time) return;
    if (last && bar.time === last.time) this.bars[this.bars.length - 1] = bar;
    else this.bars.push(bar);
    const i = this.bars.length - 1;
    const barColor = this.colorsSuspended ? null : this.barColor;
    this.candles.update({ ...bar, time: bar.time as Time, ...(barColor ? barColor(bar, i ? this.bars[i - 1].close : bar.open) : {}) });
    this.volume()?.update({ time: bar.time as Time, value: bar.volume, color: bar.close >= bar.open ? UP : DOWN });
    this.listeners.forEach((fn) => fn());
  }

  /** Pages older history in when the view nears the left edge of the loaded bars. */
  private async onRange(range: { from: number } | null) {
    const feed = this.feed;
    const info = this.feedInfo;
    if (!feed || !info || !range || this.settling || this.status !== "live" || this.loadingOlder || this.exhausted) return;
    if (range.from > SCROLL_BACK_THRESHOLD) return;
    const earliest = this.bars[0];
    if (!earliest) return;
    const token = this.feedToken;
    this.loadingOlder = true;
    try {
      const sec = this.resolution.sec;
      const older = await feed.getBars(info, this.resolution.id, {
        from: earliest.time - PAGE_BARS * sec,
        to: earliest.time,
        firstDataRequest: false,
        direction: "backward",
        startPrice: earliest.open,
        count: PAGE_BARS,
      });
      if (token !== this.feedToken) return;
      const fresh = older.map(fromFeed).filter((b) => b.time < earliest.time);
      if (!fresh.length) {
        this.exhausted = true;
        return;
      }
      const view = this.chart.timeScale().getVisibleLogicalRange();
      this.bars = [...fresh, ...this.bars];
      this.load();
      // Indices shift by the number of prepended bars, so move the view with them.
      if (view) this.chart.timeScale().setVisibleLogicalRange({ from: view.from + fresh.length, to: view.to + fresh.length });
      this.listeners.forEach((fn) => fn());
    } catch (err) {
      console.warn("[chart-lab] scroll-back failed:", err);
    } finally {
      this.loadingOlder = false;
    }
  }

  dispose() {
    this.feedToken++;
    this.stopLive?.();
    this.stopLive = null;
    (this.feed as { destroy?: () => void } | undefined)?.destroy?.();
    this.listeners.clear();
  }

  /** Visible time span in unix seconds, or null before the first layout. */
  visibleTimes() {
    const r = this.chart.timeScale().getVisibleLogicalRange();
    if (!r) return null;
    const t0 = this.bars[0].time;
    const sec = this.resolution.sec;
    return { from: t0 + r.from * sec, to: t0 + r.to * sec };
  }

  /** Scrolls so the given time sits in the middle of the view, keeping the zoom. */
  goToDate(time: number) {
    const r = this.chart.timeScale().getVisibleLogicalRange();
    if (!r) return;
    const mid = (r.from + r.to) / 2;
    const target = (time - this.bars[0].time) / this.resolution.sec;
    this.moveView({ from: r.from + target - mid, to: r.to + target - mid });
  }

  /** Fits the view to the given time span. */
  goToRange(from: number, to: number) {
    const t0 = this.bars[0].time;
    const sec = this.resolution.sec;
    this.moveView({ from: (from - t0) / sec, to: (to - t0) / sec });
  }

  private moveView(range: { from: number; to: number }) {
    const before = this.ctl.captureView();
    this.chart.timeScale().setVisibleLogicalRange(range);
    this.ctl.recordAction(
      "change date range",
      () => this.ctl.applyView(before),
      () => this.chart.timeScale().setVisibleLogicalRange(range),
    );
  }
}
