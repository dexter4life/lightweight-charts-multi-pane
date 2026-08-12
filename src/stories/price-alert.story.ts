import type { Meta, StoryObj } from "@storybook/html";

import { mountPluginChart } from "../../.storybook/chart-helpers";
import { CandlestickSeries, PriceAlerts } from "../index";
import type { CandlestickData } from "../model/data-consumer";
import type { Time } from "../model/horz-scale-behavior-time/types";

/**
 * Deterministic candlestick data so alert Y-coordinates are stable
 * across reloads (makes debugging line positions reproducible).
 */
function generateCandleData(numPoints = 200): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  let basePrice = 100;
  const baseDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0, 0));

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

    const open = basePrice;
    const close = basePrice * (1 + change);
    const high = Math.max(open, close) * (1 + rand() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - rand() * volatility * 0.5);

    data.push({
      time: (date.getTime() / 1000) as Time,
      open,
      high,
      low,
      close,
    });

    basePrice = close;
  }

  return data;
}

const meta: Meta = {
  title: "Plugins/Price Alert",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

interface PriceAlertStoryOptions {
  /** Alert line / button colour. Defaults to the plugin's own `#131722`. */
  alertColor?: string;
  /** Chart background colour. Defaults to `#1a1a2e` (dark). */
  background?: string;
  /** Pre-seed alerts at these prices (relative to last close). */
  seedAlerts?: number[];
  /** Symbol name shown in the hover label. */
  symbol?: string;
}

/**
 * Mount a chart + candlestick series + PriceAlerts primitive.
 * Pre-seeds alerts and wires lifecycle logging so we can inspect
 * rendering in isolation from the app's React glue.
 */
function mountPriceAlertStory(options: PriceAlertStoryOptions = {}): HTMLDivElement {
  const {
    alertColor,
    background = "#1a1a2e",
    seedAlerts = [],
    symbol = "BTC/USDT",
  } = options;

  const { container, chart } = mountPluginChart({
    layout: {
      background: { color: background },
      textColor: "#d1d4dc",
    },
  });

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

  const priceAlert = new PriceAlerts();
  priceAlert.setSymbolName(symbol);
  if (alertColor) {
    priceAlert.setColor(alertColor);
  }
  series.attachPrimitive(priceAlert);

  priceAlert.alertAdded().subscribe((info) => {
    // eslint-disable-next-line no-console
    console.log(`[price-alert] ➕ added id=${info.id} price=${info.price}`);
  });
  priceAlert.alertRemoved().subscribe((id) => {
    // eslint-disable-next-line no-console
    console.log(`[price-alert] ❌ removed id=${id}`);
  });

  // Seed alerts at absolute prices once the series has a price scale.
  const lastClose = data[data.length - 1].close;
  seedAlerts.forEach((offset, i) => {
    const price = lastClose + offset;
    // eslint-disable-next-line no-console
    console.log(
      `[price-alert] seeding #${i} at price=${price.toFixed(4)} (lastClose=${lastClose.toFixed(4)}, offset=${offset})`,
    );
    priceAlert.addAlert(price);
  });

  // Expose handles on the window for live debugging in the storybook iframe.
  (window as any).__priceAlert = { chart, series, priceAlert, data };

  return container;
}

export const DarkTheme: Story = {
  render: () =>
    mountPriceAlertStory({
      background: "#1a1a2e",
      seedAlerts: [10, -10, 20],
    }),
};

export const LightTheme: Story = {
  render: () =>
    mountPriceAlertStory({
      background: "#ffffff",
      seedAlerts: [10, -10, 20],
    }),
};

export const CustomColor: Story = {
  render: () =>
    mountPriceAlertStory({
      background: "#1a1a2e",
      alertColor: "#2962FF",
      seedAlerts: [10, -10, 20],
    }),
};

export const NoAlerts: Story = {
  render: () => mountPriceAlertStory({}),
};