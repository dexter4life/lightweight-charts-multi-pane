import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { PriceTag } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, IDrawing } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { CrossLinePaneView } from './cross-line-pane-view';
import { DEFAULT_TREND_LINE_OPTIONS, type IntervalUnit, type TrendLineOptions } from './trend-line';

export interface CrossLineOptions extends TrendLineOptions {
  /** Time tag on the time axis (the price tag is `priceLabels`). */
  timeLabels?: boolean;
}

/** A horizontal and a vertical line crossing at one point; the grab handle sits at the crossing. */
export class CrossLine extends Drawing {
  readonly type: string = 'cross-line';

  // Hit zones are centred half a pixel past the drawn line, as in the reference.
  protected static readonly HIT_H = 3.5 + 1e-6;
  protected static readonly HIT_V = 3.5 + 1e-6;
  protected static readonly HIT_SHIFT = 0.5;

  private _lineOptions: CrossLineOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<CrossLineOptions> = {}
  ) {
    super(id, anchors, style, options);
    this._lineOptions = {
      ...DEFAULT_TREND_LINE_OPTIONS,
      priceLabels: true,
      timeLabels: true,
      ...this._options,
      ...options,
    };
  }

  get trendLineOptions(): CrossLineOptions {
    return this._lineOptions;
  }

  get crossLineOptions(): CrossLineOptions {
    return this._lineOptions;
  }

  setTrendLineOptions(options: Partial<CrossLineOptions>): void {
    this._lineOptions = { ...this._lineOptions, ...options };
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  isVisibleAtInterval(): boolean {
    const map = this._lineOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override isDisplayed(): boolean {
    return this.isVisibleAtInterval();
  }

  override showsIdlePriceLabels(): boolean {
    return !!this._lineOptions.priceLabels && this.isVisibleAtInterval();
  }

  override showsIdleTimeLabels(): boolean {
    return !!this._lineOptions.timeLabels;
  }

  override showsAxisTags(): boolean {
    return false;
  }

  override showsPriceBand(): boolean {
    return false;
  }

  override showsTimeBand(): boolean {
    return false;
  }

  override customPriceTags(): PriceTag[] | null {
    const a = this._anchors[0];
    return a ? [{ price: a.price, backColor: this._style.lineColor }] : null;
  }

  isValid(): boolean {
    return this._anchors.length >= 1;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new CrossLinePaneView(this)];
  }

  /** The crossing in pane pixels. */
  crossPixel(viewport: Viewport): Point | null {
    if (!this.isValid()) return null;
    const a = this._anchors[0];
    const x = viewport.timeScale.timeToCoordinate(a.time);
    const y = viewport.priceScale.priceToCoordinate(a.price);
    return x === null || y === null ? null : { x, y };
  }

  override getControlPoints(viewport: Viewport) {
    const p = this.crossPixel(viewport);
    if (!p || (this.placedCount ?? 1) < 1) return [];
    return [{ index: 0, x: p.x, y: p.y, radius: 6 }];
  }

  override dragControlPoint(index: number, _point: Point, anchor: Anchor | null): void {
    if (anchor && this._anchors[index]) this.updateAnchor(index, anchor);
  }

  override bodyDragAnchors(origin: Point[], dx: number, dy: number, viewport: Viewport): Anchor[] | null {
    const time = viewport.timeScale.coordinateToTime(origin[0].x + dx);
    const price = viewport.priceScale.coordinateToPrice(origin[0].y + dy);
    return time === null || price === null ? null : [{ time: time as Anchor['time'], price }];
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const p = this.crossPixel(viewport);
    if (!p) return [];
    const h: LineGeometry = { type: 'line', start: { x: 0, y: p.y }, end: { x: viewport.width, y: p.y } };
    const v: LineGeometry = { type: 'line', start: { x: p.x, y: 0 }, end: { x: p.x, y: viewport.height } };
    return [h, v];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    const p = this.crossPixel(viewport);
    if (!p) return false;
    const cls = this.constructor as typeof CrossLine;
    return Math.abs(point.y - p.y - cls.HIT_SHIFT) <= cls.HIT_H || Math.abs(point.x - p.x - cls.HIT_SHIFT) <= cls.HIT_V;
  }

  clone(newId: string): IDrawing {
    return new CrossLine(newId, [...this._anchors], { ...this._style }, { ...this._lineOptions });
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._lineOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._lineOptions = { ...this._lineOptions, ...data.options };
  }

  static create(
    id: string,
    price: number,
    time: number | string,
    style?: Partial<DrawingStyle>,
    options?: Partial<CrossLineOptions>
  ): CrossLine {
    return new CrossLine(id, [{ time: time as any, price }], style, options);
  }
}
