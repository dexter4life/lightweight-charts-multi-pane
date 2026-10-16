import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { XABCDPattern, type PatternDefaults, type RatioSpec, type XABCDPatternOptions } from './xabcd-pattern';
import { safeRatio } from './pattern-utils';

export type CypherPatternOptions = XABCDPatternOptions;
export type ABCDPatternOptions = XABCDPatternOptions;
export type TrianglePatternOptions = XABCDPatternOptions;
export type ThreeDrivesPatternOptions = XABCDPatternOptions;
export type HeadAndShouldersOptions = XABCDPatternOptions;

type PatternCtor<T extends XABCDPattern> = new (id: string, anchors?: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<XABCDPatternOptions>) => T;

const cloneOf = <T extends XABCDPattern>(self: T, Ctor: PatternCtor<T>, newId: string): IDrawing =>
  new Ctor(newId, [...self.anchors], { ...self.style }, { ...self.xabcdPatternOptions });

/** Y of the line through `a` and `b` at `x`; vertical lines fall back to `a.y`. */
function yAt(a: Point, b: Point, x: number): number {
  return b.x === a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/** Where the infinite line p1-p2 meets the segment s1-s2, or null when it misses the segment. */
function crossSegment(p1: Point, p2: Point, s1: Point, s2: Point): Point | null {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const ex = s2.x - s1.x;
  const ey = s2.y - s1.y;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-9) return null;
  const u = ((s1.x - p1.x) * dy - (s1.y - p1.y) * dx) / denom;
  if (u < 0 || u > 1) return null;
  return { x: s1.x + u * ex, y: s1.y + u * ey };
}

export const CYPHER_DEFAULTS: PatternDefaults = { lineColor: '#2962FF', fillColor: 'rgba(41, 98, 255, 0.15)', filled: true };
export const ABCD_DEFAULTS: PatternDefaults = { lineColor: '#089981', fillColor: 'rgba(8, 153, 129, 0.15)', filled: false };
export const TRIANGLE_DEFAULTS: PatternDefaults = { lineColor: '#673ab7', fillColor: 'rgba(103, 58, 183, 0.15)', filled: true };
export const THREE_DRIVES_DEFAULTS: PatternDefaults = { lineColor: '#673ab7', fillColor: 'rgba(149, 40, 204, 0.5)', filled: false };
export const HEAD_AND_SHOULDERS_DEFAULTS: PatternDefaults = { lineColor: '#089981', fillColor: 'rgba(8, 153, 129, 0.15)', filled: true };

export class CypherPattern extends XABCDPattern {
  override readonly type = 'cypher-pattern';

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<XABCDPatternOptions> = {}) {
    super(id, anchors, style, options, CYPHER_DEFAULTS);
  }

  protected override get guidePairs(): Array<[number, number]> {
    return [[1, 3], [0, 2], [2, 4], [0, 4]];
  }

  protected override get ratioSpecs(): RatioSpec[] {
    return [
      { pair: [1, 3], value: ([x, a, , c]) => safeRatio(c - x, a - x) },
      { pair: [0, 2], value: ([x, a, b]) => safeRatio(a - b, a - x) },
      { pair: [2, 4], value: ([, , b, c, d]) => safeRatio(c - d, c - b) },
      { pair: [0, 4], value: ([x, , , c, d]) => safeRatio(c - d, c - x) },
    ];
  }

  override clone(newId: string): IDrawing {
    return cloneOf(this, CypherPattern, newId);
  }
}

export class ABCDPattern extends XABCDPattern {
  override readonly type = 'abcd-pattern';
  override readonly anchorLabels = ['A', 'B', 'C', 'D'] as const;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<XABCDPatternOptions> = {}) {
    super(id, anchors, style, options, ABCD_DEFAULTS);
  }

  protected override get guidePairs(): Array<[number, number]> {
    return [[0, 2], [1, 3]];
  }

  protected override get fillShapes(): number[][] {
    return [];
  }

  protected override get ratioSpecs(): RatioSpec[] {
    return [
      { pair: [0, 2], value: ([a, b, c]) => safeRatio(b - c, b - a) },
      { pair: [1, 3], value: ([, b, c, d]) => safeRatio(d - c, b - c) },
    ];
  }

  override clone(newId: string): IDrawing {
    return cloneOf(this, ABCDPattern, newId);
  }
}

export class TrianglePattern extends XABCDPattern {
  override readonly type = 'triangle-pattern';
  override readonly anchorLabels = ['A', 'B', 'C', 'D'] as const;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<XABCDPatternOptions> = {}) {
    super(id, anchors, style, options, TRIANGLE_DEFAULTS);
  }

  protected override get ratioSpecs(): RatioSpec[] {
    return [];
  }

  /** The A-C and B-D lines run on to their apex (or the pane's right edge); a vertical edge closes the left side at A. */
  private edges(viewport: Viewport): { a: Point; lowerEnd: Point; upperStart: Point; upperEnd: Point } | null {
    const p = this.getPatternPoints(viewport);
    if (p.length < 4) return null;
    // Converging lines meet at an apex, where both lines and the fill stop.
    let right = viewport.width;
    const slope = (a: Point, b: Point) => (b.x === a.x ? 0 : (b.y - a.y) / (b.x - a.x));
    const s1 = slope(p[0], p[2]);
    const s2 = slope(p[1], p[3]);
    if (s1 !== s2) {
      const apexX = (p[1].y - p[0].y + s1 * p[0].x - s2 * p[1].x) / (s1 - s2);
      if (apexX > p[0].x && apexX < right) right = apexX;
    }
    return {
      a: p[0],
      lowerEnd: { x: right, y: yAt(p[0], p[2], right) },
      upperStart: { x: p[0].x, y: yAt(p[1], p[3], p[0].x) },
      upperEnd: { x: right, y: yAt(p[1], p[3], right) },
    };
  }

  override getGuideLines(viewport: Viewport): Array<[Point, Point]> {
    const e = this.edges(viewport);
    if (!e) return [];
    return [[e.a, e.lowerEnd], [e.upperStart, e.upperEnd], [e.a, e.upperStart]];
  }

  override getFilledPolygons(viewport: Viewport): Point[][] {
    const e = this.edges(viewport);
    return e ? [[e.a, e.lowerEnd, e.upperEnd, e.upperStart]] : [];
  }

  override clone(newId: string): IDrawing {
    return cloneOf(this, TrianglePattern, newId);
  }
}

export class ThreeDrivesPattern extends XABCDPattern {
  override readonly type = 'three-drives-pattern';
  override readonly anchorLabels = ['', '', '', '', '', '', ''] as const;
  protected override readonly ratioDecimals = 2;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<XABCDPatternOptions> = {}) {
    super(id, anchors, style, options, THREE_DRIVES_DEFAULTS);
  }

  protected override get guidePairs(): Array<[number, number]> {
    return [[1, 3], [3, 5]];
  }

  protected override get fillShapes(): number[][] {
    return [];
  }

  protected override get ratioSpecs(): RatioSpec[] {
    return [
      { pair: [1, 3], value: (p) => safeRatio(p[3] - p[2], p[1] - p[2]) },
      { pair: [3, 5], value: (p) => safeRatio(p[5] - p[4], p[3] - p[4]) },
    ];
  }

  override clone(newId: string): IDrawing {
    return cloneOf(this, ThreeDrivesPattern, newId);
  }
}

export class HeadAndShouldersPattern extends XABCDPattern {
  override readonly type = 'head-and-shoulders';
  override readonly anchorLabels = ['', 'Left Shoulder', '', 'Head', '', 'Right Shoulder', ''] as const;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<XABCDPatternOptions> = {}) {
    super(id, anchors, style, options, HEAD_AND_SHOULDERS_DEFAULTS);
  }

  protected override get ratioSpecs(): RatioSpec[] {
    return [];
  }

  /** The neckline joins the two troughs and runs out to where it meets the outer legs. */
  private neckline(viewport: Viewport): { start: Point; end: Point; p: Point[] } | null {
    const p = this.getPatternPoints(viewport);
    if (p.length < 7) return null;
    return {
      p,
      start: crossSegment(p[2], p[4], p[0], p[1]) ?? p[2],
      end: crossSegment(p[2], p[4], p[5], p[6]) ?? p[4],
    };
  }

  override getGuideLines(viewport: Viewport): Array<[Point, Point]> {
    const n = this.neckline(viewport);
    return n ? [[n.start, n.end]] : [];
  }

  override getFilledPolygons(viewport: Viewport): Point[][] {
    const n = this.neckline(viewport);
    if (!n) return [];
    const { p } = n;
    return [[n.start, p[1], p[2]], [p[2], p[3], p[4]], [p[4], p[5], n.end]];
  }

  override clone(newId: string): IDrawing {
    return cloneOf(this, HeadAndShouldersPattern, newId);
  }
}
