import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { PriceTag } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, IDrawing } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { HorizontalLinePaneView } from './horizontal-line-pane-view';
import { DEFAULT_TREND_LINE_OPTIONS, type IntervalUnit, type TrendLineOptions } from './trend-line';

/** Horizontal Line shares the Trend Line option set (price label, text, interval visibility). */
export type HorizontalLineOptions = TrendLineOptions;

/** A level across the whole pane at one price. The grab handle sits at the pane's horizontal centre. */
export class HorizontalLine extends Drawing {
  readonly type: string = 'horizontal-line';

  protected static readonly HIT_THRESHOLD: number = 4;

  private _lineOptions: TrendLineOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TrendLineOptions> = {}
  ) {
    super(id, anchors, style, options);
    this._lineOptions = {
      ...DEFAULT_TREND_LINE_OPTIONS,
      priceLabels: true,
      textVAlign: 'bottom',
      textSize: 12,
      ...this._options,
      ...options,
    };
  }

  get trendLineOptions(): TrendLineOptions {
    return this._lineOptions;
  }

  setTrendLineOptions(options: Partial<TrendLineOptions>): void {
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

  // The price tag on the axis replaces the selection band and time tag.
  override showsIdlePriceLabels(): boolean {
    return !!this._lineOptions.priceLabels && this.isVisibleAtInterval();
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
    return [new HorizontalLinePaneView(this)];
  }

  linePixelY(viewport: Viewport): number | null {
    if (!this.isValid()) return null;
    return viewport.priceScale.priceToCoordinate(this._anchors[0].price);
  }

  /** Horizontal extent of the drawn line in pane pixels. */
  lineSpan(viewport: Viewport): { x0: number; x1: number } | null {
    return { x0: 0, x1: viewport.width };
  }

  handleKind(): 'square' | 'circle' {
    return 'square';
  }

  handlePixel(viewport: Viewport): Point | null {
    const y = this.linePixelY(viewport);
    return y === null ? null : { x: viewport.width / 2, y };
  }

  override getControlPoints(viewport: Viewport) {
    const h = this.handlePixel(viewport);
    if (!h || (this.placedCount ?? 1) < 1) return [];
    return [{ index: 0, x: h.x, y: h.y, radius: 6 }];
  }

  // The level only moves vertically.
  override dragControlPoint(index: number, _point: Point, anchor: Anchor | null): void {
    if (anchor && this._anchors[index]) this.updateAnchor(index, { time: this._anchors[index].time, price: anchor.price });
  }

  override bodyDragAnchors(origin: Point[], _dx: number, dy: number, viewport: Viewport): Anchor[] | null {
    const price = viewport.priceScale.coordinateToPrice(origin[0].y + dy);
    return price === null ? null : [{ time: this._anchors[0].time, price }];
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const y = this.linePixelY(viewport);
    const span = this.lineSpan(viewport);
    if (y === null || !span) return [];
    const line: LineGeometry = { type: 'line', start: { x: span.x0, y }, end: { x: span.x1, y } };
    return [line];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    const y = this.linePixelY(viewport);
    const span = this.lineSpan(viewport);
    if (y === null || !span) return false;
    return Math.abs(point.y - y) <= (this.constructor as typeof HorizontalLine).HIT_THRESHOLD && point.x >= span.x0 && point.x <= span.x1;
  }

  clone(newId: string): IDrawing {
    return new HorizontalLine(newId, [...this._anchors], { ...this._style }, { ...this._lineOptions });
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
    options?: Partial<TrendLineOptions>
  ): HorizontalLine {
    return new HorizontalLine(id, [{ time: time as any, price }], style, options);
  }
}
