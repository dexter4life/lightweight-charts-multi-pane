import { distanceToLineSegment } from '../../core/geometry';
import type { Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { ShapeBase, type ShapeOptions } from './shape-base';

export type PolylineOptions = ShapeOptions;

const HIT_THRESHOLD = 4;

/**
 * Polyline - any number of points joined by straight lines. Clicking the first point again closes it, and only
 * a closed polyline has a background; a double-click finishes it open.
 */
export class Polyline extends ShapeBase {
  readonly type: string = 'polyline';

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<PolylineOptions> = {}) {
    super(
      id,
      anchors,
      style,
      options,
      { lineColor: '#55B9D1', lineWidth: 1, lineDash: [], fillColor: 'rgba(40, 185, 205, 0.2)' },
      { filled: true, closed: false }
    );
  }

  /** Kept for callers of the previous API. */
  get polylineOptions(): PolylineOptions {
    return this._shapeOptions;
  }

  setPolylineOptions(options: Partial<PolylineOptions>): void {
    this.setShapeOptions(options);
  }

  addPoint(anchor: Anchor): void {
    this._anchors.push(anchor);
    this.requestUpdate();
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  private get closed(): boolean {
    return !!this._shapeOptions.closed && this._anchors.length >= 3;
  }

  override hasFill(): boolean {
    return super.hasFill() && this.closed;
  }

  protected points(viewport: Viewport): Point[] {
    const pts: Point[] = [];
    for (const a of this._anchors) {
      const p = this.anchorToPixel(a, viewport);
      if (p) pts.push(p);
    }
    return pts;
  }

  tracePath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean {
    const pts = this.points(viewport);
    if (pts.length < 2) return false;
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * pr, p.y * pr) : ctx.lineTo(p.x * pr, p.y * pr)));
    if (this.closed) ctx.closePath();
    return true;
  }

  textCenter(): Point | null {
    return null;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const pts = this.points(viewport);
    return pts.length < 2 ? [] : [{ type: 'polygon', points: pts, closed: this.closed }];
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const placed = this._placedCount ?? this._anchors.length;
    const out: ControlPoint[] = [];
    this._anchors.slice(0, placed).forEach((a, index) => {
      const p = this.anchorToPixel(a, viewport);
      if (p) out.push({ index, x: p.x, y: p.y, radius: 6 });
    });
    return out;
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const pts = this.points(viewport);
    const n = this.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      if (distanceToLineSegment(point, pts[i], pts[(i + 1) % pts.length]) <= HIT_THRESHOLD) return true;
    }
    return false;
  }

  clone(newId: string): IDrawing {
    return new Polyline(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._shapeOptions });
  }

  static create(id: string, points: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<PolylineOptions>): Polyline {
    return new Polyline(id, points, style, options);
  }
}
