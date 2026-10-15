import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Geometry, RectangleGeometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { RectanglePaneView } from './rectangle-pane-view';

export type ShapeTextVAlign = 'top' | 'middle' | 'bottom';
export type ShapeTextHAlign = 'left' | 'center' | 'right';

/**
 * Rectangle options
 */
export interface RectangleOptions extends DrawingOptions {
  /** Background fill; the colour and opacity live in `style.fillColor`. */
  filled?: boolean;
  showDimensions?: boolean;
  extendLeft?: boolean;
  extendRight?: boolean;
  showText?: boolean;
  text?: string;
  textColor?: string;
  textSize?: number;
  textBold?: boolean;
  textItalic?: boolean;
  textVAlign?: ShapeTextVAlign;
  textHAlign?: ShapeTextHAlign;
  visibility?: VisibilityMap;
}

export const DEFAULT_RECTANGLE_OPTIONS = {
  filled: true,
  showDimensions: false,
  extendLeft: false,
  extendRight: false,
  showText: false,
  text: '',
  textSize: 14,
  textBold: false,
  textItalic: false,
  textVAlign: 'top' as ShapeTextVAlign,
  textHAlign: 'left' as ShapeTextHAlign,
};

export interface RectangleLayout {
  a: Point;
  b: Point;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const HIT_THRESHOLD = 4;

/**
 * Rectangle - A rectangular shape defined by two corner points.
 *
 * Eight handles: the four corners and the four edge midpoints. Corner handles 0 and 1 are the anchors
 * themselves; the others move the shared edge(s) of whichever anchors sit on that side.
 */
export class Rectangle extends Drawing {
  readonly type: string = 'rectangle';

  protected static readonly REQUIRED_ANCHORS: number = 2;

  protected _rectangleOptions: RectangleOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<RectangleOptions> = {}
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(
      id,
      anchors,
      { lineColor: '#9c27b0', lineWidth: 1, lineDash: [], fillColor: 'rgba(156, 39, 176, 0.2)', ...style },
      base
    );
    this._rectangleOptions = { ...DEFAULT_RECTANGLE_OPTIONS, ...options };
  }

  get rectangleOptions(): RectangleOptions {
    return this._rectangleOptions;
  }

  setRectangleOptions(options: Partial<RectangleOptions>): void {
    this._rectangleOptions = { ...this._rectangleOptions, ...options };
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._rectangleOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  isValid(): boolean {
    return this._anchors.length >= (this.constructor as typeof Rectangle).REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new RectanglePaneView(this, 'body'), new RectanglePaneView(this, 'handles')];
  }

  layout(viewport: Viewport): RectangleLayout | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;
    return {
      a,
      b,
      left: Math.min(a.x, b.x),
      right: Math.max(a.x, b.x),
      top: Math.min(a.y, b.y),
      bottom: Math.max(a.y, b.y),
    };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const l = this.layout(viewport);
    if (!l) return super.getControlPoints(viewport);
    const mx = (l.left + l.right) / 2;
    const my = (l.top + l.bottom) / 2;
    const placed = this._placedCount ?? this._anchors.length;
    const spots: Array<[number, number, number]> = [
      [0, l.a.x, l.a.y],
      [1, l.b.x, l.b.y],
    ];
    if (placed >= 2) {
      spots.push(
        [2, l.a.x, l.b.y],
        [3, l.b.x, l.a.y],
        [4, mx, l.top],
        [5, mx, l.bottom],
        [6, l.left, my],
        [7, l.right, my]
      );
    }
    return spots.map(([index, x, y]) => ({ index, x, y, radius: index < 4 ? 6 : 5 }));
  }

  override dragControlPoint(index: number, _point: Point, anchor: Anchor | null, viewport: Viewport): void {
    if (!anchor) return;
    if (index < 2) {
      this.updateAnchor(index, anchor);
      return;
    }
    const l = this.layout(viewport);
    if (!l) return;
    // The anchor on the left/top side is the one whose pixel is the smaller.
    const leftIdx = l.a.x <= l.b.x ? 0 : 1;
    const topIdx = l.a.y <= l.b.y ? 0 : 1;
    const next = this._anchors.map((x) => ({ ...x }));
    const setX = (i: number) => (next[i].time = anchor.time);
    const setY = (i: number) => (next[i].price = anchor.price);
    switch (index) {
      case 2:
        setX(0);
        setY(1);
        break;
      case 3:
        setX(1);
        setY(0);
        break;
      case 4:
        setY(topIdx);
        break;
      case 5:
        setY(1 - topIdx);
        break;
      case 6:
        setX(leftIdx);
        break;
      case 7:
        setX(1 - leftIdx);
        break;
    }
    this.setAnchors(next);
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const l = this.layout(viewport);
    if (!l) return [];
    const rectGeometry: RectangleGeometry = {
      type: 'rectangle',
      topLeft: { x: l.left, y: l.top },
      width: l.right - l.left,
      height: l.bottom - l.top,
    };
    return [rectGeometry];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const l = this.layout(viewport);
    if (!l) return false;
    const o = this._rectangleOptions;
    const left = o.extendLeft ? -Infinity : l.left;
    const right = o.extendRight ? Infinity : l.right;
    const inX = point.x >= left - HIT_THRESHOLD && point.x <= right + HIT_THRESHOLD;
    if (o.filled && point.x >= left && point.x <= right && point.y >= l.top && point.y <= l.bottom) return true;
    if (inX && (Math.abs(point.y - l.top) <= HIT_THRESHOLD || Math.abs(point.y - l.bottom) <= HIT_THRESHOLD)) return true;
    const inY = point.y >= l.top - HIT_THRESHOLD && point.y <= l.bottom + HIT_THRESHOLD;
    return inY && (Math.abs(point.x - l.left) <= HIT_THRESHOLD || Math.abs(point.x - l.right) <= HIT_THRESHOLD);
  }

  /**
   * Get price range of the rectangle
   */
  getPriceRange(): { min: number; max: number; range: number } {
    if (!this.isValid()) return { min: 0, max: 0, range: 0 };
    const min = Math.min(this._anchors[0].price, this._anchors[1].price);
    const max = Math.max(this._anchors[0].price, this._anchors[1].price);
    return { min, max, range: max - min };
  }

  clone(newId: string): IDrawing {
    return new Rectangle(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._rectangleOptions });
  }

  static create(
    id: string,
    corner1: Anchor,
    corner2: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<RectangleOptions>
  ): Rectangle {
    return new Rectangle(id, [corner1, corner2], style, options);
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._rectangleOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setRectangleOptions(data.options);
  }
}
