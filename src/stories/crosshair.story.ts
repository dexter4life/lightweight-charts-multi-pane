import type { Meta, StoryObj } from "@storybook/html";
import { generateCandleData, mountPluginChart } from "../../.storybook/chart-helpers";
import { CandlestickSeries, LineStyle } from "../index";
import type { CandlestickData } from "../model/data-consumer";
import type { Time } from "../model/horz-scale-behavior-time/types";
import { Crosshair } from "../plugins/crosshair/index";

function mountCrosshairStory(background: string): HTMLDivElement {
	const { container, chart } = mountPluginChart({
		layout: {
			background: { color: background },
			textColor: background === "#ffffff" ? "#131722" : "#d1d4dc",
		},
		autoSize: true,
		grid: {
			vertLines: {
				visible: false,
			},
			horzLines: {
				visible: false,
			},
		},
		timeScale: {
			borderVisible: false,
		},
		rightPriceScale: {
			borderVisible: false,
		},
		crosshair: {
			horzLine: {
				visible: false,
				labelVisible: false,
			},
			vertLine: {
				labelVisible: false,
				style: LineStyle.Solid,
				width: 1,
			},
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
	series.setData(data as CandlestickData<Time>[]);
	chart.timeScale().fitContent();

	const crosshair = new Crosshair();
	series.attachPrimitive(crosshair);

	(window as any).__crosshair = { chart, series, crosshair, data };

	return container;
}

const meta: Meta = {
	title: "Plugins/Crosshair",
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const DarkTheme: Story = {
	render: () => mountCrosshairStory("#1a1a2e"),
};

export const LightTheme: Story = {
	render: () => mountCrosshairStory("#ffffff"),
};
