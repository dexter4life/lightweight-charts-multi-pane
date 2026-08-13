import type { Meta, StoryObj } from "@storybook/html";
import { generateCandleData, mountPluginChart } from "../../.storybook/chart-helpers";
import { CandlestickSeries, LineStyle } from "../index";
import type { CandlestickData } from "../model/data-consumer";
import type { Time } from "../model/horz-scale-behavior-time/types";
import { CrosshairType } from "../plugins/crosshair/constants";
import { Crosshair } from "../plugins/crosshair/index";

function mountCrosshairTypeStory(crossType: CrosshairType): HTMLDivElement {
	const { container, chart } = mountPluginChart({
		layout: {
			background: { color: "#1a1a2e" },
			textColor: "#d1d4dc",
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
                visible: false,
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

	const crosshair = new Crosshair({ crossType });
	series.attachPrimitive(crosshair);

	(window as any).__crosshair = { chart, series, crosshair, data };

	return container;
}

const meta: Meta = {
	title: "Plugins/Crosshair Types",
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const Cross: Story = {
	render: () => mountCrosshairTypeStory(CrosshairType.CROSS),
};

export const Dot: Story = {
	render: () => mountCrosshairTypeStory(CrosshairType.DOT),
};

export const Arrow: Story = {
	render: () => mountCrosshairTypeStory(CrosshairType.ARROW),
};

export const Demonstration: Story = {
	render: () => mountCrosshairTypeStory(CrosshairType.DEMONSTRATION),
};