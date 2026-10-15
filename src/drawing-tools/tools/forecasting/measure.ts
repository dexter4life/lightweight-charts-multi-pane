import type { IPrimitivePaneView } from '../../../model/ipane-primitive';
import type { Time } from '../../../model/horz-scale-behavior-time/types';
import type { ISeriesApi } from '../../../api/iseries-api';
import type { SeriesType } from '../../../model/series-options';

import { Drawing } from '../../core/drawing';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { findNearestBarIndex, resolveSeriesBars, timeToKey } from './data-utils';
import type { SeriesDatumLike } from './data-utils';
import { MeasurePaneView } from './measure-pane-view';

export interface MeasureInfo {
  priceChange: number;
  percent: number;
  ticks: number;
  bars: number;
  /** Elapsed time between the two points, e.g. "33d" or "1d 4h". */
  duration: string;
  /** Summed volume of the measured bars, or null when the series carries none. */
  volume: number | null;
  up: boolean;
}

const MINUS = '\u2212';

function formatDuration(seconds: number): string {
  const total = Math.round(Math.abs(seconds) / 60);
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean);
  return parts.length ? parts.join(' ') : '0m';
}

/** Compact volume like TradingView's legend: 863.1, 2.701K, 19.423M. */
export function formatVolume(value: number): string {
  const units: Array<[number, string]> = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, suffix] of units) {
    if (value >= size) return `${+(value / size).toFixed(3)}${suffix}`;
  }
  return String(+value.toFixed(3));
}

/**
 * Measure - the transient ruler of TradingView's left toolbar.
 *
 * Two clicks span a box that reports the price change, percentage, ticks, bar count, elapsed time and volume.
 * It is not a persistent drawing: the host removes it on the next click and keeps it out of history.
 */
export class Measure extends Drawing {
  readonly type = 'measure';

  private _volumeSeries: ISeriesApi<SeriesType> | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<DrawingOptions> = {}) {
    super(id, anchors, style, options);
  }

  /** Both points are shown on the axes from the very first click, while the second one follows the mouse. */
  override get placedCount(): number | null {
    return null;
  }

  override set placedCount(_value: number | null) {
    /* always null */
  }

  /** A separate volume (histogram) series to sum, for charts that keep volume out of the price series. */
  setVolumeSeries(series: ISeriesApi<SeriesType> | null): void {
    this._volumeSeries = series;
    this.requestUpdate();
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new MeasurePaneView(this)];
  }

  override autoscaleInfo(): null {
    return null;
  }

  computeGeometry(): never[] {
    return [];
  }

  override axisBandColor(): string {
    return 'rgba(41, 98, 255, 0.255)';
  }

  /** The ruler is never picked, selected or dragged. */
  testHit(_point: Point, _viewport: Viewport): boolean {
    return false;
  }

  formatPrice(value: number): string {
    return this._series ? this._series.priceFormatter().format(value) : value.toFixed(2);
  }

  getInfo(): MeasureInfo | null {
    if (!this.isValid() || !this._series) return null;
    const [a, b] = this._anchors;
    const priceChange = b.price - a.price;
    const percent = a.price !== 0 ? (priceChange / a.price) * 100 : 0;
    const minMove = (this._series.options() as { priceFormat?: { minMove?: number } }).priceFormat?.minMove;
    const tick = minMove && minMove > 0 ? minMove : 0.01;

    const bars = resolveSeriesBars(this._series.data() as unknown as readonly SeriesDatumLike[]);
    const i1 = findNearestBarIndex(bars, a.time);
    const i2 = findNearestBarIndex(bars, b.time);
    let volume: number | null = null;
    if (i1 >= 0 && i2 >= 0) {
      const lo = Math.min(i1, i2);
      const hi = Math.max(i1, i2);
      if (bars.some((bar) => bar.hasExplicitVolume)) {
        volume = 0;
        for (let i = lo; i <= hi; i += 1) volume += bars[i].volume;
      } else if (this._volumeSeries) {
        const from = timeToKey(bars[lo].time);
        const to = timeToKey(bars[hi].time);
        volume = 0;
        for (const item of this._volumeSeries.data() as ReadonlyArray<{ time: Time; value?: number }>) {
          const key = timeToKey(item.time);
          if (key >= from && key <= to) volume += item.value ?? 0;
        }
      }
    }

    return {
      priceChange,
      percent,
      ticks: Math.round(priceChange / tick),
      bars: Math.abs(i2 - i1),
      duration: formatDuration(timeToKey(b.time) - timeToKey(a.time)),
      volume,
      up: priceChange >= 0,
    };
  }

  /** Text lines of the summary label. */
  getLabelLines(): string[] {
    const info = this.getInfo();
    if (!info) return [];
    const sign = (n: number) => (n < 0 ? MINUS : '');
    const lines = [
      `${sign(info.priceChange)}${this.formatPrice(Math.abs(info.priceChange))} (${sign(info.percent)}${Math.abs(info.percent).toFixed(2)}%) , ${sign(info.ticks)}${Math.abs(info.ticks)}`,
      `${info.bars} bars, ${info.duration}`,
    ];
    if (info.volume !== null) lines.push(`Vol ${formatVolume(info.volume)}`);
    return lines;
  }

  clone(newId: string): IDrawing {
    return new Measure(newId, [...this._anchors], { ...this._style }, { ...this._options });
  }
}
