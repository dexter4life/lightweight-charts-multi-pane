import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import {
  FibCircles,
  type FibCircleLevel,
  type FibCircleRing,
  type FibCirclesLayout,
  type FibCirclesOptions,
} from './fib-circles';

/** Fibonacci wedge levels (re-exported for public API compatibility). */
export { FIB_WEDGE_LEVELS } from './constants';

export type FibWedgeOptions = FibCirclesOptions;

const WEDGE_LEVELS: Array<[number, string, boolean]> = [
  [0.236, '#F23645', true],
  [0.382, '#FF9800', true],
  [0.5, '#4caf50', true],
  [0.618, '#089981', true],
  [0.786, '#00bcd4', true],
  [1, '#787B86', true],
  [1.618, '#2962FF', false],
  [2.618, '#F23645', false],
  [3.618, '#673ab7', false],
  [4.236, '#e91e63', false],
  [4.618, '#e91e63', false],
];

export const defaultFibWedgeLevels = (): FibCircleLevel[] =>
  WEDGE_LEVELS.map(([value, color, enabled]) => ({ value, enabled, color, width: 1 }));

export const DEFAULT_FIB_WEDGE_OPTIONS = {
  trendLineVisible: true,
  showLabels: true,
  backgroundVisible: true,
  backgroundOpacity: 0.2,
};

const HIT_THRESHOLD = 3;
const TWO_PI = Math.PI * 2;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + s * dx), p.y - (a.y + s * dy));
}

/**
 * Fib Wedge: circles centred on the first point whose radius is the distance to the second point
 * scaled by each level. The third point only sets the direction of the other side of the wedge;
 * it is projected onto the circle through the second point, and each circle is cut to the sector
 * between the two sides.
 */
export class FibWedge extends FibCircles {
  override readonly type: string = 'fib-wedge';

  protected static override readonly REQUIRED_ANCHORS: number = 3;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibWedgeOptions> = {}
  ) {
    super(
      id,
      anchors,
      { lineColor: '#808080', lineWidth: 1, lineDash: [], ...style },
      { ...DEFAULT_FIB_WEDGE_OPTIONS, ...options, levels: options.levels ?? defaultFibWedgeLevels() }
    );
  }

  override layout(viewport: Viewport): FibCirclesLayout | null {
    if (!this.isValid()) return null;
    const c = this.anchorToPixel(this._anchors[0], viewport);
    const p1 = this.anchorToPixel(this._anchors[1], viewport);
    const p2 = this.anchorToPixel(this._anchors[2], viewport);
    if (!c || !p1 || !p2) return null;

    const radius = Math.hypot(p1.x - c.x, p1.y - c.y);
    const a1 = Math.atan2(p1.y - c.y, p1.x - c.x);
    const a2 = Math.atan2(p2.y - c.y, p2.x - c.x);
    const delta = ((((a2 - a1 + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
    const from = delta >= 0 ? a1 : a1 + delta;
    const sweep = Math.abs(delta);
    const at = (angle: number, r: number): Point => ({ x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) });
    const end = at(a1 + delta, radius);
    const mid = from + sweep / 2;

    const rings: FibCircleRing[] = (this._fibOptions.levels ?? [])
      .filter((l) => l.enabled)
      .map((level) => ({ level, rx: radius * level.value, ry: radius * level.value, label: at(mid, radius * level.value) }))
      .sort((p, q) => p.level.value - q.level.value);
    return { a: c, b: p1, center: c, rings, arc: { from, to: from + sweep }, edges: [[c, p1], [c, end]], wedgeEnd: end };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const layout = this.layout(viewport);
    const points: ControlPoint[] = [];
    this._anchors.forEach((anchor, index) => {
      const p = index === 2 && layout?.wedgeEnd ? layout.wedgeEnd : this.anchorToPixel(anchor, viewport);
      if (p) points.push({ index, x: p.x, y: p.y, radius: 6 });
    });
    return points;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.layout(viewport);
    if (!layout) return false;
    if (this._fibOptions.trendLineVisible !== false && layout.edges?.some(([p, q]) => distanceToSegment(point, p, q) <= HIT_THRESHOLD)) {
      return true;
    }
    return layout.rings.some((r) => this.hitRing(point, layout, r));
  }

  protected override hitRing(point: Point, layout: FibCirclesLayout, ring: FibCircleRing): boolean {
    const { center, arc } = layout;
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    if (Math.abs(Math.hypot(dx, dy) - ring.rx) > HIT_THRESHOLD || !arc) return false;
    const angle = (((Math.atan2(dy, dx) - arc.from) % TWO_PI) + TWO_PI) % TWO_PI;
    return angle <= arc.to - arc.from;
  }

  override clone(newId: string): IDrawing {
    return new FibWedge(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }
}
