import { UTCTimestamp } from '../model/horz-scale-behavior-time/types';

/**
 * A single OHLCV bar produced by a datafeed.
 *
 * `time` is a UNIX timestamp in **seconds** (matching the `Time` type used by
 * lightweight-charts for time-based horizontal scales).
 */
export interface DatafeedBar {
	time: UTCTimestamp;
	open: number;
	high: number;
	low: number;
	close: number;
	volume?: number;
}

/**
 * Metadata describing a symbol. A subset of TradingView's `LibrarySymbolInfo`
 * that the {@link DatafeedController} actually consumes.
 */
export interface DatafeedSymbolInfo {
	/** Ticker / name, e.g. `BTCUSDT`. */
	name: string;
	/** Full symbol name, e.g. `SPOT:BTC/USDT`. */
	fullName: string;
	/** Pricescale (1 / tick size), e.g. `100` for 2 decimals. */
	priceScale: number;
	/** Supported resolutions, e.g. `['1','5','60','1D']`. */
	supportedResolutions: string[];
}

/**
 * Parameters passed to {@link IDatafeedChartApi.getBars}.
 *
 * `from` / `to` are UNIX timestamps in **seconds**. Both are inclusive bounds of
 * the requested time window.
 *
 * `firstDataRequest` is `true` for the initial load (the chart has no bars yet)
 * and `false` for subsequent scroll-back / forward requests.
 *
 * `direction: 'backward'` indicates the chart is requesting bars **older** than
 * the current earliest bar. When set, a `startPrice` (the open of the current
 * earliest bar) is provided so the datafeed can produce seamless continuity.
 */
export interface DatafeedPeriodParams {
	from: number;
	to: number;
	firstDataRequest: boolean;
	/** Scroll direction. `'forward'` (default) = toward the present, `'backward'` = into the past. */
	direction?: 'forward' | 'backward';
	/** Present when `direction === 'backward'`: the open price of the current earliest bar, for continuity. */
	startPrice?: number;
	/** Maximum number of bars to return. */
	count?: number;
}

/**
 * Callback invoked by {@link IDatafeedChartApi.subscribeBars} for each realtime
 * bar update. Receives the updated bar (same time = update last, new time = append).
 */
export type DatafeedBarsCallback = (bar: DatafeedBar) => void;

/**
 * Promise-style datafeed contract consumed by {@link DatafeedController}.
 *
 * This is intentionally transport-agnostic: the chart library does not know
 * whether bars come from a SharedWorker, a REST API, or in-memory mock.
 * `apps/web` supplies a concrete implementation that talks to the SharedWorker.
 */
export interface IDatafeedChartApi {
	/**
	 * Resolve a symbol string (e.g. `BTC/USDT`) to {@link DatafeedSymbolInfo}.
	 */
	resolveSymbol(symbol: string): Promise<DatafeedSymbolInfo>;

	/**
	 * Request bars for a symbol/resolution within a time window.
	 *
	 * Returns an array of bars sorted by time ascending. Empty array means
	 * "no data in this range" (the controller treats this as end-of-history).
	 */
	getBars(
		symbolInfo: DatafeedSymbolInfo,
		resolution: string,
		periodParams: DatafeedPeriodParams,
	): Promise<DatafeedBar[]>;

	/**
	 * Subscribe to realtime bar updates for a symbol/resolution.
	 *
	 * @returns an unsubscribe function — call it to stop receiving updates.
	 */
	subscribeBars(
		symbolInfo: DatafeedSymbolInfo,
		resolution: string,
		onBar: DatafeedBarsCallback,
		lastBar?: DatafeedBar,
	): () => void;
}

/**
 * Options for the `datafeed` / `datafeedOptions` chart options.
 *
 * Passed alongside `datafeed: IDatafeedChartApi` in `createChart(el, { datafeed, datafeedOptions })`.
 */
export interface DatafeedOptions {
	/** Symbol string to resolve, e.g. `BTC/USDT`. */
	symbol: string;
	/** Resolution string, e.g. `1`, `5`, `60`, `1D`. */
	resolution: string;
	/** Number of bars to fetch on the initial load. @defaultValue 500 */
	initialCount?: number;
	/**
	 * When the number of bars before the visible range drops below this
	 * threshold, the controller fetches older bars. @defaultValue 50
	 */
	scrollBackThreshold?: number;
	/** Maximum bars kept in the controller's in-memory mirror. @defaultValue 20000 */
	maxBars?: number;
}

/**
 * A bars-change listener. Fired by {@link DatafeedController.onBars} on initial
 * load, scroll-back prepend, and realtime update — so external consumers (legend,
 * replay) can mirror the controller's bar array without touching the series.
 */
export type DatafeedBarsListener = (bars: readonly DatafeedBar[], lastBar: DatafeedBar | null) => void;