import { distanceToLineSegment } from '../../core/geometry';
import type { Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { ShapeBase, type ShapeOptions } from './shape-base';

export type ArcOptions = ShapeOptions;

const HIT_THRESHOLD = 4;
const SEGMENTS = 48;

interface Geo {
  a: Point;
  b: Point;
  /** Unit normal of the chord. */
  n: Point;
  /** Signed height of the arc along `n`. */
  h: number;
  mid: Point;
}

interface Grab {
  point: Point;
  h: number;
}

/**
 * Arc - A and B are the chord endpoints; the third point sets the height as its perpendicular distance from
 * the chord. The curve is a parabola over the chord (the same as a quadratic Bezier with control point
 * M + 2h), the region between the curve and the chord is filled, and only the curve is stroked.
 */
export class Arc extends ShapeBase {
  readonly type = 'arc';

  private _grab: Grab | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ArcOptions> = {}) {
    super(id, anchors, style, options, { lineColor: '#D63865', lineWidth: 1, lineDash: [], fillColor: 'rgba(205, 40, 100, 0.2)' });
  }

  /** Kept for callers of the previous API. */
  get arcOptions(): ArcOptions {
    return this._shapeOptions;
  }

  setArcOptions(options: Partial<ArcOptions>): void {
    this.setShapeOptions(options);
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  private chord(viewport: Viewport): Omit<Geo, 'h'> | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) return null;
    return { a, b, n: { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  private geo(viewport: Viewport): Geo | null {
    const ch = this.chord(viewport);
    const c = this._anchors[2] ? this.anchorToPixel(this._anchors[2], viewport) : null;
    if (!ch || !c) return null;
    return { ...ch, h: (c.x - ch.a.x) * ch.n.x + (c.y - ch.a.y) * ch.n.y };
  }

  private curve(g: Geo): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      const k = 4 * s * (1 - s) * g.h;
      pts.push({ x: g.a.x + (g.b.x - g.a.x) * s + g.n.x * k, y: g.a.y + (g.b.y - g.a.y) * s + g.n.y * k });
    }
    return pts;
  }

  tracePath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean {
    const g = this.geo(viewport);
    if (g && Math.abs(g.h) > 0) {
      const c = { x: g.mid.x + g.n.x * 2 * g.h, y: g.mid.y + g.n.y * 2 * g.h };
      ctx.moveTo(g.a.x * pr, g.a.y * pr);
      ctx.quadraticCurveTo(c.x * pr, c.y * pr, g.b.x * pr, g.b.y * pr);
      return true;
    }
    // Until the third point is placed only the chord shows.
    const ch = this.chord(viewport);
    if (!ch) return false;
    ctx.moveTo(ch.a.x * pr, ch.a.y * pr);
    ctx.lineTo(ch.b.x * pr, ch.b.y * pr);
    return true;
  }

  override traceFillPath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean {
    const g = this.geo(viewport);
    if (!g || Math.abs(g.h) === 0) return false;
    this.tracePath(ctx, pr, viewport);
    ctx.closePath();
    return true;
  }

  textCenter(): Point | null {
    return null;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const g = this.geo(viewport);
    if (!g) return [];
    return [{ type: 'polygon', points: this.curve(g), closed: true }];
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const ch = this.chord(viewport);
    if (!ch) return [];
    const spots: Array<[number, number, number]> = [
      [0, ch.a.x, ch.a.y],
      [1, ch.b.x, ch.b.y],
    ];
    const placed = this._placedCount ?? this._anchors.length;
    const g = this.geo(viewport);
    if (g && (placed >= 3 || this._anchors.length >= 3)) spots.push([2, ch.mid.x + ch.n.x * g.h, ch.mid.y + ch.n.y * g.h]);
    return spots.map(([index, x, y]) => ({ index, x, y, radius: 6 }));
  }

  override grabControlPoint(index: number, point: Point): void {
    this._grab = index === 2 ? { point, h: NaN } : null;
  }

  override dragControlPoint(index: number, point: Point, anchor: Anchor | null, viewport: Viewport): void {
    if (!anchor) return;
    const g = this.geo(viewport);
    if (index < 2) {
      this.updateAnchor(index, anchor);
      // The height survives an endpoint drag: re-seat the third point on the new chord's bisector.
      const c = this._anchors[2];
      const ch = g && c ? this.chord(viewport) : null;
      if (g && c && ch) {
        const next = this.pixelToAnchor({ x: ch.mid.x + ch.n.x * g.h, y: ch.mid.y + ch.n.y * g.h }, viewport);
        if (next) this.updateAnchor(2, { ...c, ...next });
      }
      return;
    }
    const c = this._anchors[2];
    if (!g || !c) return;
    if (!this._grab) this._grab = { point, h: NaN };
    const grab = this._grab;
    if (Number.isNaN(grab.h)) grab.h = g.h;
    const delta = (point.x - grab.point.x) * g.n.x + (point.y - grab.point.y) * g.n.y;
    if (Math.abs(delta) < 0.01) return;
    const h = grab.h + delta;
    const next = this.pixelToAnchor({ x: g.mid.x + g.n.x * h, y: g.mid.y + g.n.y * h }, viewport);
    if (next) this.updateAnchor(2, { ...c, ...next });
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const g = this.geo(viewport);
    if (!g) return false;
    const pts = this.curve(g);
    for (let i = 0; i < pts.length - 1; i++) {
      if (distanceToLineSegment(point, pts[i], pts[i + 1]) <= HIT_THRESHOLD) return true;
    }
    return false;
  }

  clone(newId: string): IDrawing {
    return new Arc(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._shapeOptions });
  }
}
