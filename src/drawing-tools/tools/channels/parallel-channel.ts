import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing, type PriceTag } from '../../core/drawing';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { distanceToLineSegment, extendLineToViewport } from '../../core/geometry';
import { DEFAULT_TREND_LINE_OPTIONS, type IntervalUnit, type TrendLineOptions } from '../lines/trend-line';
import { ParallelChannelPaneView } from './parallel-channel-pane-view';

export interface ParallelChannelOptions extends TrendLineOptions {
  /** Fill between the two lines (the dialog's "Background"). */
  filled?: boolean;
  showMiddleLine?: boolean;
  middleColor?: string;
  middleWidth?: number;
  middleDash?: number[];
}

export const DEFAULT_PARALLEL_CHANNEL_OPTIONS = {
  extendLeft: false,
  extendRight: false,
  filled: true,
  showMiddleLine: true,
  middleColor: '#2962FF',
  middleWidth: 1,
  middleDash: [6, 6],
};

/** Control point indices; the labels of the undo steps follow them ("change 5 point"). */
export const PC_TOP_LEFT = 0;
export const PC_TOP_RIGHT = 1;
export const PC_BOTTOM_LEFT = 2;
export const PC_BOTTOM_RIGHT = 3;
export const PC_BOTTOM_MID = 4;
export const PC_TOP_MID = 5;

export interface ParallelChannelPixels {
  top: [Point, Point];
  bottom: [Point, Point];
}

/**
 * Two parallel lines. The first two anchors are the top line; the third only carries the price offset
 * of the second line (its time is the first anchor's), so moving the top line keeps the channel width.
 */
export class ParallelChannel extends Drawing {
  readonly type: string = 'parallel-channel';

  protected static readonly HIT_THRESHOLD = 3.25;
  // The reference's hit zone sits one pixel above the drawn line.
  protected static readonly HIT_SHIFT_Y = 1;

  private _channelOptions: ParallelChannelOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;
  /** True while the third anchor is still the raw pointer position of the placement click. */
  private _raw = true;
  private _grab: { index: number; origin: Point[]; handle: Point; pointer: Point } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<ParallelChannelOptions> = {}
  ) {
    super(id, anchors, style, options);
    this._channelOptions = {
      ...DEFAULT_TREND_LINE_OPTIONS,
      ...DEFAULT_PARALLEL_CHANNEL_OPTIONS,
      ...this._options,
      ...options,
    };
  }

  get channelOptions(): ParallelChannelOptions {
    return this._channelOptions;
  }

  get trendLineOptions(): ParallelChannelOptions {
    return this._channelOptions;
  }

  setTrendLineOptions(options: Partial<ParallelChannelOptions>): void {
    this._channelOptions = { ...this._channelOptions, ...options };
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  setChannelOptions(options: Partial<ParallelChannelOptions>): void {
    this.setTrendLineOptions(options);
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  isVisibleAtInterval(): boolean {
    const map = this._channelOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override isDisplayed(): boolean {
    return this.isVisibleAtInterval();
  }

  /** The four corner prices (top-left, top-right, bottom-left, bottom-right) once the channel is committed. */
  private cornerPrices(): number[] | null {
    if (this._raw || this._placedCount !== null || !this.isValid()) return null;
    const offset = this._anchors[2].price - this._anchors[0].price;
    const { price: a } = this._anchors[0];
    const { price: b } = this._anchors[1];
    return [a, b, a + offset, b + offset];
  }

  override customPriceTags(): PriceTag[] | null {
    return this.cornerPrices()?.map((price) => ({ price, backColor: '#2962FF' })) ?? null;
  }

  override extentPrices(): number[] | null {
    return this.cornerPrices();
  }

  isValid(): boolean {
    return this._anchors.length >= 3;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new ParallelChannelPaneView(this)];
  }

  /** Called once the placement is committed: turns the raw third click into the stored price offset. */
  finalizePlacement(): void {
    const viewport = this.getViewport();
    if (!viewport || !this._raw || !this.isValid()) return;
    if (this._placedCount !== null) return;
    const px = this.pixels(viewport);
    if (!px) return;
    const price = viewport.priceScale.coordinateToPrice(px.bottom[0].y);
    this._raw = false;
    if (price !== null) this._anchors[2] = { time: this._anchors[0].time, price };
    this.requestUpdate();
  }

  /** Pixel ends of the top and bottom lines (not extended). */
  pixels(viewport: Viewport): ParallelChannelPixels | null {
    if (!this.isValid()) return null;
    const p1 = this.anchorToPixel(this._anchors[0], viewport);
    const p2 = this.anchorToPixel(this._anchors[1], viewport);
    if (!p1 || !p2) return null;
    if (this._raw || this._placedCount !== null) {
      const p3 = this.anchorToPixel(this._anchors[2], viewport);
      if (!p3) return null;
      const dx = p2.x - p1.x;
      const lineY = dx === 0 ? p1.y : p1.y + ((p2.y - p1.y) * (p3.x - p1.x)) / dx;
      const dy = p3.y - lineY;
      return { top: [p1, p2], bottom: [{ x: p1.x, y: p1.y + dy }, { x: p2.x, y: p2.y + dy }] };
    }
    const offset = this._anchors[2].price - this._anchors[0].price;
    const y1 = viewport.priceScale.priceToCoordinate(this._anchors[0].price + offset);
    const y2 = viewport.priceScale.priceToCoordinate(this._anchors[1].price + offset);
    if (y1 === null || y2 === null) return null;
    return { top: [p1, p2], bottom: [{ x: p1.x, y: y1 }, { x: p2.x, y: y2 }] };
  }

  /** The four lines (top, bottom, middle) with the extension applied. */
  lines(viewport: Viewport): { top: [Point, Point]; bottom: [Point, Point]; mid: [Point, Point] } | null {
    const px = this.pixels(viewport);
    if (!px) return null;
    const { extendLeft, extendRight } = this._channelOptions;
    const mid: [Point, Point] = [
      { x: px.top[0].x, y: (px.top[0].y + px.bottom[0].y) / 2 },
      { x: px.top[1].x, y: (px.top[1].y + px.bottom[1].y) / 2 },
    ];
    const ext = (l: [Point, Point]): [Point, Point] => {
      if (!extendLeft && !extendRight) return l;
      const e = extendLineToViewport(l[0], l[1], viewport.width, viewport.height, !!extendLeft, !!extendRight);
      return [e.start, e.end];
    };
    return { top: ext(px.top), bottom: ext(px.bottom), mid: ext(mid) };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const px = this.pixels(viewport);
    if (!px) return [];
    const placed = this._placedCount;
    const corners: ControlPoint[] = [
      { index: PC_TOP_LEFT, x: px.top[0].x, y: px.top[0].y, radius: 6 },
      { index: PC_TOP_RIGHT, x: px.top[1].x, y: px.top[1].y, radius: 6 },
      { index: PC_BOTTOM_LEFT, x: px.bottom[0].x, y: px.bottom[0].y, radius: 6 },
      { index: PC_BOTTOM_RIGHT, x: px.bottom[1].x, y: px.bottom[1].y, radius: 6 },
    ];
    if (placed !== null) return placed >= 2 ? corners : placed >= 1 ? corners.slice(0, 1) : [];
    const midX = (px.top[0].x + px.top[1].x) / 2;
    const at = (l: [Point, Point]) => {
      const dx = l[1].x - l[0].x;
      return dx === 0 ? l[0].y : l[0].y + ((l[1].y - l[0].y) * (midX - l[0].x)) / dx;
    };
    return [
      ...corners,
      { index: PC_BOTTOM_MID, x: midX, y: at(px.bottom), radius: 6 },
      { index: PC_TOP_MID, x: midX, y: at(px.top), radius: 6 },
    ];
  }

  override grabControlPoint(index: number, point: Point): void {
    const viewport = this.getViewport();
    if (!viewport) return;
    if (this._placedCount === null) this.finalizePlacement();
    const handle = this.getControlPoints(viewport).find((c) => c.index === index);
    const px = this.pixels(viewport);
    if (!handle || !px) return;
    this._grab = { index, origin: [px.top[0], px.top[1], px.bottom[0]], handle: { x: handle.x, y: handle.y }, pointer: point };
  }

  override dragControlPoint(index: number, point: Point, anchor: Anchor | null, viewport: Viewport): void {
    const g = this._grab;
    if (!g || g.index !== index) {
      if (anchor && index < 3) this.updateAnchor(index, anchor);
      return;
    }
    const dx = point.x - g.pointer.x;
    const dy = point.y - g.pointer.y;
    const offset = this._anchors[2].price - this._anchors[0].price;
    const toAnchor = (x: number, y: number): Anchor | null => this.pixelToAnchor({ x, y }, viewport);

    if (index === PC_TOP_LEFT || index === PC_BOTTOM_LEFT) {
      const next = index === PC_TOP_LEFT && anchor ? anchor : toAnchor(g.origin[0].x + dx, g.origin[0].y + dy);
      if (!next) return;
      this._anchors[0] = { ...next };
      // Only the bottom-left handle drags the third anchor's time along with the first.
      this._anchors[2] = { time: index === PC_BOTTOM_LEFT ? next.time : this._anchors[2].time, price: next.price + offset };
    } else if (index === PC_TOP_RIGHT || index === PC_BOTTOM_RIGHT) {
      const next = index === PC_TOP_RIGHT && anchor ? anchor : toAnchor(g.origin[1].x + dx, g.origin[1].y + dy);
      if (next) this._anchors[1] = { ...next };
    } else {
      // The grabbed line passes through the handle's new position; the other line stays.
      const target = { x: point.x, y: point.y };
      const [a, b] = index === PC_TOP_MID ? [g.origin[0], g.origin[1]] : [g.origin[2], { x: g.origin[1].x, y: g.origin[2].y + (g.origin[1].y - g.origin[0].y) }];
      const ddx = b.x - a.x;
      const lineY = ddx === 0 ? a.y : a.y + ((b.y - a.y) * (target.x - a.x)) / ddx;
      const shift = target.y - lineY;
      if (index === PC_TOP_MID) {
        const n1 = toAnchor(g.origin[0].x, g.origin[0].y + shift);
        const n2 = toAnchor(g.origin[1].x, g.origin[1].y + shift);
        if (n1 && n2) {
          this._anchors[0] = { time: this._anchors[0].time, price: n1.price };
          this._anchors[1] = { time: this._anchors[1].time, price: n2.price };
        }
      } else {
        const n3 = toAnchor(g.origin[2].x, g.origin[2].y + shift);
        if (n3) this._anchors[2] = { time: this._anchors[0].time, price: n3.price };
      }
    }
    this.requestUpdate();
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const l = this.lines(viewport);
    if (!l) return [];
    const seg = (s: [Point, Point]): LineGeometry => ({ type: 'line', start: s[0], end: s[1] });
    return [seg(l.top), seg(l.bottom), ...(this._channelOptions.showMiddleLine ? [seg(l.mid)] : [])];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const l = this.lines(viewport);
    if (!l) return false;
    const cls = this.constructor as typeof ParallelChannel;
    const limit = cls.HIT_THRESHOLD;
    const p = { x: point.x, y: point.y + cls.HIT_SHIFT_Y };
    const segs = [l.top, l.bottom, ...(this._channelOptions.showMiddleLine ? [l.mid] : [])];
    return segs.some((s) => distanceToLineSegment(p, s[0], s[1]) <= limit);
  }

  clone(newId: string): IDrawing {
    const c = new ParallelChannel(newId, [...this._anchors], { ...this._style }, { ...this._channelOptions });
    c._raw = this._raw;
    return c;
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._channelOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    this._raw = false;
    if (data.options) this._channelOptions = { ...this._channelOptions, ...data.options };
  }

  static create(
    id: string,
    start: Anchor,
    end: Anchor,
    width: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<ParallelChannelOptions>
  ): ParallelChannel {
    const channel = new ParallelChannel(id, [start, end, width], style, options);
    channel._raw = false;
    return channel;
  }
}
