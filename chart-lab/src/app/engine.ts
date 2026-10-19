import { CandlestickSeries, HistogramSeries, PriceAlerts, createChart } from "lightweight-charts-multi-pane";
import type { IChartApi, ISeriesApi } from "lightweight-charts-multi-pane";
import { Market } from "../market";
import type { MarketOptions } from "../market";
import { ChartStyle } from "../chart-type";
import { ChartSettings } from "../chart-settings";
import { DrawingController } from "../controller";
import { PriceScaleControl } from "../scale";
import { Indicators, indicatorLabel, type IndicatorKind, type IndicatorSnapshot } from "../indicators";
import { PaneLayout } from "../panes";
import { VolumeStudy } from "../volume-study";
import { installStickerSources } from "../stickers/lottie-source";
import { PALETTES, currentScheme, onSchemeChange, type ColorScheme } from "../theme";

const UP = "#089981";
const DOWN = "#f23645";
/** Colour of the alert lines and of the crosshair's "+" button; the plugin's own default is for light backgrounds. */
const ALERT_COLOR: Record<ColorScheme, string> = { light: "#131722", dark: "#758696" };

type Listener = () => void;

/** Owns the chart, its series and the non-visual controllers. React components only read from it and call its methods. */
export class ChartEngine {
  readonly chart: IChartApi;
  readonly candles: ISeriesApi<"Candlestick">;
  readonly ctl: DrawingController;
  readonly market: Market;
  readonly settings: ChartSettings;
  readonly style: ChartStyle;
  readonly scaleCtl: PriceScaleControl;
  readonly indicators: Indicators;
  readonly panes: PaneLayout;
  readonly volumeStudy: VolumeStudy;
  /** The library's price-alert plugin: the crosshair's "+" button on the price axis, and the alert lines it adds. */
  readonly alerts: PriceAlerts;
  /** The element the chart canvas lives in (`#chart`). */
  readonly chartHost: HTMLElement;
  /** Positioned ancestor for chart overlays (`#chart-host`). */
  readonly overlayHost: HTMLElement;

  private volumeSeries: ISeriesApi<"Histogram">;
  private volumeRemoved = false;
  private volumeListeners = new Set<Listener>();
  private stopSchemeWatch: () => void;

  constructor(chartHost: HTMLElement, overlayHost: HTMLElement, opts: MarketOptions = {}) {
    installStickerSources();
    this.chartHost = chartHost;
    this.overlayHost = overlayHost;
    const scheme = currentScheme();
    const palette = PALETTES[scheme];
    this.chart = createChart(chartHost, {
      autoSize: true,
      // Lets the plot see the Alt key, which the Demonstration cursor needs for its trail.
      captureFocus: true,
      layout: {
        background: { color: palette.bg },
        textColor: palette.textColor,
        fontSize: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
        attributionLogo: false,
        brandLogo: opts.brandLogo,
      },
      grid: { vertLines: { color: palette.vertGrid }, horzLines: { color: palette.horzGrid } },
      rightPriceScale: { borderVisible: false, minimumWidth: 79 },
      timeScale: { borderColor: palette.scaleLines, rightOffset: 9, barSpacing: 6, timeVisible: false },
    } as never);

    this.candles = this.chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceLineColor: DOWN,
      priceLineStyle: 4,
    });
    this.candles.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.08 } });

    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      priceLineVisible: false,
    });
    this.volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
    this.candles.setSeriesOrder(1);

    this.ctl = new DrawingController(this.chart, this.candles, chartHost, this.volumeSeries);
    this.market = new Market(this.chart, this.candles, () => this.volume, this.ctl, opts);
    this.indicators = new Indicators(this.chart, this.candles, this.market);
    this.panes = new PaneLayout({
      chart: this.chart,
      isMain: (index) => index === this.candles.getPane().paneIndex(),
      // Only panes made of indicators can be deleted; the candles and volume stay.
      isProtected: (index) =>
        index === this.candles.getPane().paneIndex() || index === this.volume?.getPane().paneIndex() || this.indicators.inPane(index).length === 0,
      removeContents: (index) => this.indicators.removePane(index),
    });
    this.indicators.subscribe(() => this.panes.sync());
    this.volumeStudy = new VolumeStudy(this.chart, this.volumeSeries, this.market);
    this.settings = new ChartSettings({
      chart: this.chart,
      candles: this.candles,
      volume: () => this.volume,
      market: this.market,
      host: overlayHost,
      scheme,
    });
    this.alerts = new PriceAlerts({ line: { color: ALERT_COLOR[scheme] } });
    this.alerts.setSymbolName(this.market.symbol.symbol);
    this.market.subscribe(() => this.alerts.setSymbolName(this.market.symbol.symbol));
    this.candles.attachPrimitive(this.alerts);
    this.stopSchemeWatch = onSchemeChange((next) => {
      this.settings.setScheme(next);
      this.alerts.setColor(ALERT_COLOR[next]);
    });

    const toggleLine = (key: "lastLine" | "hiLoLine", label: string) => {
      const prev = { ...this.settings.data[key] };
      const next = { ...prev, on: !prev.on };
      this.settings.set(key, next);
      this.ctl.recordAction(label, () => this.settings.set(key, prev), () => this.settings.set(key, next));
    };
    this.ctl.bindLines({
      priceLine: () => this.settings.data.lastLine.on,
      highLow: () => this.settings.data.hiLoLine.on,
      togglePriceLine: () => toggleLine("lastLine", "change price line visibility"),
      toggleHighLow: () => toggleLine("hiLoLine", "change high and low price lines visibility"),
    });

    this.style = new ChartStyle(this.chart, this.candles, this.market, this.ctl, this.settings);
    this.scaleCtl = new PriceScaleControl(this.chart, this.ctl);
  }

  /** Routes global keyboard shortcuts to this chart only while it is the active one in a grid. */
  get keysEnabled(): boolean {
    return this.ctl.keysEnabled;
  }
  set keysEnabled(on: boolean) {
    this.ctl.keysEnabled = on;
    this.scaleCtl.keysEnabled = on;
  }

  /** The volume histogram, or null once the user has removed it. */
  get volume(): ISeriesApi<"Histogram"> | null {
    return this.volumeRemoved ? null : this.volumeSeries;
  }

  get isVolumeRemoved() {
    return this.volumeRemoved;
  }

  removeVolume() {
    if (this.volumeRemoved) return;
    this.volumeStudy.detach();
    this.chart.removeSeries(this.volumeSeries);
    this.volumeRemoved = true;
    this.volumeListeners.forEach((fn) => fn());
  }

  onVolumeRemoved(fn: Listener) {
    this.volumeListeners.add(fn);
    return () => void this.volumeListeners.delete(fn);
  }

  /** Adds an indicator to this chart as one undoable step. */
  addIndicator(kind: IndicatorKind) {
    const manager = this.indicators;
    const created = manager.add(kind);
    const id = created.id;
    let saved: IndicatorSnapshot = manager.snapshot(id)!;
    this.ctl.recordAction(
      `add ${indicatorLabel(created)}`,
      () => {
        saved = manager.snapshot(id) ?? saved;
        manager.remove(id);
      },
      () => {
        manager.restore(saved);
      },
    );
    return created;
  }

  dispose() {
    this.stopSchemeWatch();
    this.panes.dispose();
    this.indicators.dispose();
    this.volumeStudy.dispose();
    this.market.dispose();
    this.volumeListeners.clear();
    this.scaleCtl.dispose();
    try {
      this.candles.detachPrimitive(this.alerts);
      this.ctl.dispose();
    } finally {
      this.chart.remove();
    }
  }
}
