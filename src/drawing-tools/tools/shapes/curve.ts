import { distanceToLineSegment } from '../../core/geometry';
import type { Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { ShapeBase, type ShapeOptions } from './shape-base';

export type CurveOptions = ShapeOptions;

const HIT_THRESHOLD = 4;
/** Default sag of the middle point, as a fraction of the chord length. */
const DEFAULT_SAG = 0.15;
const STEP_PX = 5;
const MAX_STEPS = 600;

interface Geo {
  s: Point;
  e: Point;
  m: Point;
  /** Control point of the quadratic Bezier that passes through `m` at t = 0.5. */
  c: Point;
}

/**
 * Curve - a quadratic Bezier through three points: start, end and a middle point that the curve passes
 * through halfway along. Until the middle point is touched it sits at a default offset from the chord.
 * The curve can be extended past either end along the same parabola, and the area between the curve
 * and its chord can be filled.
 */
export class Curve extends ShapeBase {
  readonly type: string = 'curve';

  private _autoMid: boolean;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<CurveOptions> = {}) {
    const auto = anchors.length < 3;
    const padded = auto && anchors.length >= 2 ? [...anchors, { ...anchors[1] }] : anchors;
    super(
      id,
      padded,
      style,
      options,
      { lineColor: '#2962FF', lineWidth: 1, lineDash: [], fillColor: 'rgba(41, 98, 255, 0.2)' },
      { filled: false, extendLeft: false, extendRight: false, leftEnd: 'normal', rightEnd: 'normal' }
    );
    this._autoMid = auto;
  }

  /** Kept for callers of the previous API. */
  get curveOptions(): CurveOptions {
    return this._shapeOptions;
  }

  setCurveOptions(options: Partial<CurveOptions>): void {
    this.setShapeOptions(options);
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  override setAnchors(anchors: Anchor[]): void {
    if (anchors.length === 2) {
      this._autoMid = true;
      super.setAnchors([...anchors, { ...anchors[1] }]);
    } else {
      super.setAnchors(anchors);
    }
  }

  override updateAnchor(index: number, anchor: Anchor): void {
    if (this._autoMid && this.state !== 'editing') this.freezeMid();
    super.updateAnchor(index, anchor);
  }

  /** Pins the middle point where it currently is, so moving an end no longer drags it along. */
  private freezeMid(): void {
    const viewport = this.getViewport();
    if (viewport) this.midPixel(viewport);
    this._autoMid = false;
  }

  private midPixel(viewport: Viewport): Point | null {
    const s = this.anchorToPixel(this._anchors[0], viewport);
    const e = this.anchorToPixel(this._anchors[1], viewport);
    if (!s || !e) return null;
    if (!this._autoMid) return this._anchors[2] ? this.anchorToPixel(this._anchors[2], viewport) : null;
    const raw = { x: (s.x + e.x) / 2 - (e.y - s.y) * DEFAULT_SAG, y: (s.y + e.y) / 2 + (e.x - s.x) * DEFAULT_SAG };
    const anchor = this.pixelToAnchor(raw, viewport);
    if (!anchor) return raw;
    this._anchors[2] = { ...this._anchors[2], ...anchor };
    // The stored middle snaps to a bar, and so does the curve.
    return this.anchorToPixel(this._anchors[2], viewport) ?? raw;
  }

  private geo(viewport: Viewport): Geo | null {
    if (!this.isValid()) return null;
    const s = this.anchorToPixel(this._anchors[0], viewport);
    const e = this.anchorToPixel(this._anchors[1], viewport);
    const m = this.midPixel(viewport);
    if (!s || !e || !m) return null;
    return { s, e, m, c: { x: 2 * m.x - (s.x + e.x) / 2, y: 2 * m.y - (s.y + e.y) / 2 } };
  }

  private at(g: Geo, t: number): Point {
    const u = 1 - t;
    return {
      x: u * u * g.s.x + 2 * u * t * g.c.x + t * t * g.e.x,
      y: u * u * g.s.y + 2 * u * t * g.c.y + t * t * g.e.y,
    };
  }

  private speed(g: Geo, t: number): number {
    const u = 1 - t;
    return Math.hypot(2 * u * (g.c.x - g.s.x) + 2 * t * (g.e.x - g.c.x), 2 * u * (g.c.y - g.s.y) + 2 * t * (g.e.y - g.c.y));
  }

  /** Walks the parabola from `t0` in `dir` until it has left the pane, returning the points visited. */
  private run(g: Geo, t0: number, dir: 1 | -1, viewport: Viewport): Point[] {
    const pad = 40;
    const out: Point[] = [];
    let t = t0;
    for (let i = 0; i < MAX_STEPS; i++) {
      t += (dir * STEP_PX) / Math.max(this.speed(g, t), 1);
      const p = this.at(g, t);
      out.push(p);
      if (p.x < -pad || p.x > viewport.width + pad || p.y < -pad || p.y > viewport.height + pad) break;
    }
    return out;
  }

  /** The stroked outline: the curve between the ends plus any extensions, in CSS pixels. */
  private outline(viewport: Viewport): Point[] {
    const g = this.geo(viewport);
    if (!g) return [];
    const len = Math.hypot(g.e.x - g.s.x, g.e.y - g.s.y);
    const n = Math.max(24, Math.ceil(len / STEP_PX));
    const body: Point[] = [];
    for (let i = 0; i <= n; i++) body.push(this.at(g, i / n));
    const o = this._shapeOptions;
    const left = o.extendLeft ? this.run(g, 0, -1, viewport).reverse() : [];
    const right = o.extendRight ? this.run(g, 1, 1, viewport) : [];
    return [...left, ...body, ...right];
  }

  tracePath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean {
    const pts = this.outline(viewport);
    if (pts.length < 2) return false;
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * pr, p.y * pr) : ctx.lineTo(p.x * pr, p.y * pr)));
    return true;
  }

  /** The background is the area between the curve and the straight line joining its ends. */
  override traceFillPath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean {
    const g = this.geo(viewport);
    if (!g) return false;
    const len = Math.hypot(g.e.x - g.s.x, g.e.y - g.s.y);
    const n = Math.max(24, Math.ceil(len / STEP_PX));
    for (let i = 0; i <= n; i++) {
      const p = this.at(g, i / n);
      if (i === 0) ctx.moveTo(p.x * pr, p.y * pr);
      else ctx.lineTo(p.x * pr, p.y * pr);
    }
    ctx.closePath();
    return true;
  }

  override drawOverlay(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): void {
    const o = this._shapeOptions;
    if (o.leftEnd !== 'arrow' && o.rightEnd !== 'arrow') return;
    const g = this.geo(viewport);
    if (!g) return;
    if (o.leftEnd === 'arrow') this.arrowCap(ctx, g.s, this.at(g, 0.02), pr);
    if (o.rightEnd === 'arrow') this.arrowCap(ctx, g.e, this.at(g, 0.98), pr);
  }

  private arrowCap(ctx: CanvasRenderingContext2D, tip: Point, toward: Point, pr: number): void {
    const size = 7 * Math.max(1, this._style.lineWidth);
    const dx = toward.x - tip.x;
    const dy = toward.y - tip.y;
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
    const pts = this.outline(viewport);
    return pts.length < 2 ? [] : [{ type: 'polygon', points: pts, closed: false }];
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const placed = this._placedCount ?? 3;
    const g = this.geo(viewport);
    if (!g) return [];
    const spots: Array<[number, Point]> = [[0, g.s]];
    if (placed >= 2) spots.push([1, g.e], [2, g.m]);
    return spots.map(([index, p]) => ({ index, x: p.x, y: p.y, radius: 6 }));
  }

  override grabControlPoint(): void {
    if (this._autoMid) this.freezeMid();
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const pts = this.outline(viewport);
    for (let i = 0; i < pts.length - 1; i++) {
      if (distanceToLineSegment(point, pts[i], pts[i + 1]) <= HIT_THRESHOLD) return true;
    }
    return false;
  }

  clone(newId: string): IDrawing {
    const copy = new Curve(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._shapeOptions });
    copy._autoMid = this._autoMid;
    return copy;
  }

  static create(id: string, points: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<CurveOptions>): Curve {
    return new Curve(id, points, style, options);
  }
}
