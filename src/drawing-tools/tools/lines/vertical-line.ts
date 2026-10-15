import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { PriceTag } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, IDrawing } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { VerticalLinePaneView } from './vertical-line-pane-view';
import { DEFAULT_TREND_LINE_OPTIONS, type IntervalUnit, type TrendLineOptions } from './trend-line';

export type TextOrientation = 'vertical' | 'horizontal';

export interface VerticalLineOptions extends TrendLineOptions {
  /** Time tag on the time axis. */
  timeLabels?: boolean;
  /** Carries the line through every pane; nothing changes on a single-pane chart. */
  extendLine?: boolean;
  textOrientation?: TextOrientation;
}

/** A line at one bar, spanning the pane's full height. The grab handle sits at the pane's vertical centre. */
export class VerticalLine extends Drawing {
  readonly type: string = 'vertical-line';

  // Hit zone is centred half a pixel past the drawn line, as in the reference.
  protected static readonly HIT_THRESHOLD = 3.5 + 1e-6;
  protected static readonly HIT_SHIFT = 0.5;

  private _lineOptions: VerticalLineOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<VerticalLineOptions> = {}
  ) {
    super(id, anchors, style, options);
    this._lineOptions = {
      ...DEFAULT_TREND_LINE_OPTIONS,
      timeLabels: true,
      extendLine: true,
      textOrientation: 'vertical',
      textVAlign: 'bottom',
      textHAlign: 'right',
      textSize: 14,
      ...this._options,
      ...options,
    };
  }

  get trendLineOptions(): VerticalLineOptions {
    return this._lineOptions;
  }

  setTrendLineOptions(options: Partial<VerticalLineOptions>): void {
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

  // The time tag on the axis replaces the selection band and price tag.
  override showsIdleTimeLabels(): boolean {
    return !!this._lineOptions.timeLabels;
  }

  override showsPriceBand(): boolean {
    return false;
  }

  override showsTimeBand(): boolean {
    return false;
  }

  override customPriceTags(): PriceTag[] | null {
    return [];
  }

  isValid(): boolean {
    return this._anchors.length >= 1;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new VerticalLinePaneView(this)];
  }

  linePixelX(viewport: Viewport): number | null {
    if (!this.isValid()) return null;
    return viewport.timeScale.timeToCoordinate(this._anchors[0].time);
  }

  handlePixel(viewport: Viewport): Point | null {
    const x = this.linePixelX(viewport);
    return x === null ? null : { x, y: viewport.height / 2 };
  }

  override getControlPoints(viewport: Viewport) {
    const h = this.handlePixel(viewport);
    if (!h || (this.placedCount ?? 1) < 1) return [];
    return [{ index: 0, x: h.x, y: h.y, radius: 6 }];
  }

  // Dragging carries the stored price along, even though only the bar is drawn.
  override dragControlPoint(index: number, _point: Point, anchor: Anchor | null): void {
    if (anchor && this._anchors[index]) this.updateAnchor(index, anchor);
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const x = this.linePixelX(viewport);
    if (x === null) return [];
    const line: LineGeometry = { type: 'line', start: { x, y: 0 }, end: { x, y: viewport.height } };
    return [line];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    const x = this.linePixelX(viewport);
    return x !== null && Math.abs(point.x - x - VerticalLine.HIT_SHIFT) <= VerticalLine.HIT_THRESHOLD;
  }

  clone(newId: string): IDrawing {
    return new VerticalLine(newId, [...this._anchors], { ...this._style }, { ...this._lineOptions });
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
    time: number | string,
    price: number,
    style?: Partial<DrawingStyle>,
    options?: Partial<VerticalLineOptions>
  ): VerticalLine {
    return new VerticalLine(id, [{ time: time as any, price }], style, options);
  }
}
