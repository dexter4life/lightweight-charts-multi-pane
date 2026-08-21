import { Delegate } from '../helpers/delegate';

import { Time } from '../model/horz-scale-behavior-time/types';
import { LogicalRange } from '../model/time-data';
import { IChartApi } from './create-chart';
import {
    DatafeedBar,
    DatafeedBarsListener,
    DatafeedOptions,
    DatafeedSymbolInfo,
    IDatafeedChartApi,
} from './datafeed-api';
import { ISeriesApi } from './iseries-api';

/**
 * Default option values — kept here (not in `datafeed-api.ts`) so they live next
 * to the only consumer.
 */
const DEFAULT_INITIAL_COUNT = 500;
const DEFAULT_SCROLLBACK_THRESHOLD = 50;
const DEFAULT_MAX_BARS = 20000;

/**
 * Drives a chart series' data from a {@link IDatafeedChartApi}.
 *
 * One controller per chart. Created by {@link ChartApi} when the `datafeed`
 * chart option is set. The controller binds to the **first** series added
 * (see {@link bindSeries}) and then:
 *
 * 1. Resolves the symbol and loads `initialCount` bars ending at "now" via
 *    `datafeed.getBars` → `series.setData`.
 * 2. Subscribes to realtime updates via `datafeed.subscribeBars` → `series.update`.
 * 3. Subscribes to `chart.timeScale().subscribeVisibleLogicalRangeChange`.
 *    When `series.barsInLogicalRange(range).barsBefore < scrollBackThreshold`
 *    and no fetch is in-flight, it requests older bars (`direction: 'backward'`,
 *    `startPrice` = current earliest bar's open) and prepends them via
 *    `series.setData(merged)` (deduped by time, sorted ascending).
 *
 * The controller keeps an in-memory mirror of the bar array (capped at
 * `maxBars`, oldest dropped) so it can compute the earliest bar and emit
 * {@link onBars} for external consumers (legend, replay) without touching the
 * series.
 */
export class DatafeedController {
	private _chart: IChartApi;
	private _datafeed: IDatafeedChartApi;
	private _options: DatafeedOptions;

	private _series: ISeriesApi<any> | null = null;
	private _symbolInfo: DatafeedSymbolInfo | null = null;

	private _bars: DatafeedBar[] = [];
	private _lastBar: DatafeedBar | null = null;

	private _unsubscribeBars: (() => void) | null = null;
	private _visibleRangeHandler: ((range: LogicalRange | null) => void) | null = null;

	private _loading = false;
	private _disposed = false;

	private readonly _barsDelegate: Delegate<readonly DatafeedBar[], DatafeedBar | null> = new Delegate();

	public constructor(chart: IChartApi, datafeed: IDatafeedChartApi, options: DatafeedOptions) {
		this._chart = chart;
		this._datafeed = datafeed;
		this._options = options;
	}

	/** Whether a series has been bound to this controller. */
	public get boundSeries(): boolean {
		return this._series !== null;
	}

	/**
	 * Subscribe to bar-array changes. Fires on initial load, scroll-back
	 * prepend, and realtime update. The listener receives the full bar array
	 * (sorted ascending) and the last bar.
	 */
	public onBars(listener: DatafeedBarsListener): void {
		this._barsDelegate.subscribe(listener as any);
	}

	/** Unsubscribe a previously-attached {@link onBars} listener. */
	public offBars(listener: DatafeedBarsListener): void {
		this._barsDelegate.unsubscribe(listener as any);
	}

	/**
	 * Bind to a series and begin loading data. Only the first series passed is
	 * bound; subsequent calls are no-ops (see first-series rule in the plan).
	 */
	public bindSeries(series: ISeriesApi<any>): void {
		if (this._disposed || this._series !== null) return;

		this._series = series;

		this._visibleRangeHandler = (range: LogicalRange | null) => {
			this._onVisibleRangeChange(range);
		};
		this._chart.timeScale().subscribeVisibleLogicalRangeChange(this._visibleRangeHandler);

		// Kick off the initial load. Errors are logged but not fatal — the
		// chart simply remains empty, matching the behaviour of a normal
		// lightweight-charts series with no data set.
		this._initialLoad().catch((err) => {
			console.error('[DatafeedController] initial load failed:', err);
		});
	}

	/** Stop all subscriptions and release references. Safe to call once. */
	public destroy(): void {
		if (this._disposed) return;
		this._disposed = true;

		if (this._visibleRangeHandler) {
			this._chart.timeScale().unsubscribeVisibleLogicalRangeChange(this._visibleRangeHandler);
			this._visibleRangeHandler = null;
		}
		if (this._unsubscribeBars) {
			this._unsubscribeBars();
			this._unsubscribeBars = null;
		}

		this._series = null;
		this._symbolInfo = null;
		this._bars = [];
		this._lastBar = null;
		this._barsDelegate.unsubscribeAll(this);
	}

	// ── internal ────────────────────────────────────────────────────────

	private async _initialLoad(): Promise<void> {
		const symbolInfo = await this._resolve();
		if (this._disposed || !this._series) return;

		const count = this._options.initialCount ?? DEFAULT_INITIAL_COUNT;
		const now = Math.floor(Date.now() / 1000);
		const from = now - count * this._barIntervalSeconds();

		const bars = await this._datafeed.getBars(symbolInfo, this._options.resolution, {
			from,
			to: now,
			firstDataRequest: true,
			direction: 'forward',
			count,
		});

		if (this._disposed || !this._series) return;

		this._setBars(bars);
		this._series.setData(bars.map(toSeriesCandle) as any);

		// Begin realtime streaming from the last loaded bar.
		this._subscribeRealtime();
	}

	private _subscribeRealtime(): void {
		if (this._disposed || !this._series || !this._symbolInfo || this._unsubscribeBars) return;

		this._unsubscribeBars = this._datafeed.subscribeBars(
			this._symbolInfo,
			this._options.resolution,
			(bar) => this._onRealtimeBar(bar),
			this._lastBar ?? undefined,
		);
	}

	private _onRealtimeBar(bar: DatafeedBar): void {
		if (this._disposed || !this._series) return;

		const n = this._bars.length;
		if (n > 0 && bar.time <= this._bars[n - 1].time) {
			// Update the last bar (same period).
			this._bars[n - 1] = bar;
		} else {
			// New period — append.
			this._bars.push(bar);
			this._capBars();
		}
		this._lastBar = bar;
		this._emit();

		// `series.update` expects the same data shape `setData` received.
		this._series.update(toSeriesCandle(bar) as any);
	}

	private async _onVisibleRangeChange(range: LogicalRange | null): Promise<void> {
		if (this._disposed || !this._series || range === null || this._loading) return;

		const barsInfo = this._series.barsInLogicalRange(range);
		if (!barsInfo) return;

		const threshold = this._options.scrollBackThreshold ?? DEFAULT_SCROLLBACK_THRESHOLD;
		if (barsInfo.barsBefore >= threshold) return;

		// Need older bars. Compute the window ending at the earliest bar we have.
		const earliest = this._bars[0];
		if (!earliest) return;

		this._loading = true;
		try {
			const symbolInfo = await this._resolve();
			if (this._disposed || !this._series) return;

			const count = this._options.initialCount ?? DEFAULT_INITIAL_COUNT;
			const intervalSec = this._barIntervalSeconds();
			const to = Math.floor(earliest.time as unknown as number);

			const older = await this._datafeed.getBars(symbolInfo, this._options.resolution, {
				from: to - count * intervalSec,
				to,
				firstDataRequest: false,
				direction: 'backward',
				startPrice: earliest.open,
				count,
			});

			if (this._disposed || !this._series) return;

			if (older.length === 0) return; // end of history

			// Merge + dedup (older bars + existing), keep ascending, drop the
			// latest tail if we exceed maxBars (oldest is re-fetchable on scroll).
			const merged = mergeDedupAscending(older, this._bars);
			const maxBars = this._options.maxBars ?? DEFAULT_MAX_BARS;
			this._bars = merged.length > maxBars ? merged.slice(merged.length - maxBars) : merged;
			this._lastBar = this._bars[this._bars.length - 1] ?? null;
			this._emit();

			// Re-set the whole series; lightweight-charts preserves the visible
			// logical range when prepended times are strictly earlier.
			this._series.setData(this._bars.map(toSeriesCandle) as any);
		} catch (err) {
			console.error('[DatafeedController] scroll-back load failed:', err);
		} finally {
			this._loading = false;
		}
	}

	private async _resolve(): Promise<DatafeedSymbolInfo> {
		if (this._symbolInfo) return this._symbolInfo;
		const info = await this._datafeed.resolveSymbol(this._options.symbol);
		if (this._disposed) throw new Error('disposed');
		this._symbolInfo = info;
		return info;
	}

	private _setBars(bars: DatafeedBar[]): void {
		this._bars = bars.slice();
		this._lastBar = bars.length > 0 ? bars[bars.length - 1] : null;
		this._capBars();
		this._emit();
	}

	private _capBars(): void {
		const maxBars = this._options.maxBars ?? DEFAULT_MAX_BARS;
		if (this._bars.length > maxBars) {
			this._bars = this._bars.slice(this._bars.length - maxBars);
		}
	}

	private _emit(): void {
		this._barsDelegate.fire(this._bars, this._lastBar);
	}

	/**
	 * Approximate bar interval in seconds for the current resolution.
	 *
	 * Used only to compute a `from` window for fetches — the datafeed is free to
	 * return fewer/more bars; we dedup by time anyway. Falls back to 60s.
	 */
	private _barIntervalSeconds(): number {
		const r = this._options.resolution;
		if (r === '1S' || r === '1s') return 1;
		if (/^\d+[sS]$/.test(r)) return parseInt(r);
		if (/^\d+[mM]$/.test(r)) return parseInt(r) * 60;
		if (/^\d+[hH]$/.test(r)) return parseInt(r) * 3600;
		if (r === '1D' || r === '1d') return 86400;
		if (/^\d+$/.test(r)) return parseInt(r) * 60; // bare number → minutes
		if (r === '1W' || r === '1w') return 604800;
		if (r === '1M' || r === '1m') return 2592000;
		return 60;
	}
}

// ── helpers ────────────────────────────────────────────────────────────

/**
 * Map a {@link DatafeedBar} to the candlestick data shape used by
 * lightweight-charts (`time` is a `UTCTimestamp` in seconds).
 */
function toSeriesCandle(bar: DatafeedBar): { time: Time; open: number; high: number; low: number; close: number } {
	return {
		time: bar.time as unknown as Time,
		open: bar.open,
		high: bar.high,
		low: bar.low,
		close: bar.close,
	};
}

/**
 * Merge two ascending-by-time bar arrays, deduplicating by `time` (incoming
 * bars win on conflict). Result is sorted ascending.
 */
function mergeDedupAscending(a: DatafeedBar[], b: DatafeedBar[]): DatafeedBar[] {
	const map = new Map<number, DatafeedBar>();
	for (const bar of a) map.set(bar.time as unknown as number, bar);
	for (const bar of b) map.set(bar.time as unknown as number, bar);
	return Array.from(map.values()).sort(
		(x, y) => (x.time as unknown as number) - (y.time as unknown as number),
	);
}