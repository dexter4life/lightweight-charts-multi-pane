import { distanceToLineSegment } from '../../core/geometry';
import type { Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { ShapeBase, type ShapeOptions } from './shape-base';

export type RotatedRectangleOptions = ShapeOptions;

const HIT_THRESHOLD = 4;

interface Geo {
  a: Point;
  b: Point;
  /** Unit normal of the A-B axis. */
  n: Point;
  /** Signed distance of the third point from the axis, along `n`. */
  d: number;
  /** Corners in order: A+, B+, B-, A-. */
  corners: Point[];
}

interface Grab {
  point: Point;
  d: number | null;
  side: number;
}

/**
 * Rotated Rectangle - the first two points are the midpoints of two opposite edges (the axis); the third sets
 * the half-width as its perpendicular distance from that axis. The rectangle is symmetric about the axis.
 */
export class RotatedRectangle extends ShapeBase {
  readonly type = 'rotated-rectangle';

  private _grab: Grab | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<RotatedRectangleOptions> = {}
  ) {
    super(id, anchors, style, options, { lineColor: '#67AD5C', lineWidth: 1, lineDash: [], fillColor: 'rgba(103, 173, 92, 0.2)' });
  }

  /** Kept for callers of the previous API. */
  get rotatedRectangleOptions(): RotatedRectangleOptions {
    return this._shapeOptions;
  }

  setRotatedRectangleOptions(options: Partial<RotatedRectangleOptions>): void {
    this.setShapeOptions(options);
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  private axis(viewport: Viewport): { a: Point; b: Point; n: Point } | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) return null;
    return { a, b, n: { x: -(b.y - a.y) / len, y: (b.x - a.x) / len } };
  }

  private geo(viewport: Viewport): Geo | null {
    const ax = this.axis(viewport);
    const c = this._anchors[2] ? this.anchorToPixel(this._anchors[2], viewport) : null;
    if (!ax || !c) return null;
    const d = (c.x - ax.a.x) * ax.n.x + (c.y - ax.a.y) * ax.n.y;
    const off = (p: Point, s: number): Point => ({ x: p.x + ax.n.x * d * s, y: p.y + ax.n.y * d * s });
    return { ...ax, d, corners: [off(ax.a, 1), off(ax.b, 1), off(ax.b, -1), off(ax.a, -1)] };
  }

  tracePath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean {
    const g = this.geo(viewport);
    if (g && Math.abs(g.d) > 0) {
      g.corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * pr, p.y * pr) : ctx.lineTo(p.x * pr, p.y * pr)));
      ctx.closePath();
      return true;
    }
    // Until the third point is placed only the axis shows.
    const ax = this.axis(viewport);
    if (!ax) return false;
    ctx.moveTo(ax.a.x * pr, ax.a.y * pr);
    ctx.lineTo(ax.b.x * pr, ax.b.y * pr);
    return true;
  }

  textCenter(viewport: Viewport): Point | null {
    const ax = this.axis(viewport);
    return ax ? { x: (ax.a.x + ax.b.x) / 2, y: (ax.a.y + ax.b.y) / 2 } : null;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const g = this.geo(viewport);
    if (!g) return [];
    return [{ type: 'polygon', points: g.corners, closed: true }];
  }

  getCorners(viewport: Viewport): Point[] | null {
    return this.geo(viewport)?.corners ?? null;
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const ax = this.axis(viewport);
    if (!ax) return [];
    const spots: Array<[number, number, number]> = [
      [0, ax.a.x, ax.a.y],
      [1, ax.b.x, ax.b.y],
    ];
    const placed = this._placedCount ?? this._anchors.length;
    const g = this.geo(viewport);
    if (g && (placed >= 3 || this._anchors.length >= 3)) {
      for (const p of g.corners) spots.push([2, p.x, p.y]);
    }
    return spots.map(([index, x, y]) => ({ index, x, y, radius: 6 }));
  }

  override grabControlPoint(index: number, point: Point): void {
    this._grab = index >= 2 ? { point, d: null, side: 0 } : null;
  }

  override dragControlPoint(index: number, point: Point, anchor: Anchor | null, viewport: Viewport): void {
    if (!anchor) return;
    if (index < 2) {
      this.updateAnchor(index, anchor);
      return;
    }
    const g = this.geo(viewport);
    const c = this._anchors[2];
    if (!g || !c) return;
    // Work from the grab so a plain click leaves the width untouched; every corner resizes the half-width.
    if (!this._grab) this._grab = { point, d: null, side: 0 };
    const grab = this._grab;
    if (grab.d === null) {
      grab.d = Math.abs(g.d);
      const along = (grab.point.x - g.a.x) * g.n.x + (grab.point.y - g.a.y) * g.n.y;
      grab.side = along >= 0 ? 1 : -1;
    }
    const delta = (point.x - grab.point.x) * g.n.x + (point.y - grab.point.y) * g.n.y;
    if (Math.abs(delta) < 0.01) return;
    const half = Math.abs(grab.d + grab.side * delta);
    const cp = this.anchorToPixel(c, viewport);
    if (!cp) return;
    const sign = g.d >= 0 ? 1 : -1;
    // Keep C's position along the axis and slide it across to the new half-width.
    const foot = { x: cp.x - g.n.x * g.d, y: cp.y - g.n.y * g.d };
    const next = this.pixelToAnchor({ x: foot.x + g.n.x * sign * half, y: foot.y + g.n.y * sign * half }, viewport);
    if (next) this.updateAnchor(2, { ...c, ...next });
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const g = this.geo(viewport);
    if (!g) return false;
    for (let i = 0; i < 4; i++) {
      if (distanceToLineSegment(point, g.corners[i], g.corners[(i + 1) % 4]) <= HIT_THRESHOLD) return true;
    }
    return false;
  }

  clone(newId: string): IDrawing {
    return new RotatedRectangle(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._shapeOptions });
  }
}
