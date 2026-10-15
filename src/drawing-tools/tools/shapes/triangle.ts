import { distanceToLineSegment } from '../../core/geometry';
import type { Geometry, PolygonGeometry } from '../../core/geometry';
import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { ShapeBase, type ShapeOptions } from './shape-base';

export type TriangleOptions = ShapeOptions;

const HIT_THRESHOLD = 4;

/**
 * Triangle - three vertices. Only the border is hittable; the interior is not.
 */
export class Triangle extends ShapeBase {
  readonly type = 'triangle';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TriangleOptions> = {}
  ) {
    super(id, anchors, style, options, { lineColor: '#459782', lineWidth: 1, lineDash: [], fillColor: 'rgba(69, 151, 130, 0.2)' });
  }

  /** Kept for callers of the previous API. */
  get triangleOptions(): TriangleOptions {
    return this._shapeOptions;
  }

  setTriangleOptions(options: Partial<TriangleOptions>): void {
    this.setShapeOptions(options);
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  private vertices(viewport: Viewport): Point[] {
    const pts: Point[] = [];
    for (const a of this._anchors.slice(0, 3)) {
      const p = this.anchorToPixel(a, viewport);
      if (p) pts.push(p);
    }
    return pts;
  }

  tracePath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean {
    const v = this.vertices(viewport);
    if (v.length < 2) return false;
    ctx.moveTo(v[0].x * pr, v[0].y * pr);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x * pr, v[i].y * pr);
    if (v.length >= 3) ctx.closePath();
    return true;
  }

  textCenter(): Point | null {
    return null;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const v = this.vertices(viewport);
    if (v.length < 2) return [];
    const polygon: PolygonGeometry = { type: 'polygon', points: v, closed: v.length >= 3 };
    return [polygon];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const v = this.vertices(viewport);
    if (v.length < 2) return false;
    const n = v.length >= 3 ? v.length : 1;
    for (let i = 0; i < n; i++) {
      if (distanceToLineSegment(point, v[i], v[(i + 1) % v.length]) <= HIT_THRESHOLD) return true;
    }
    return false;
  }

  clone(newId: string): IDrawing {
    return new Triangle(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._shapeOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<TriangleOptions>): Triangle {
    return new Triangle(id, anchors, style, options);
  }
}
