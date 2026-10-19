import {
  AreaSeries,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
} from "lightweight-charts-multi-pane";
import type { IconName } from "./components/icons";
import type { Bar } from "./data";
import type { DrawingController } from "./controller";
import type { Market } from "./market";
import type { ChartSettings } from "./chart-settings";

export type ChartTypeId = "bars" | "candles" | "hollow" | "columns" | "line" | "area" | "baseline" | "hilo" | "ha";

export const CHART_TYPES: { id: ChartTypeId; label: string; icon: IconName }[] = [
  { id: "bars", label: "Bars", icon: "ctBars" },
  { id: "candles", label: "Candles", icon: "candles" },
  { id: "hollow", label: "Hollow candles", icon: "ctHollow" },
  { id: "columns", label: "Columns", icon: "ctColumns" },
  { id: "line", label: "Line", icon: "ctLine" },
  { id: "area", label: "Area", icon: "ctArea" },
  { id: "baseline", label: "Baseline", icon: "ctBaseline" },
  { id: "hilo", label: "High-low", icon: "ctHiLo" },
  { id: "ha", label: "Heikin Ashi", icon: "ctHa" },
];

const UP = "#089981";
const DOWN = "#f23645";
const BLUE = "#2962ff";
const CLEAR = "rgba(0,0,0,0)";

const heikinAshi = (bars: Bar[]) => {
  let po = 0;
  let pc = 0;
  return bars.map((b, i) => {
    const close = (b.open + b.high + b.low + b.close) / 4;
    const open = i === 0 ? (b.open + b.close) / 2 : (po + pc) / 2;
    po = open;
    pc = close;
    return { time: b.time as Time, open, close, high: Math.max(b.high, open, close), low: Math.min(b.low, open, close) };
  });
};

/**
 * Switches how the price series is drawn. The real candlestick series always stays in place
 * (drawings, magnet and the legend read it); other styles are drawn by an overlay series
 * while the candles are made invisible.
 */
export class ChartStyle {
  type: ChartTypeId = "candles";
  private overlay: ISeriesApi<SeriesType> | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private chart: IChartApi,
    private candles: ISeriesApi<"Candlestick">,
    private market: Market,
    private ctl: DrawingController,
    private settings: ChartSettings,
  ) {
    market.subscribe(() => this.apply());
    // Colour, line and label settings change the candle options; other keys do not concern the candles.
    settings.subscribe((keys) => {
      if (keys.some((k) => /^(body|border|wick|lastLine|lastPriceOn|symName|colorByPrev)$/.test(k))) this.apply();
    });
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  set(id: ChartTypeId) {
    if (id === this.type) return;
    const prev = this.type;
    this.type = id;
    this.apply();
    this.ctl.recordAction(
      "change series style",
      () => this.restore(prev),
      () => this.restore(id),
    );
  }

  private restore(id: ChartTypeId) {
    this.type = id;
    this.apply();
  }

  private clearOverlay() {
    if (this.overlay) this.chart.removeSeries(this.overlay);
    this.overlay = null;
  }

  private apply() {
    const t = this.type;
    const bars = this.market.bars;
    this.clearOverlay();
    const normal = this.settings.candleOptions();
    const suspend = t !== "candles" && t !== "hollow";
    if (this.market.colorsSuspended !== suspend) {
      this.market.colorsSuspended = suspend;
      if (this.market.barColor) this.market.refreshCandles();
    }
    if (t === "candles") this.candles.applyOptions(normal);
    else if (t === "hollow") this.candles.applyOptions({ ...normal, upColor: CLEAR });
    else {
      this.candles.applyOptions({
        upColor: CLEAR, downColor: CLEAR, borderVisible: false, wickVisible: false, lastValueVisible: false, priceLineVisible: false, title: "",
      });
      this.overlay = this.build(t, bars);
    }
    this.listeners.forEach((fn) => fn());
  }

  private build(t: ChartTypeId, bars: Bar[]): ISeriesApi<SeriesType> {
    const time = (b: Bar) => b.time as Time;
    const common = { priceLineStyle: 4, priceLineColor: DOWN };
    const close = bars.map((b) => ({ time: time(b), value: b.close }));
    let s: ISeriesApi<SeriesType>;
    switch (t) {
      case "bars": {
        const bs = this.chart.addSeries(BarSeries, { upColor: UP, downColor: DOWN, ...common });
        bs.setData(bars.map((b) => ({ time: time(b), open: b.open, high: b.high, low: b.low, close: b.close })));
        s = bs;
        break;
      }
      case "columns": {
        const base = Math.min(...bars.map((b) => b.low));
        const hs = this.chart.addSeries(HistogramSeries, { base, ...common });
        hs.setData(bars.map((b, i) => ({ time: time(b), value: b.close, color: b.close >= (bars[i - 1]?.close ?? b.open) ? "rgba(8,153,129,0.43)" : "rgba(242,54,69,0.43)" })));
        s = hs;
        break;
      }
      case "line": {
        const ls = this.chart.addSeries(LineSeries, { color: BLUE, lineWidth: 2, ...common, priceLineColor: BLUE });
        ls.setData(close);
        s = ls;
        break;
      }
      case "area": {
        const as = this.chart.addSeries(AreaSeries, {
          lineColor: BLUE, lineWidth: 2, topColor: "rgba(41,98,255,0.28)", bottomColor: "rgba(41,98,255,0.05)", ...common, priceLineColor: BLUE,
        });
        as.setData(close);
        s = as;
        break;
      }
      case "baseline": {
        const lows = bars.map((b) => b.low);
        const highs = bars.map((b) => b.high);
        const mid = (Math.min(...lows) + Math.max(...highs)) / 2;
        const bl = this.chart.addSeries(BaselineSeries, {
          baseValue: { type: "price", price: mid },
          topLineColor: UP, bottomLineColor: DOWN, lineWidth: 2,
          topFillColor1: "rgba(8,153,129,0.28)", topFillColor2: "rgba(8,153,129,0.05)",
          bottomFillColor1: "rgba(242,54,69,0.05)", bottomFillColor2: "rgba(242,54,69,0.28)",
          ...common,
        });
        bl.setData(close);
        s = bl;
        break;
      }
      case "hilo": {
        const hl = this.chart.addSeries(CandlestickSeries, {
          upColor: BLUE, downColor: BLUE, borderUpColor: BLUE, borderDownColor: BLUE, wickVisible: false, ...common, priceLineColor: BLUE,
        });
        hl.setData(bars.map((b) => ({ time: time(b), open: b.high, high: b.high, low: b.low, close: b.low })));
        s = hl;
        break;
      }
      default: {
        const ha = this.chart.addSeries(CandlestickSeries, {
          upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, ...common,
        });
        ha.setData(heikinAshi(bars));
        s = ha;
      }
    }
    return s;
  }
}
