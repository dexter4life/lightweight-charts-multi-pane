import { distanceToLineSegment } from '../../core/geometry';
import type { Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { ShapeBase, type ShapeOptions } from './shape-base';

export type DoubleCurveOptions = ShapeOptions;

const HIT_THRESHOLD = 4;
const STEP_PX = 5;
const MAX_STEPS = 800;
/** The two inner handles sit on the curve at these parameters. */
const T_B = 0.27;
const T_C = 1 - T_B;
/** Default placement of the inner handles, measured from the pane origin. */
const DEFAULT_SKEW = 0.15;
const DEFAULT_SHIFT = { x: -6, y: -3 };
/** Shape of the straight-ish continuation drawn past either end. */
const EXT_SPEED = 0.3157;
const EXT_BEND = 0.2832;

interface Geo {
  a: Point;
  d: Point;
  b: Point;
  c: Point;
  /** Bezier control points of the cubic from `a` to `d` that passes through `b` at T_B and `c` at T_C. */
  p1: Point;
  p2: Point;
}

/**
 * Double Curve - an S shaped cubic from a start to an end point, with two more handles that lie on the curve
 * a little way in from each end. Until an inner handle is touched they follow the ends around.
 * Extending an end continues the curve past it; the background fills the area between the curve and its chord.
 */
export class DoubleCurve extends ShapeBase {
  readonly type: string = 'double-curve';

  private _autoInner: boolean;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<DoubleCurveOptions> = {}
  ) {
    const auto = anchors.length < 4;
    const padded = auto && anchors.length >= 2 ? [...anchors.slice(0, 2), { ...anchors[1] }, { ...anchors[1] }] : anchors;
    super(
      id,
      padded,
      style,
      options,
      { lineColor: '#613CB1', lineWidth: 1, lineDash: [], fillColor: 'rgba(97, 60, 177, 0.2)' },
      { filled: false, extendLeft: false, extendRight: false, leftEnd: 'normal', rightEnd: 'normal' }
    );
    this._autoInner = auto;
  }

  /** Kept for callers of the previous API. */
  get doubleCurveOptions(): DoubleCurveOptions {
    return this._shapeOptions;
  }

  setDoubleCurveOptions(options: Partial<DoubleCurveOptions>): void {
    this.setShapeOptions(options);
  }

  isValid(): boolean {
    return this._anchors.length >= 2;
  }

  override setAnchors(anchors: Anchor[]): void {
    if (anchors.length === 2) {
      this._autoInner = true;
      super.setAnchors([...anchors, { ...anchors[1] }, { ...anchors[1] }]);
    } else {
      super.setAnchors(anchors);
    }
  }

  override updateAnchor(index: number, anchor: Anchor): void {
    if (this._autoInner && this.state !== 'editing') this.freezeInner();
    super.updateAnchor(index, anchor);
  }

  /** Pins the inner handles where they are, so moving an end no longer drags them along. */
  private freezeInner(): void {
    const viewport = this.getViewport();
    if (viewport) this.innerPixels(viewport);
    this._autoInner = false;
  }

  private innerPixels(viewport: Viewport): { b: Point; c: Point } | null {
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const d = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !d) return null;
    if (!this._autoInner) {
      const b = this._anchors[2] && this.anchorToPixel(this._anchors[2], viewport);
      const c = this._anchors[3] && this.anchorToPixel(this._anchors[3], viewport);
      return b && c ? { b, c } : null;
    }
    const rawB = {
      x: (a.x + d.x) / 3 - (d.y - a.y) * DEFAULT_SKEW + DEFAULT_SHIFT.x,
      y: (a.y + d.y) / 3 + (d.x - a.x) * DEFAULT_SKEW + DEFAULT_SHIFT.y,
    };
    const bAnchor = this.pixelToAnchor(rawB, viewport);
    if (!bAnchor) return { b: rawB, c: { x: a.x + d.x - rawB.x, y: a.y + d.y - rawB.y } };
    this._anchors[2] = { ...this._anchors[2], ...bAnchor };
    // The inner handles snap to bars like any other point, and the second mirrors the first about the chord centre.
    const b = this.anchorToPixel(this._anchors[2], viewport) ?? rawB;
    const rawC = { x: a.x + d.x - b.x, y: a.y + d.y - b.y };
    const cAnchor = this.pixelToAnchor(rawC, viewport);
    if (!cAnchor) return { b, c: rawC };
    this._anchors[3] = { ...this._anchors[3], ...cAnchor };
    return { b, c: this.anchorToPixel(this._anchors[3], viewport) ?? rawC };
  }

  private geo(viewport: Viewport): Geo | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const d = this.anchorToPixel(this._anchors[1], viewport);
    const inner = this.innerPixels(viewport);
    if (!a || !d || !inner) return null;
    const { b, c } = inner;
    const m11 = 3 * (1 - T_B) ** 2 * T_B;
    const m12 = 3 * (1 - T_B) * T_B ** 2;
    const m21 = 3 * (1 - T_C) ** 2 * T_C;
    const m22 = 3 * (1 - T_C) * T_C ** 2;
    const det = m11 * m22 - m12 * m21;
    const solve = (ra: number, rd: number, rb: number, rc: number): [number, number] => {
      const r1 = rb - ((1 - T_B) ** 3 * ra + T_B ** 3 * rd);
      const r2 = rc - ((1 - T_C) ** 3 * ra + T_C ** 3 * rd);
      return [(r1 * m22 - m12 * r2) / det, (m11 * r2 - m21 * r1) / det];
    };
    const [p1x, p2x] = solve(a.x, d.x, b.x, c.x);
    const [p1y, p2y] = solve(a.y, d.y, b.y, c.y);
    return { a, d, b, c, p1: { x: p1x, y: p1y }, p2: { x: p2x, y: p2y } };
  }

  private at(g: Geo, t: number): Point {
    const u = 1 - t;
    const k0 = u * u * u;
    const k1 = 3 * u * u * t;
    const k2 = 3 * u * t * t;
    const k3 = t * t * t;
    return {
      x: k0 * g.a.x + k1 * g.p1.x + k2 * g.p2.x + k3 * g.d.x,
      y: k0 * g.a.y + k1 * g.p1.y + k2 * g.p2.y + k3 * g.d.y,
    };
  }

  /** Points walked from an end along a parabola that starts on the end's tangent and bends toward `bend`. */
  private extension(origin: Point, tangent: Point, bend: Point, viewport: Viewport): Point[] {
    const tl = Math.hypot(tangent.x, tangent.y);
    const bl = Math.hypot(bend.x, bend.y);
    if (tl < 1e-6) return [];
    const ux = tangent.x / tl;
    const uy = tangent.y / tl;
    const wx = bl > 1e-6 ? bend.x / bl : ux;
    const wy = bl > 1e-6 ? bend.y / bl : uy;
    const al = EXT_SPEED * tl;
    const be = EXT_BEND * bl;
    const pad = 40;
    const out: Point[] = [];
    let s = 0;
    for (let i = 0; i < MAX_STEPS; i++) {
      const vx = ux * al + 2 * wx * be * s;
      const vy = uy * al + 2 * wy * be * s;
      s += STEP_PX / Math.max(Math.hypot(vx, vy), 1e-3);
      const p = { x: origin.x + ux * al * s + wx * be * s * s, y: origin.y + uy * al * s + wy * be * s * s };
      out.push(p);
      if (p.x < -pad || p.x > viewport.width + pad || p.y < -pad || p.y > viewport.height + pad) break;
    }
    return out;
  }

  private body(g: Geo): Point[] {
    const reach = Math.hypot(g.p1.x - g.a.x, g.p1.y - g.a.y) + Math.hypot(g.p2.x - g.p1.x, g.p2.y - g.p1.y) + Math.hypot(g.d.x - g.p2.x, g.d.y - g.p2.y);
    const n = Math.min(400, Math.max(48, Math.ceil(reach / STEP_PX)));
    const out: Point[] = [];
    for (let i = 0; i <= n; i++) out.push(this.at(g, i / n));
    return out;
  }

  /** The stroked outline: the curve between the ends plus any extensions, in CSS pixels. */
  private outline(viewport: Viewport): Point[] {
    const g = this.geo(viewport);
    if (!g) return [];
    const o = this._shapeOptions;
    const left = o.extendLeft
      ? this.extension(
          g.a,
          { x: g.a.x - g.p1.x, y: g.a.y - g.p1.y },
          { x: g.a.x - 2 * g.p1.x + g.p2.x, y: g.a.y - 2 * g.p1.y + g.p2.y },
          viewport
        ).reverse()
      : [];
    const right = o.extendRight
      ? this.extension(
          g.d,
          { x: g.d.x - g.p2.x, y: g.d.y - g.p2.y },
          { x: g.d.x - 2 * g.p2.x + g.p1.x, y: g.d.y - 2 * g.p2.y + g.p1.y },
          viewport
        )
      : [];
    return [...left, ...this.body(g), ...right];
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
    this.body(g).forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * pr, p.y * pr) : ctx.lineTo(p.x * pr, p.y * pr)));
    ctx.closePath();
    return true;
  }

  override drawOverlay(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): void {
    const o = this._shapeOptions;
    if (o.leftEnd !== 'arrow' && o.rightEnd !== 'arrow') return;
    const g = this.geo(viewport);
    if (!g) return;
    if (o.leftEnd === 'arrow') this.arrowCap(ctx, g.a, this.at(g, 0.02), pr);
    if (o.rightEnd === 'arrow') this.arrowCap(ctx, g.d, this.at(g, 0.98), pr);
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
    const placed = this._placedCount ?? 4;
    const g = this.geo(viewport);
    if (!g) return [];
    const spots: Array<[number, Point]> = [[0, g.a]];
    if (placed >= 2) spots.push([1, g.d], [2, g.b], [3, g.c]);
    return spots.map(([index, p]) => ({ index, x: p.x, y: p.y, radius: 6 }));
  }

  override grabControlPoint(): void {
    if (this._autoInner) this.freezeInner();
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
    const copy = new DoubleCurve(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._shapeOptions });
    copy._autoInner = this._autoInner;
    return copy;
  }

  static create(id: string, points: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<DoubleCurveOptions>): DoubleCurve {
    return new DoubleCurve(id, points, style, options);
  }
}
