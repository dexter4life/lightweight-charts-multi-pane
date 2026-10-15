import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { distanceToLineSegment } from '../../core/geometry';
import { DEFAULT_TREND_LINE_OPTIONS, type IntervalUnit, type TrendLineOptions } from '../lines/trend-line';
import { FlatTopBottomPaneView } from './flat-top-bottom-pane-view';

export interface FlatTopBottomOptions extends TrendLineOptions {
  /** Fill between the slanted and the flat line (the dialog's "Background"). */
  filled?: boolean;
  /** Draws the price of each line end next to it. */
  showPrices?: boolean;
}

export const DEFAULT_FLAT_TOP_BOTTOM_OPTIONS = {
  extendLeft: false,
  extendRight: false,
  filled: true,
  showPrices: false,
  textColor: '#FF9800',
  textSize: 12,
  textBold: false,
  textItalic: false,
};

/** Control point indices; the undo labels follow them ("change 2 point"). */
export const FT_START = 0;
export const FT_END = 1;
export const FT_FLAT_END = 2;
export const FT_FLAT_START = 3;

export interface FlatTopBottomPixels {
  start: Point;
  end: Point;
  flatStart: Point;
  flatEnd: Point;
}

/** The flat line's hit zone sits half a pixel below its drawn position. */
const FLAT_HIT_SHIFT_Y = 0.5;

/**
 * A slanted line between the first two anchors and a horizontal line at the price of the third, spanning the
 * same two times, with the area between them filled. The third anchor only carries a price (and the click time).
 */
export class FlatTopBottom extends Drawing {
  readonly type: string = 'flat-top-bottom';

  protected static readonly REQUIRED_ANCHORS = 3;
  protected static readonly HIT_THRESHOLD = 3.25;

  private _ftOptions: FlatTopBottomOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FlatTopBottomOptions> = {}
  ) {
    super(id, anchors, style, options);
    this._ftOptions = {
      ...DEFAULT_TREND_LINE_OPTIONS,
      ...DEFAULT_FLAT_TOP_BOTTOM_OPTIONS,
      ...this._options,
      ...options,
    };
  }

  get channelOptions(): FlatTopBottomOptions {
    return this._ftOptions;
  }

  get trendLineOptions(): FlatTopBottomOptions {
    return this._ftOptions;
  }

  setTrendLineOptions(options: Partial<FlatTopBottomOptions>): void {
    this._ftOptions = { ...this._ftOptions, ...options };
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  setChannelOptions(options: Partial<FlatTopBottomOptions>): void {
    this.setTrendLineOptions(options);
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  isVisibleAtInterval(): boolean {
    const map = this._ftOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override isDisplayed(): boolean {
    return this.isVisibleAtInterval();
  }

  isValid(): boolean {
    return this._anchors.length >= FlatTopBottom.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new FlatTopBottomPaneView(this)];
  }

  formatPrice(price: number): string {
    return this._series ? this._series.priceFormatter().format(price) : price.toFixed(2);
  }

  /** Prices at the four line ends, for the optional labels. */
  endPrices(): { start: number; end: number; flatStart: number; flatEnd: number } {
    const flat = this._anchors[2].price;
    return { start: this._anchors[0].price, end: this._anchors[1].price, flatStart: flat, flatEnd: flat };
  }

  /** Pixel ends of the slanted line and of the flat line below or above it (not extended). */
  pixels(viewport: Viewport): FlatTopBottomPixels | null {
    if (!this.isValid()) return null;
    const p0 = this.anchorToPixel(this._anchors[0], viewport);
    const p1 = this.anchorToPixel(this._anchors[1], viewport);
    const flatY = viewport.priceScale.priceToCoordinate(this._anchors[2].price);
    if (!p0 || !p1 || flatY === null) return null;
    return { start: p0, end: p1, flatStart: { x: p0.x, y: flatY }, flatEnd: { x: p1.x, y: flatY } };
  }

  /** A line carried to the pane edge beyond its first point (extend left) and/or its second point (extend right). */
  private extended(a: Point, b: Point, viewport: Viewport): [Point, Point] {
    const { extendLeft, extendRight } = this._ftOptions;
    const dx = b.x - a.x;
    if ((!extendLeft && !extendRight) || dx === 0) return [a, b];
    const slope = (b.y - a.y) / dx;
    const at = (x: number): Point => ({ x, y: a.y + slope * (x - a.x) });
    const forward = dx > 0;
    return [extendLeft ? at(forward ? 0 : viewport.width) : a, extendRight ? at(forward ? viewport.width : 0) : b];
  }

  lines(viewport: Viewport): { slanted: [Point, Point]; flat: [Point, Point] } | null {
    const px = this.pixels(viewport);
    if (!px) return null;
    return {
      slanted: this.extended(px.start, px.end, viewport),
      flat: this.extended(px.flatStart, px.flatEnd, viewport),
    };
  }

  /** Whether the handle at this control-point index is drawn as a square rather than a circle. */
  isSquareHandle(_index: number): boolean {
    return false;
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const px = this.pixels(viewport);
    if (!px) return [];
    const all: ControlPoint[] = [
      { index: FT_START, x: px.start.x, y: px.start.y, radius: 6 },
      { index: FT_END, x: px.end.x, y: px.end.y, radius: 6 },
      { index: FT_FLAT_END, x: px.flatEnd.x, y: px.flatEnd.y, radius: 6 },
      { index: FT_FLAT_START, x: px.flatStart.x, y: px.flatStart.y, radius: 6 },
    ];
    const placed = this._placedCount;
    return placed === null || placed >= 2 ? all : placed >= 1 ? all.slice(0, 1) : [];
  }

  override dragControlPoint(index: number, _point: Point, anchor: Anchor | null, _viewport: Viewport): void {
    if (!anchor) return;
    const withTime = (a: Anchor): Anchor => ({ ...a, time: anchor.time, logical: anchor.logical });
    if (index === FT_START || index === FT_END) {
      this.updateAnchor(index, anchor);
      return;
    }
    if (index === FT_FLAT_END) {
      this._anchors[1] = withTime(this._anchors[1]);
      this._anchors[2] = { ...withTime(this._anchors[2]), price: anchor.price };
    } else if (index === FT_FLAT_START) {
      this._anchors[0] = withTime(this._anchors[0]);
      this._anchors[2] = { ...this._anchors[2], price: anchor.price };
    }
    this.requestUpdate();
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const l = this.lines(viewport);
    if (!l) return [];
    const seg = (s: [Point, Point]): LineGeometry => ({ type: 'line', start: s[0], end: s[1] });
    return [seg(l.slanted), seg(l.flat)];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed() || this._placedCount !== null) return false;
    const l = this.lines(viewport);
    if (!l) return false;
    const limit = (this.constructor as typeof FlatTopBottom).HIT_THRESHOLD;
    const flatPoint = { x: point.x, y: point.y - FLAT_HIT_SHIFT_Y };
    return (
      distanceToLineSegment(point, l.slanted[0], l.slanted[1]) <= limit ||
      distanceToLineSegment(flatPoint, l.flat[0], l.flat[1]) <= limit
    );
  }

  clone(newId: string): IDrawing {
    return new FlatTopBottom(newId, [...this._anchors], { ...this._style }, { ...this._ftOptions });
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._ftOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._ftOptions = { ...this._ftOptions, ...data.options };
  }

  static create(
    id: string,
    start: Anchor,
    end: Anchor,
    flatLevel: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FlatTopBottomOptions>
  ): FlatTopBottom {
    return new FlatTopBottom(id, [start, end, flatLevel], style, options);
  }
}
