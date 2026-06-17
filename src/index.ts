/// <reference types="_build-time-constants" />

import {
	customStyleDefaults,
	seriesOptionsDefaults,
} from "./api/options/series-options-defaults";
import { CustomSeriesOptions } from "./model/series-options";

export { LineStyle, LineType } from "./renderers/draw-line";

export { TrackingModeExitMode } from "./model/chart-model";
export { CrosshairMode } from "./model/crosshair";
export { ColorType } from "./model/layout-options";
export { MismatchDirection } from "./model/plot-list";
export { PriceScaleMode } from "./model/price-scale";
export { LastPriceAnimationMode, PriceLineSource } from "./model/series-options";

export {
	TickMarkType,
	isBusinessDay,
	isUTCTimestamp,
} from "./model/horz-scale-behavior-time/types";
export type {
	CustomBarItemData,
	CustomData,
	CustomSeriesHitTestResult,
	ICustomSeriesPaneRenderer,
	ICustomSeriesPaneView,
} from "./model/icustom-series";
export const customSeriesDefaultOptions: CustomSeriesOptions = {
	...seriesOptionsDefaults,
	...customStyleDefaults,
};

export { createChart, createChartEx, defaultHorzScaleBehavior } from "./api/create-chart";
export { createOptionsChart } from "./api/create-options-chart";
export { createYieldCurveChart } from "./api/create-yield-curve-chart";

export { areaSeries as AreaSeries } from "./model/series/area-series";
export { barSeries as BarSeries } from "./model/series/bar-series";
export { baselineSeries as BaselineSeries } from "./model/series/baseline-series";
export { candlestickSeries as CandlestickSeries } from "./model/series/candlestick-series";
export { histogramSeries as HistogramSeries } from "./model/series/histogram-series";
export { lineSeries as LineSeries } from "./model/series/line-series";
/*
	Plugins
*/
export type { ImageWatermarkPosition } from "./plugins/image-watermark/options";
export { createImageWatermark } from "./plugins/image-watermark/primitive";
export { createSeriesMarkers } from "./plugins/series-markers/wrapper";
export { createTextWatermark } from "./plugins/text-watermark/primitive";
export { createUpDownMarkers } from "./plugins/up-down-markers-plugin/wrapper";

/**
 * Returns the current version as a string. For example `'3.3.0'`.
 */
export function version(): string {
	return process.env.BUILD_VERSION;
}
