import { defaultFontFamily } from '../../../helpers/make-font';
import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { ArrowMarkerPaneView } from './arrow-marker-pane-view';

export type ArrowDirection = 'up' | 'down' | 'left' | 'right';

export const ARROW_MARKER_FONT = defaultFontFamily;

export interface ArrowMarkerOptions extends DrawingOptions {
  backgroundColor?: string;
  showText?: boolean;
  text?: string;
  textColor?: string;
  textSize?: number;
  textBold?: boolean;
  textItalic?: boolean;
  visibility?: VisibilityMap;
}

/** Proportions of the arrow polygon, as fractions of the p1-p2 length. */
export const ARROW_MARKER_GEOMETRY = {
  startHalf: 0.0125,
  shaftHalf: 0.085,
  headStart: 0.737,
  headHalf: 0.162,
  /** Gap between the label and the first point. */
  textGap: 16,
  /** Stroke width of the round-joined outline, in css px. */
  outline: 1.5,
} as const;

export interface ArrowMarkerLayout {
  p1: Point;
  p2: Point;
  polygon: Point[];
}

/** Arrow Marker - a filled, tapered arrow from the first point to the second, with an optional label at its tail. */
export class ArrowMarker extends Drawing {
  readonly type = 'arrow-marker';

  protected static readonly REQUIRED_ANCHORS = 2;

  private _arrowOptions: ArrowMarkerOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ArrowMarkerOptions> = {}) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: '#1E53E5', lineWidth: 1, ...style }, base);

    this._arrowOptions = {
      ...this._options,
      backgroundColor: options.backgroundColor ?? '#1E53E5',
      showText: options.showText ?? true,
      text: options.text ?? '',
      textColor: options.textColor ?? '#1E53E5',
      textSize: options.textSize ?? 16,
      textBold: options.textBold ?? true,
      textItalic: options.textItalic ?? false,
      visibility: options.visibility,
    };
  }

  get arrowMarkerOptions(): ArrowMarkerOptions {
    return this._arrowOptions;
  }

  setArrowMarkerOptions(options: Partial<ArrowMarkerOptions>): void {
    this._arrowOptions = { ...this._arrowOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._arrowOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  isValid(): boolean {
    return this._anchors.length >= ArrowMarker.REQUIRED_ANCHORS;
  }

  layout(viewport: Viewport): ArrowMarkerLayout | null {
    if (!this.isValid()) return null;
    const p1 = this.anchorToPixel(this._anchors[0], viewport);
    const p2 = this.anchorToPixel(this._anchors[1], viewport);
    if (!p1 || !p2) return null;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return { p1, p2, polygon: [] };
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const g = ARROW_MARKER_GEOMETRY;
    const at = (t: number, w: number): Point => ({ x: p1.x + ux * t + nx * w, y: p1.y + uy * t + ny * w });
    const inset = g.outline / 2;
    const ws = Math.max(0.5, len * g.startHalf - inset + 0.5);
    const wh = len * g.shaftHalf - inset;
    const wb = len * g.headHalf - inset;
    const th = len * g.headStart;
    const polygon = [at(0, ws), at(th, wh), at(th + 1, wb), { x: p2.x, y: p2.y }, at(th + 1, -wb), at(th, -wh), at(0, -ws)];
    return { p1, p2, polygon };
  }

  paneViews(): IPrimitivePaneView[] {
    return [new ArrowMarkerPaneView(this)];
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;
    const l = this.layout(viewport);
    if (!l) return false;
    const poly = l.polygon;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    if (inside) return true;
    // A few pixels of slack along the thin tail
    const dx = l.p2.x - l.p1.x;
    const dy = l.p2.y - l.p1.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - l.p1.x) * dx + (point.y - l.p1.y) * dy) / len2));
    return Math.hypot(point.x - (l.p1.x + t * dx), point.y - (l.p1.y + t * dy)) <= 5;
  }

  override toJSON() {
    const { visible, locked } = this._options;
    return { ...super.toJSON(), options: { ...this._arrowOptions, visible, locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._arrowOptions = { ...this._arrowOptions, ...data.options };
  }

  clone(newId: string): IDrawing {
    return new ArrowMarker(newId, [...this._anchors], { ...this._style }, { ...this._arrowOptions });
  }

  static create(id: string, p1: Anchor, p2: Anchor, style?: Partial<DrawingStyle>, options?: Partial<ArrowMarkerOptions>): ArrowMarker {
    return new ArrowMarker(id, [p1, p2], style, options);
  }
}
