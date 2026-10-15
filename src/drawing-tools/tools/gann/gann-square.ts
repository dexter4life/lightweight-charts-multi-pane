import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Geometry, LineGeometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import {
  GannSquareFixed,
  GANN_SQUARE_FIXED_SPAN,
  type GannSquareFixedLayout,
  type GannSquareFixedOptions,
  type GannSquareFixedRay,
} from './gann-square-fixed';
import { GannSquarePaneView } from './gann-square-pane-view';

/** Gann square divisions (re-exported for public API compatibility). */
export { GANN_SQUARE_DIVISIONS } from './constants';

export interface GannSquareLabelsStyle {
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

export interface GannSquareOptions extends GannSquareFixedOptions {
  /** Price units per bar; the box is a square in (bars, price / ratio) space. */
  scaleRatio?: number;
  /** Bar count, price range and ratio drawn around the box. */
  showLabels?: boolean;
  labelsStyle?: GannSquareLabelsStyle;
}

export const DEFAULT_GANN_SQUARE_LABELS: GannSquareLabelsStyle = { fontSize: 12, bold: false, italic: false };

/** The box spans the two points exactly; each axis is split into five units. */
export interface GannSquareLayout extends GannSquareFixedLayout {
  /** Signed pixel size of one unit on each axis (the box grows towards the far point). */
  ux: number;
  uy: number;
  /** The point the box grows towards. */
  far: Point;
}

const HIT_THRESHOLD = 3;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + s * dx), p.y - (a.y + s * dy));
}

/**
 * Gann Square: a box spanned by the two points whose size is measured in bars on the x axis and in
 * `scaleRatio` price units per bar on the y axis. Inside it, levels, fans and arcs work like
 * Gann Square Fixed but in the box's own units, so a resized box turns circles into ellipses.
 */
export class GannSquare extends GannSquareFixed {
  override readonly type: string = 'gann-square';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<GannSquareOptions> = {}
  ) {
    super(id, anchors, style, options);
  }

  get squareOptions(): GannSquareOptions {
    return this._gannOptions as GannSquareOptions;
  }

  get labelsStyle(): GannSquareLabelsStyle {
    return { ...DEFAULT_GANN_SQUARE_LABELS, ...this.squareOptions.labelsStyle };
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new GannSquarePaneView(this), new GannSquarePaneView(this, 'handles')];
  }

  /** While a point is still being placed only the first handle is shown. */
  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const placed = this.placedCount ?? this._anchors.length;
    return super.getControlPoints(viewport).filter((p) => p.index < placed);
  }

  /** Pixel width of one bar. */
  barSpacing(viewport: Viewport): number {
    const x0 = viewport.timeScale.logicalToCoordinate(0 as never);
    const x1 = viewport.timeScale.logicalToCoordinate(1 as never);
    const spacing = x0 === null || x1 === null ? 0 : Math.abs(x1 - x0);
    return spacing > 0 ? spacing : 6;
  }

  private pricePerPixel(viewport: Viewport): number {
    const p0 = viewport.priceScale.coordinateToPrice(0);
    const p1 = viewport.priceScale.coordinateToPrice(100);
    return p0 === null || p1 === null ? 0 : Math.abs(p0 - p1) / 100;
  }

  /** The three figures drawn around the box: bars, price range and ratio, signed from origin to far point. */
  labelTexts(layout: GannSquareLayout, viewport: Viewport): { bars: string; price: string; ratio: string } {
    const reverse = !!this._gannOptions.reverse;
    const from = this._anchors[reverse ? 1 : 0];
    const to = this._anchors[reverse ? 0 : 1];
    const bars = Math.round((layout.far.x - layout.origin.x) / this.barSpacing(viewport));
    const delta = to.price - from.price;
    const minMove = (this._series?.options() as { priceFormat?: { minMove?: number } } | undefined)?.priceFormat?.minMove || 0.01;
    const decimals = Math.min(8, Math.max(0, Math.ceil(-Math.log10(minMove) - 1e-9)));
    const ratio = this.squareOptions.scaleRatio ?? 0;
    return {
      bars: String(bars),
      price: `${delta < 0 ? '\u2212' : ''}${Math.abs(delta).toFixed(decimals)}`,
      ratio: String(Number(ratio.toFixed(7))),
    };
  }

  /** Signed bar count from the first to the second point. */
  barsBetween(viewport: Viewport): number {
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return 0;
    return Math.round((b.x - a.x) / this.barSpacing(viewport));
  }

  /**
   * Turns a freshly placed pair of points into a square: the bar count comes from the x distance
   * and the price range from the chart's current price-per-bar scale, towards the pointer's side.
   */
  finalizePlacement(): void {
    const viewport = this.getViewport();
    if (!viewport || !this.isValid()) return;
    const a = this._anchors[0];
    const b = this._anchors[1];
    const ratio = this.pricePerPixel(viewport) * this.barSpacing(viewport);
    const bars = Math.abs(this.barsBetween(viewport));
    const up = b.price >= a.price ? 1 : -1;
    this._anchors[1] = { ...b, price: a.price + up * bars * ratio };
    this._gannOptions = { ...this._gannOptions, scaleRatio: ratio } as GannSquareOptions;
    this.requestUpdate();
  }

  /** Dragging a point reshapes the box; the ratio then follows from the new price range per bar. */
  private syncScaleRatio(): void {
    const viewport = this.getViewport();
    if (!viewport || !this.isValid()) return;
    const bars = Math.abs(this.barsBetween(viewport));
    if (bars === 0) return;
    const ratio = Math.abs(this._anchors[1].price - this._anchors[0].price) / bars;
    this._gannOptions = { ...this._gannOptions, scaleRatio: ratio } as GannSquareOptions;
  }

  override dragControlPoint(index: number, point: Point, anchor: Anchor | null, viewport: Viewport): void {
    super.dragControlPoint(index, point, anchor, viewport);
    this.syncScaleRatio();
  }

  override setAnchors(anchors: Anchor[]): void {
    super.setAnchors(anchors);
    this.syncScaleRatio();
  }

  /** Moving the whole box keeps its price range, so the ratio is untouched. */
  override bodyDragAnchors(origin: Point[], dx: number, dy: number, viewport: Viewport): Anchor[] | null {
    const next = super.bodyDragAnchors(origin, dx, dy, viewport);
    if (next && next.length >= 2) {
      const range = this._anchors[1].price - this._anchors[0].price;
      next[1] = { ...next[1], price: next[0].price + range };
    }
    return next;
  }

  /** Editing the ratio moves the second point: the first stays and the bar count is kept. */
  override setGannOptions(options: Partial<GannSquareOptions>): void {
    const prev = this.squareOptions.scaleRatio;
    super.setGannOptions(options);
    const ratio = options.scaleRatio;
    const viewport = this.getViewport();
    if (ratio === undefined || ratio === prev || !viewport || !this.isValid() || !(ratio > 0)) return;
    const a = this._anchors[0];
    const b = this._anchors[1];
    const bars = Math.abs(this.barsBetween(viewport));
    const up = b.price >= a.price ? 1 : -1;
    this._anchors[1] = { ...b, price: a.price + up * bars * ratio };
    this.requestUpdate();
  }

  override layout(viewport: Viewport): GannSquareLayout | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;

    const reverse = !!this._gannOptions.reverse;
    const origin = reverse ? b : a;
    const far = reverse ? a : b;
    const w = far.x - origin.x;
    let h = far.y - origin.y;
    // Until the placement is finalised the box is a pixel square sized by the x distance.
    if (this.squareOptions.scaleRatio === undefined) h = (h < 0 ? -1 : 1) * Math.abs(w);
    const ux = w / GANN_SQUARE_FIXED_SPAN;
    const uy = h / GANN_SQUARE_FIXED_SPAN;
    return {
      origin,
      far: { x: origin.x + w, y: origin.y + h },
      unit: Math.abs(ux),
      ux,
      uy,
      sx: w < 0 ? -1 : 1,
      sy: h < 0 ? -1 : 1,
      left: Math.min(origin.x, origin.x + w),
      right: Math.max(origin.x, origin.x + w),
      top: Math.min(origin.y, origin.y + h),
      bottom: Math.max(origin.y, origin.y + h),
    };
  }

  /** Where a ray ends: the box edge reached by the fan's slope. */
  fanTip(layout: GannSquareLayout, fan: GannSquareFixedRay): Point {
    const t = GANN_SQUARE_FIXED_SPAN / (Math.max(fan.x, fan.y) || 1);
    return { x: layout.origin.x + layout.ux * fan.x * t, y: layout.origin.y + layout.uy * fan.y * t };
  }

  /** Arcs are circles in box units, so on screen they are ellipses centred on the origin. */
  arcRadii(layout: GannSquareLayout, arc: GannSquareFixedRay): { rx: number; ry: number; rho: number } {
    const rho = Math.hypot(arc.x, arc.y);
    return { rx: Math.abs(layout.ux) * rho, ry: Math.abs(layout.uy) * rho, rho };
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const layout = this.layout(viewport);
    if (!layout) return [];
    const geometries: Geometry[] = [];
    (this._gannOptions.levels ?? []).forEach((l, i) => {
      if (!l.visible) return;
      const y = layout.origin.y + layout.uy * i;
      const x = layout.origin.x + layout.ux * i;
      geometries.push({ type: 'line', start: { x: layout.left, y }, end: { x: layout.right, y } } as LineGeometry);
      geometries.push({ type: 'line', start: { x, y: layout.top }, end: { x, y: layout.bottom } } as LineGeometry);
    });
    return geometries;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.layout(viewport);
    if (!layout) return false;
    const { left, right, top, bottom, origin, ux, uy } = layout;
    const o = this._gannOptions;

    const inX = point.x >= left - HIT_THRESHOLD && point.x <= right + HIT_THRESHOLD;
    const inY = point.y >= top - HIT_THRESHOLD && point.y <= bottom + HIT_THRESHOLD;
    if (!inX || !inY) return false;

    for (let i = 0; i < (o.levels ?? []).length; i++) {
      if (!o.levels![i].visible) continue;
      if (Math.abs(point.y - (origin.y + uy * i)) <= HIT_THRESHOLD) return true;
      if (Math.abs(point.x - (origin.x + ux * i)) <= HIT_THRESHOLD) return true;
    }
    for (const fan of o.fanlines ?? []) {
      if (fan.visible && distanceToSegment(point, origin, this.fanTip(layout, fan)) <= HIT_THRESHOLD) return true;
    }

    // Distance to an ellipse, approximated from the radial gap and how far a unit of radius stretches.
    const nx = ux === 0 ? 0 : (point.x - origin.x) / ux;
    const ny = uy === 0 ? 0 : (point.y - origin.y) / uy;
    if (nx >= -0.01 && ny >= -0.01) {
      const rho = Math.hypot(nx, ny);
      if (rho > 0) {
        const stretch = Math.hypot(ux * (nx / rho), uy * (ny / rho));
        for (const arc of o.arcs ?? []) {
          if (arc.visible && Math.abs(rho - Math.hypot(arc.x, arc.y)) * stretch <= HIT_THRESHOLD) return true;
        }
      }
    }
    return false;
  }

  override clone(newId: string): IDrawing {
    return new GannSquare(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._gannOptions });
  }

  static override create(
    id: string,
    point1: Anchor,
    point2: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<GannSquareOptions>
  ): GannSquare {
    return new GannSquare(id, [point1, point2], style, options);
  }
}
