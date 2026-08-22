import type { Meta, StoryObj } from "@storybook/html";
import { generateCandleData, mountPluginChart } from "../../.storybook/chart-helpers";
import { CandlestickSeries, LineStyle } from "../index";
import { CrosshairMode } from "../model/crosshair";
import type { CandlestickData } from "../model/data-consumer";
import type { Time } from "../model/horz-scale-behavior-time/types";
import { CrosshairPluginOptions, CrosshairType } from "../plugins/crosshair/state";

function mountCrosshairTypeStory(
	crosshairOption: CrosshairPluginOptions,
	captureFocus: boolean = false,
): HTMLDivElement {
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
		crosshair: {
			...crosshairOption,
		},
		captureFocus,
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

	// const crosshair = new Crosshair(crosshairOption);
	// // series.attachPrimitive(crosshair);
	// // crosshair.setHasFocus(true);

	// (window as any).__crosshair = { chart, series, crosshair, data };

	return container;
}

const meta: Meta = {
	title: "Plugins/Crosshair Types",
	tags: ["autodocs"],
	parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

const crosshairOption: CrosshairPluginOptions = {
	mode: CrosshairMode.Normal,
	type: CrosshairType.Cross,
	anchor: { color: "black", strokeColor: "white" },
	horzLine: {
		color: "#758696",
		width: 1,
		style: LineStyle.LargeDashed,
		visible: true,
		labelVisible: true,
		labelBackgroundColor: "#4c525e",
	},
	vertLine: {
		color: "#758696",
		width: 1,
		style: LineStyle.LargeDashed,
		visible: true,
		labelVisible: true,
		labelBackgroundColor: "#4c525e",
	},
	doNotSnapToHiddenSeriesIndices: false,
};

export const Cross: Story = {
	render: () =>
		mountCrosshairTypeStory({
			...crosshairOption,
			type: CrosshairType.Cross,
		}),
};

export const Dot: Story = {
	render: () =>
		mountCrosshairTypeStory({
			...crosshairOption,
			type: CrosshairType.Dot,
		}),
};

export const Arrow: Story = {
	render: () =>
		mountCrosshairTypeStory({
			...crosshairOption,
			type: CrosshairType.Arrow,
		}),
};

export const Demonstration: Story = {
	render: () =>
		mountCrosshairTypeStory(
			{
				...crosshairOption,
				type: CrosshairType.Demo,
			},
			true,
		),
};
