import { AreaSeries, CandlestickData, CandlestickSeries, createChart, IChartApi, ISeriesApi, LineData, LineSeries, Time } from "../src";
import { DrawingManager, getToolRegistry, type Anchor, type DrawingStyle, type IDrawing } from "../src/drawing-tools";

/**
 * Generate deterministic fallback candlestick data (mirrors demo/main.ts).
 */
function generateFallbackData(days = 200): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  let basePrice = 100;
  const baseDate = new Date("2024-01-01");

  // Seeded pseudo-random for reproducible stories
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + i);

    const volatility = 0.02;
    const trend = Math.sin(i / 30) * 0.001;
    const change = (rand() - 0.5) * 2 * volatility + trend;

    const open = basePrice;
    const close = basePrice * (1 + change);
    const high = Math.max(open, close) * (1 + rand() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - rand() * volatility * 0.5);

    data.push({
      time: date.toISOString().split("T")[0] as Time,
      open,
      high,
      low,
      close,
    });

    basePrice = close;
  }

  return data;
}

export interface MountedChart {
  container: HTMLDivElement;
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
  manager: DrawingManager;
  data: CandlestickData<Time>[];
}

/**
 * Mount a chart with candlestick data and an attached DrawingManager.
 * Returns the container, chart, series, manager, and data.
 */
export function mountDrawingChart(): MountedChart {
  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = "500px";

  const chart = createChart(container, {
    layout: {
      background: { color: "#1a1a2e" },
      textColor: "#d1d4dc",
    },
    grid: {
      vertLines: { color: "#2B2B43" },
      horzLines: { color: "#2B2B43" },
    },
    crosshair: { mode: 1 },
    rightPriceScale: { borderColor: "#2B2B43" },
    timeScale: { borderColor: "#2B2B43", timeVisible: true },
  });

  const series = chart.addSeries(CandlestickSeries, {
    upColor: "#26a69a",
    downColor: "#ef5350",
    borderVisible: false,
    wickUpColor: "#26a69a",
    wickDownColor: "#ef5350",
  });

  const data = generateFallbackData();
  series.setData(data);
  chart.timeScale().fitContent();

  const manager = new DrawingManager();
  manager.attach(chart, series, container);

  return { container, chart, series, manager, data };
}

/**
 * Pick anchors from candlestick data at fractional positions along the array.
 * Each fraction (0–1) maps to a data point; the anchor uses that candle's
 * time and close price.
 */
export function pickAnchors(data: CandlestickData<Time>[], fractions: number[]): Anchor[] {
  return fractions.map((f) => {
    const idx = Math.max(0, Math.min(data.length - 1, Math.floor(f * data.length)));
    const candle = data[idx];
    return { time: candle.time, price: candle.close };
  });
}

/**
 * Default per-tool colors (mirrors demo/main.ts getToolColor).
 */
const TOOL_COLORS: Record<string, string> = {
  "trend-line": "#2962FF",
  "horizontal-line": "#FF6D00",
  "vertical-line": "#FF6D00",
  "ray": "#2962FF",
  "arrow": "#26A69A",
  "extended-line": "#2962FF",
  "cross-line": "#9C27B0",
  "info-line": "#00BCD4",
  "trend-angle": "#FF5722",
  "horizontal-ray": "#FF6D00",
  "rectangle": "#2962FF",
  "circle": "#E91E63",
  "triangle": "#FF9800",
  "price-range": "#4CAF50",
  "fib-retracement": "#FFD700",
  "fib-extension": "#FFD700",
  "fib-channel": "#FFD700",
  "fib-time-zone": "#FFD700",
  "fib-speed-fan": "#FFD700",
  "fib-time-extension": "#FFD700",
  "fib-circles": "#FFD700",
  "fib-spiral": "#FFD700",
  "fib-arcs": "#FFD700",
  "fib-wedge": "#FFD700",
  "pitchfan": "#FFD700",
  "parallel-channel": "#00BCD4",
  "regression-trend": "#00BCD4",
  "flat-top-bottom": "#00BCD4",
  "disjoint-channel": "#00BCD4",
  "andrews-pitchfork": "#9C27B0",
  "schiff-pitchfork": "#9C27B0",
  "modified-schiff-pitchfork": "#9C27B0",
  "inside-pitchfork": "#9C27B0",
  "gann-box": "#FF5722",
  "gann-fan": "#FF5722",
  "gann-square-fixed": "#FF5722",
  "gann-square": "#FF5722",
  "long-position": "#26A69A",
  "short-position": "#EF5350",
  "date-range": "#2196F3",
  "date-price-range": "#9C27B0",
  "projection": "#9C27B0",
  "text-annotation": "#FFFFFF",
  "callout": "#FFEB3B",
  "brush": "#E91E63",
  "highlighter": "#FFEB3B",
  "arrow-marker": "#2196F3",
  "arrow-mark-up": "#26A69A",
  "arrow-mark-down": "#EF5350",
  "ellipse": "#E91E63",
  "arc": "#9C27B0",
  "rotated-rectangle": "#2962FF",
  "path": "#E91E63",
  "polyline": "#00BCD4",
  "curve": "#9C27B0",
  "double-curve": "#FF5722",
  "anchored-text": "#FFFFFF",
  "note": "#FFEB3B",
  "price-note": "#26A69A",
  "price-label": "#2962FF",
  "flag-mark": "#EF5350",
  "pin": "#E91E63",
  "comment": "#2962FF",
  "signpost": "#FF9800",
  "table": "#607D8B",
  "forecast": "#26A69A",
  "bars-pattern": "#FF9800",
};

/**
 * Create a drawing from the tool registry and add it to the manager.
 * Mirrors the createDrawing() flow in demo/main.ts.
 */
export function createDrawingFromRegistry(
  manager: DrawingManager,
  toolType: string,
  id: string,
  anchors: Anchor[],
): IDrawing | null {
  const registry = getToolRegistry();
  const color = TOOL_COLORS[toolType] ?? "#2962FF";

  const style: Partial<DrawingStyle> = {
    lineColor: color,
    lineWidth: 2,
    fillColor: color + "33",
  };

  const drawing = registry.createDrawing(toolType, id, anchors, style);
  if (drawing) {
    manager.addDrawing(drawing);
    manager.selectDrawing(drawing.id);
  }
  return drawing;
}

/**
 * Generate deterministic line data for plugin stories.
 */
function generateLineData(numPoints = 500): LineData<Time>[] {
  const data: LineData<Time>[] = [];
  let basePrice = 100;
  const baseDate = new Date(Date.UTC(2018, 0, 1, 12, 0, 0, 0));

  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < numPoints; i++) {
    const date = new Date(baseDate);
    date.setUTCDate(baseDate.getUTCDate() + i);

    const volatility = 0.02;
    const trend = Math.sin(i / 30) * 0.001;
    const change = (rand() - 0.5) * 2 * volatility + trend;

    data.push({
      time: (date.getTime() / 1000) as Time,
      value: basePrice,
    });

    basePrice = basePrice * (1 + change);
  }

  return data;
}

/**
 * Generate deterministic candlestick data for plugin stories.
 */
function generateCandleData(numPoints = 200): CandlestickData<Time>[] {
  const lineData = generateLineData(numPoints);
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return lineData.map((d) => {
    const range = rand() * 10;
    const sign = Math.sin(rand() - 0.5);
    return {
      time: d.time,
      low: d.value - range,
      high: d.value + range,
      open: d.value + sign * range,
      close: d.value + sign * range * 0.5,
    };
  });
}

export interface PluginChart {
  container: HTMLDivElement;
  chart: IChartApi;
}

/**
 * Mount a bare chart container on the storybook root with dark theme.
 */
export function mountPluginChart(extraOptions?: Record<string, any>): PluginChart {
  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = "500px";

  const root = document.getElementById("storybook-root") ?? document.body;
  root.appendChild(container);

  const chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { color: "#1a1a2e" },
      textColor: "#d1d4dc",
    },
    grid: {
      vertLines: { color: "#2B2B43" },
      horzLines: { color: "#2B2B43" },
    },
    crosshair: { mode: 1 },
    rightPriceScale: { borderColor: "#2B2B43" },
    timeScale: { borderColor: "#2B2B43", timeVisible: true },
    ...extraOptions,
  });

  return { container, chart };
}

/**
 * Mount chart + line series with data.
 */
export function mountPluginLineChart(): PluginChart & {
  series: ISeriesApi<"Line">;
  data: LineData<Time>[];
} {
  const { container, chart } = mountPluginChart();
  const series = chart.addSeries(LineSeries, { color: "#2962FF" });
  const data = generateLineData();
  series.setData(data);
  chart.timeScale().fitContent();
  return { container, chart, series, data };
}

/**
 * Mount chart + area series with data.
 */
export function mountPluginAreaChart(): PluginChart & {
  series: ISeriesApi<"Area">;
  data: LineData<Time>[];
} {
  const { container, chart } = mountPluginChart();
  const series = chart.addSeries(AreaSeries, {
    lineColor: "rgb(4,153,129)",
    topColor: "rgba(4,153,129, 0.4)",
    bottomColor: "rgba(4,153,129, 0)",
    priceLineVisible: false,
  });
  const data = generateLineData();
  series.setData(data);
  chart.timeScale().fitContent();
  return { container, chart, series, data };
}

/**
 * Mount chart + candlestick series with data.
 */
export function mountPluginCandleChart(): PluginChart & {
  series: ISeriesApi<"Candlestick">;
  data: CandlestickData<Time>[];
} {
  const { container, chart } = mountPluginChart();
  const series = chart.addSeries(CandlestickSeries, {
    upColor: "#26a69a",
    downColor: "#ef5350",
    borderVisible: false,
    wickUpColor: "#26a69a",
    wickDownColor: "#ef5350",
  });
  const data = generateCandleData();
  series.setData(data);
  chart.timeScale().fitContent();
  return { container, chart, series, data };
}

export { generateCandleData, generateLineData };
