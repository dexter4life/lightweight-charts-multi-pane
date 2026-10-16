import { distanceToLineSegment } from '../../core/geometry';
import type { Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { ShapeBase, type ShapeOptions } from './shape-base';

export type PathOptions = ShapeOptions;

const HIT_THRESHOLD = 4;

/**
 * Path - open polyline of any number of points, finished by a double-click. The ends can carry arrow caps
 * (the right end does by default); there is no background.
 */
export class Path extends ShapeBase {
  readonly type: string = 'path';

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<PathOptions> = {}) {
    super(id, anchors, style, options, { lineColor: '#2962FF', lineWidth: 2, lineDash: [] }, { filled: false, leftEnd: 'normal', rightEnd: 'arrow' });
  }

  /** Kept for callers of the previous API. */
  get pathOptions(): PathOptions {
    return this._shapeOptions;
  }

  setPathOptions(options: Partial<PathOptions>): void {
    this.setShapeOptions(options);
  }

  addPoint(anchor: Anchor): void {
    this._anchors.push(anchor);
    this.requestUpdate();
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
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
    return true;
  }

  override drawOverlay(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): void {
    const pts = this.points(viewport);
    if (pts.length < 2) return;
    const o = this._shapeOptions;
    if (o.leftEnd === 'arrow') this.arrowCap(ctx, pts[0], pts.slice(1), pr);
    if (o.rightEnd === 'arrow') this.arrowCap(ctx, pts[pts.length - 1], pts.slice(0, -1).reverse(), pr);
  }

  /** `path` runs away from the tip; the cap direction uses the first point far enough from it. */
  private arrowCap(ctx: CanvasRenderingContext2D, tip: Point, path: Point[], pr: number): void {
    const size = 7 * Math.max(1, this._style.lineWidth);
    let other = path[0];
    for (const p of path) {
      other = p;
      if (Math.hypot(p.x - tip.x, p.y - tip.y) >= size) break;
    }
    const dx = other.x - tip.x;
    const dy = other.y - tip.y;
    if (dx === 0 && dy === 0) return;
    const base = Math.atan2(dy, dx);
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const sign of [-1, 1]) {
      ctx.moveTo(tip.x * pr, tip.y * pr);
      ctx.lineTo((tip.x + Math.cos(base + (sign * Math.PI) / 4) * size) * pr, (tip.y + Math.sin(base + (sign * Math.PI) / 4) * size) * pr);
    }
    ctx.stroke();
  }

  textCenter(): Point | null {
    return null;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const pts = this.points(viewport);
    return pts.length < 2 ? [] : [{ type: 'polygon', points: pts, closed: false }];
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
    for (let i = 0; i < pts.length - 1; i++) {
      if (distanceToLineSegment(point, pts[i], pts[i + 1]) <= HIT_THRESHOLD) return true;
    }
    return false;
  }

  clone(newId: string): IDrawing {
    return new Path(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._shapeOptions });
  }

  static create(id: string, points: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<PathOptions>): Path {
    return new Path(id, points, style, options);
  }
}
