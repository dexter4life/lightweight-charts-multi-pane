import type { Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { ShapeBase, type ShapeOptions } from './shape-base';

export type EllipseOptions = ShapeOptions;

const HIT_THRESHOLD = 4;

interface Grab {
  y: number;
  ry: number | null;
  side: number;
}

/**
 * Ellipse - the first two points are the ends of the horizontal axis; the third sets the vertical radius
 * (its distance from the axis). The centre is the midpoint of the first two.
 */
export class Ellipse extends ShapeBase {
  readonly type = 'ellipse';

  private _grab: Grab | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<EllipseOptions> = {}
  ) {
    super(id, anchors, style, options, { lineColor: '#DF484C', lineWidth: 1, lineDash: [], fillColor: 'rgba(223, 72, 76, 0.2)' });
  }

  /** Kept for callers of the previous API. */
  get ellipseOptions(): EllipseOptions {
    return this._shapeOptions;
  }

  setEllipseOptions(options: Partial<EllipseOptions>): void {
    this.setShapeOptions(options);
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  private ellipse(viewport: Viewport): { center: Point; rx: number; ry: number; a: Point; b: Point } | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const c = this._anchors[2] ? this.anchorToPixel(this._anchors[2], viewport) : null;
    const rx = Math.hypot(b.x - a.x, b.y - a.y) / 2;
    return { center, rx, ry: c ? Math.abs(c.y - center.y) : rx, a, b };
  }

  tracePath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean {
    const e = this.ellipse(viewport);
    if (!e || e.rx <= 0 || e.ry <= 0) return false;
    ctx.ellipse(e.center.x * pr, e.center.y * pr, e.rx * pr, e.ry * pr, 0, 0, Math.PI * 2);
    return true;
  }

  textCenter(viewport: Viewport): Point | null {
    return this.ellipse(viewport)?.center ?? null;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const e = this.ellipse(viewport);
    if (!e) return [];
    const points: Point[] = [];
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      points.push({ x: e.center.x + e.rx * Math.cos(t), y: e.center.y + e.ry * Math.sin(t) });
    }
    return [{ type: 'polygon', points, closed: true }];
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const e = this.ellipse(viewport);
    if (!e) return [];
    const placed = this._placedCount ?? this._anchors.length;
    const spots: Array<[number, number, number]> = [
      [0, e.a.x, e.a.y],
      [1, e.b.x, e.b.y],
    ];
    if (placed >= 3 || this._anchors.length >= 3) {
      spots.push([2, e.center.x, e.center.y + e.ry], [2, e.center.x, e.center.y - e.ry]);
    }
    return spots.map(([index, x, y]) => ({ index, x, y, radius: 6 }));
  }

  override grabControlPoint(index: number, point: Point): void {
    this._grab = index >= 2 ? { y: point.y, ry: null, side: 0 } : null;
  }

  override dragControlPoint(index: number, point: Point, anchor: Anchor | null, viewport: Viewport): void {
    if (!anchor) return;
    if (index < 2) {
      this.updateAnchor(index, anchor);
      return;
    }
    const e = this.ellipse(viewport);
    const c = this._anchors[2];
    if (!e || !c) return;
    // Work from the grab so a plain click leaves the radius untouched; both vertical handles resize it.
    if (!this._grab) this._grab = { y: point.y, ry: null, side: 0 };
    const grab = this._grab;
    if (grab.ry === null) {
      grab.ry = e.ry;
      grab.side = grab.y >= e.center.y ? 1 : -1;
    }
    const delta = point.y - grab.y;
    if (Math.abs(delta) < 0.01) return;
    const ry = Math.abs(grab.ry + grab.side * delta);
    const price = viewport.priceScale.coordinateToPrice(e.center.y + ry);
    if (price === null) return;
    this.updateAnchor(2, { ...c, price });
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const e = this.ellipse(viewport);
    if (!e || e.rx <= 0 || e.ry <= 0) return false;
    const dx = point.x - e.center.x;
    const dy = point.y - e.center.y;
    // Normalised radial distance, scaled back to pixels along the ray for a pixel-accurate tolerance.
    const k = Math.hypot(dx / e.rx, dy / e.ry);
    if (k === 0) return false;
    const dist = Math.hypot(dx, dy);
    const edge = dist / k;
    return Math.abs(dist - edge) <= HIT_THRESHOLD;
  }

  clone(newId: string): IDrawing {
    return new Ellipse(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._shapeOptions });
  }
}
