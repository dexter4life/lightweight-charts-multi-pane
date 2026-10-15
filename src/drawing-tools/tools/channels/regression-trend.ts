import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing, type PriceTag } from '../../core/drawing';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { distanceToLineSegment } from '../../core/geometry';
import { DEFAULT_TREND_LINE_OPTIONS, type IntervalUnit, type TrendLineOptions } from '../lines/trend-line';
import { findNearestBarIndex, resolveSeriesBars, type ResolvedSeriesBar, type SeriesDatumLike } from '../forecasting/data-utils';
import { RegressionTrendPaneView } from './regression-trend-pane-view';

export type RegressionSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';

export const REGRESSION_SOURCES: RegressionSource[] = ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4'];

export interface RegressionTrendOptions extends TrendLineOptions {
  upperDeviation?: number;
  lowerDeviation?: number;
  useUpper?: boolean;
  useLower?: boolean;
  source?: RegressionSource;
  showBase?: boolean;
  showUp?: boolean;
  showDown?: boolean;
  baseColor?: string;
  upColor?: string;
  downColor?: string;
  baseWidth?: number;
  upWidth?: number;
  downWidth?: number;
  baseDash?: number[];
  upDash?: number[];
  downDash?: number[];
  extendLines?: boolean;
  showPearsons?: boolean;
  /** Percent of transparency of the two fills. */
  transparency?: number;
}

export const DEFAULT_REGRESSION_TREND_OPTIONS = {
  upperDeviation: 2,
  lowerDeviation: -2,
  useUpper: true,
  useLower: true,
  source: 'close' as RegressionSource,
  showBase: true,
  showUp: true,
  showDown: true,
  baseColor: 'rgba(242, 54, 69, 0.3)',
  upColor: 'rgba(41, 98, 255, 0.3)',
  downColor: 'rgba(41, 98, 255, 0.3)',
  baseWidth: 1,
  upWidth: 2,
  downWidth: 2,
  baseDash: [6, 6],
  upDash: [] as number[],
  downDash: [] as number[],
  extendLines: false,
  showPearsons: true,
  transparency: 70,
};

export const RT_BASE_START = 0;
export const RT_BASE_END = 1;

export interface RegressionFit {
  /** Fitted value at the first and last anchor. */
  start: number;
  end: number;
  upper: number;
  lower: number;
  r: number;
}

export interface RegressionPixels {
  base: [Point, Point];
  upper: [Point, Point];
  lower: [Point, Point];
}

const barValue = (bar: ResolvedSeriesBar, source: RegressionSource): number => {
  switch (source) {
    case 'open': return bar.open;
    case 'high': return bar.high;
    case 'low': return bar.low;
    case 'hl2': return (bar.high + bar.low) / 2;
    case 'hlc3': return (bar.high + bar.low + bar.close) / 3;
    case 'ohlc4': return (bar.open + bar.high + bar.low + bar.close) / 4;
    default: return bar.close;
  }
};

/**
 * Linear regression of a price source over the bars between two points, with bands at a number of standard
 * deviations of the residuals. Both anchors sit on bars; their prices are always the fitted values.
 */
export class RegressionTrend extends Drawing {
  readonly type: string = 'regression-trend';

  protected static readonly REQUIRED_ANCHORS = 2;
  protected static readonly HIT_THRESHOLD = 3.25;
  // The reference's hit zone sits one pixel above the drawn line.
  protected static readonly HIT_SHIFT_Y = 1;

  private _rtOptions: RegressionTrendOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;
  private _cache: { key: string; fit: RegressionFit | null } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<RegressionTrendOptions> = {}
  ) {
    super(id, anchors, style, options);
    this._rtOptions = { ...DEFAULT_TREND_LINE_OPTIONS, ...DEFAULT_REGRESSION_TREND_OPTIONS, ...this._options, ...options };
  }

  get regressionOptions(): RegressionTrendOptions {
    return this._rtOptions;
  }

  get trendLineOptions(): RegressionTrendOptions {
    return this._rtOptions;
  }

  setTrendLineOptions(options: Partial<RegressionTrendOptions>): void {
    this._rtOptions = { ...this._rtOptions, ...options };
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  /** The floating toolbar's width button sets all three lines at once. */
  applyUniformStyle(p: { color?: string; width?: number }): void {
    if (p.width === undefined) return;
    this.updateStyle({ lineWidth: p.width });
    this.setTrendLineOptions({ upWidth: p.width, downWidth: p.width, baseWidth: p.width });
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  isVisibleAtInterval(): boolean {
    const map = this._rtOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override isDisplayed(): boolean {
    return this.isVisibleAtInterval();
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new RegressionTrendPaneView(this)];
  }

  override attach(series: Parameters<Drawing['attach']>[0], chart: Parameters<Drawing['attach']>[1], container?: HTMLElement): void {
    super.attach(series, chart, container);
    this._anchors = this._anchors.map((a) => this.snapped(a));
    this.syncPrices();
  }

  private bars(): ResolvedSeriesBar[] {
    return this._series ? resolveSeriesBars(this._series.data() as unknown as readonly SeriesDatumLike[]) : [];
  }

  /** Moves an anchor onto the nearest bar. */
  private snapped(anchor: Anchor): Anchor {
    const bars = this.bars();
    const i = findNearestBarIndex(bars, anchor.time);
    return i < 0 ? anchor : { time: bars[i].time, price: anchor.price };
  }

  override updateAnchor(index: number, anchor: Anchor): void {
    super.updateAnchor(index, this.snapped(anchor));
    this.syncPrices();
  }

  override setAnchors(anchors: Anchor[]): void {
    super.setAnchors(anchors.map((a) => this.snapped(a)));
    this.syncPrices();
  }

  private syncPrices(): void {
    const fit = this.fit();
    if (!fit || this._anchors.length < 2) return;
    this._anchors[0] = { ...this._anchors[0], price: fit.start };
    this._anchors[1] = { ...this._anchors[1], price: fit.end };
  }

  /** The regression for the current anchors, or null without data. */
  fit(): RegressionFit | null {
    if (!this._series || this._anchors.length < 2) return null;
    const o = this._rtOptions;
    const data = this._series.data();
    const last = data[data.length - 1] as unknown as { time?: unknown; close?: number; value?: number } | undefined;
    const key = [
      String(this._anchors[0].time),
      String(this._anchors[1].time),
      data.length,
      last?.close ?? last?.value,
      o.source,
      o.upperDeviation,
      o.lowerDeviation,
      o.useUpper,
      o.useLower,
    ].join('|');
    if (this._cache?.key === key) return this._cache.fit;

    const bars = this.bars();
    const a = findNearestBarIndex(bars, this._anchors[0].time);
    const b = findNearestBarIndex(bars, this._anchors[1].time);
    let fit: RegressionFit | null = null;
    if (a >= 0 && b >= 0) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const n = hi - lo + 1;
      const source = o.source ?? 'close';
      const ys: number[] = [];
      for (let i = lo; i <= hi; i += 1) ys.push(barValue(bars[i], source));
      const mx = (n - 1) / 2;
      const my = ys.reduce((s, v) => s + v, 0) / n;
      let sxy = 0;
      let sxx = 0;
      let syy = 0;
      for (let i = 0; i < n; i += 1) {
        sxy += (i - mx) * (ys[i] - my);
        sxx += (i - mx) ** 2;
        syy += (ys[i] - my) ** 2;
      }
      const slope = sxx === 0 ? 0 : sxy / sxx;
      const at = (i: number) => my + slope * (i - mx);
      const residuals = ys.map((v, i) => v - at(i));
      const mean = residuals.reduce((s, v) => s + v, 0) / n;
      const sigma = n > 1 ? Math.sqrt(residuals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
      let upper = (o.upperDeviation ?? 2) * sigma;
      let lower = (o.lowerDeviation ?? -2) * sigma;
      // Without a deviation the band wraps every high and low of the range.
      if (!o.useUpper) upper = Math.max(...Array.from({ length: n }, (_, i) => bars[lo + i].high - at(i)));
      if (!o.useLower) lower = Math.min(...Array.from({ length: n }, (_, i) => bars[lo + i].low - at(i)));
      const idx = (anchorIndex: number) => (anchorIndex - lo);
      fit = {
        start: at(idx(a)),
        end: at(idx(b)),
        upper,
        lower,
        r: sxx === 0 || syy === 0 ? 0 : Math.abs(sxy / Math.sqrt(sxx * syy)),
      };
    }
    this._cache = { key, fit };
    return fit;
  }

  /** Pixel ends of the base, upper and lower lines (without the right extension). */
  pixels(viewport: Viewport): RegressionPixels | null {
    const fit = this.fit();
    if (!fit || !this.isValid()) return null;
    const x1 = viewport.timeScale.timeToCoordinate(this._anchors[0].time);
    const x2 = viewport.timeScale.timeToCoordinate(this._anchors[1].time);
    if (x1 === null || x2 === null) return null;
    const y = (price: number) => viewport.priceScale.priceToCoordinate(price);
    const b1 = y(fit.start);
    const b2 = y(fit.end);
    const u1 = y(fit.start + fit.upper);
    const u2 = y(fit.end + fit.upper);
    const l1 = y(fit.start + fit.lower);
    const l2 = y(fit.end + fit.lower);
    if ([b1, b2, u1, u2, l1, l2].some((v) => v === null)) return null;
    return {
      base: [{ x: x1, y: b1! }, { x: x2, y: b2! }],
      upper: [{ x: x1, y: u1! }, { x: x2, y: u2! }],
      lower: [{ x: x1, y: l1! }, { x: x2, y: l2! }],
    };
  }

  /** The line extended to the right edge of the pane when "Extend lines" is on. */
  extendRight(seg: [Point, Point], viewport: Viewport): [Point, Point] {
    if (!this._rtOptions.extendLines) return seg;
    const [a, b] = seg[0].x <= seg[1].x ? seg : [seg[1], seg[0]];
    const dx = b.x - a.x;
    if (dx === 0) return seg;
    const end = { x: viewport.width, y: a.y + ((b.y - a.y) * (viewport.width - a.x)) / dx };
    return [a, end];
  }

  /** Both anchors once the regression exists; while placing, only what is already known. */
  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const px = this.pixels(viewport);
    if (!px) return [];
    const points: ControlPoint[] = [
      { index: RT_BASE_START, x: px.base[0].x, y: px.base[0].y, radius: 6 },
      { index: RT_BASE_END, x: px.base[1].x, y: px.base[1].y, radius: 6 },
    ];
    const placed = this._placedCount;
    return placed === null ? points : placed >= 2 ? points : placed >= 1 ? points.slice(0, 1) : [];
  }

  /** Only the time of a dragged handle is used; the price follows from the regression. */
  override dragControlPoint(index: number, point: Point, _anchor: Anchor | null, viewport: Viewport): void {
    const time = viewport.timeScale.coordinateToTime(point.x);
    if (time === null || index < 0 || index > 1) return;
    this.updateAnchor(index, { time, price: this._anchors[index].price });
  }

  /** The regression can only be changed through its two handles. */
  override bodyDragOrigin(): Point[] | null {
    return null;
  }

  private tagPrices(): number[] | null {
    if (this._placedCount !== null) return null;
    const fit = this.fit();
    return fit ? [fit.start, fit.end] : null;
  }

  override customPriceTags(): PriceTag[] | null {
    return this.tagPrices()?.map((price) => ({ price, backColor: '#2962FF' })) ?? null;
  }

  override extentPrices(): number[] | null {
    return this.tagPrices();
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const px = this.pixels(viewport);
    if (!px) return [];
    const seg = (s: [Point, Point]): LineGeometry => ({ type: 'line', start: s[0], end: s[1] });
    return [seg(px.upper), seg(px.base), seg(px.lower)];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed() || this._placedCount !== null) return false;
    const px = this.pixels(viewport);
    if (!px) return false;
    const o = this._rtOptions;
    const cls = this.constructor as typeof RegressionTrend;
    const limit = cls.HIT_THRESHOLD;
    const p = { x: point.x, y: point.y + cls.HIT_SHIFT_Y };
    const segs: Array<[Point, Point]> = [];
    if (o.showUp) segs.push(this.extendRight(px.upper, viewport));
    if (o.showBase) segs.push(this.extendRight(px.base, viewport));
    if (o.showDown) segs.push(this.extendRight(px.lower, viewport));
    return segs.some((s) => distanceToLineSegment(p, s[0], s[1]) <= limit);
  }

  clone(newId: string): IDrawing {
    return new RegressionTrend(newId, [...this._anchors], { ...this._style }, { ...this._rtOptions });
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._rtOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._rtOptions = { ...this._rtOptions, ...data.options };
  }

  static create(
    id: string,
    start: Anchor,
    end: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<RegressionTrendOptions>
  ): RegressionTrend {
    return new RegressionTrend(id, [start, end], style, options);
  }
}
