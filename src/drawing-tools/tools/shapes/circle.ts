import { distanceBetweenPoints } from '../../core/geometry';
import type { Geometry, ArcGeometry } from '../../core/geometry';
import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { ShapeBase, type ShapeOptions } from './shape-base';

export type CircleOptions = ShapeOptions;

const HIT_THRESHOLD = 4;

/**
 * Circle - centre plus a point on the circumference. The radius is the pixel distance between them.
 */
export class Circle extends ShapeBase {
  readonly type = 'circle';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<CircleOptions> = {}
  ) {
    super(id, anchors, style, options, { lineColor: '#F19D38', lineWidth: 1, lineDash: [], fillColor: 'rgba(241, 157, 56, 0.2)' });
  }

  /** Kept for callers of the previous API. */
  get circleOptions(): CircleOptions {
    return this._shapeOptions;
  }

  setCircleOptions(options: Partial<CircleOptions>): void {
    this.setShapeOptions(options);
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  private circle(viewport: Viewport): { center: Point; radius: number } | null {
    if (!this.isValid()) return null;
    const center = this.anchorToPixel(this._anchors[0], viewport);
    const edge = this.anchorToPixel(this._anchors[1], viewport);
    if (!center || !edge) return null;
    return { center, radius: distanceBetweenPoints(center, edge) };
  }

  tracePath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean {
    const c = this.circle(viewport);
    if (!c) return false;
    ctx.arc(c.center.x * pr, c.center.y * pr, c.radius * pr, 0, Math.PI * 2);
    return true;
  }

  textCenter(viewport: Viewport): Point | null {
    return this.circle(viewport)?.center ?? null;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const c = this.circle(viewport);
    if (!c) return [];
    const arc: ArcGeometry = { type: 'arc', center: c.center, radius: c.radius, startAngle: 0, endAngle: Math.PI * 2 };
    return [arc];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const c = this.circle(viewport);
    if (!c) return false;
    const d = distanceBetweenPoints(point, c.center);
    if (this._shapeOptions.filled) return d <= c.radius + HIT_THRESHOLD;
    return Math.abs(d - c.radius) <= HIT_THRESHOLD;
  }

  getRadius(viewport: Viewport): number {
    return this.circle(viewport)?.radius ?? 0;
  }

  clone(newId: string): IDrawing {
    return new Circle(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._shapeOptions });
  }

  static create(id: string, center: Anchor, edge: Anchor, style?: Partial<DrawingStyle>, options?: Partial<CircleOptions>): Circle {
    return new Circle(id, [center, edge], style, options);
  }
}
