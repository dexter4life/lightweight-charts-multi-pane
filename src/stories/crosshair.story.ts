import type { Meta, StoryObj } from "@storybook/html";
import { generateCandleData, mountPluginChart } from "../../.storybook/chart-helpers";
import { CrosshairMode } from "../../lib/prod/src";
import { CandlestickSeries, LineStyle } from "../index";
import type { CandlestickData } from "../model/data-consumer";
import type { Time } from "../model/horz-scale-behavior-time/types";

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
			mode: CrosshairMode.Normal,
			horzLine: {
				visible: true,
				labelVisible: true,
				style: LineStyle.LargeDashed,
				width: 1,
			},
			vertLine: {
				labelVisible: true,
				style: LineStyle.LargeDashed,
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
