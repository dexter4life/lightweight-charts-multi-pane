import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import {
  DEFAULT_FIB_CIRCLES_OPTIONS,
  FibCircles,
  type FibCircleRing,
  type FibCirclesLayout,
  type FibCirclesOptions,
} from './fib-circles';

/** Fibonacci arc levels (re-exported for public API compatibility). */
export { FIB_ARC_LEVELS } from './constants';

export type FibArcsOptions = FibCirclesOptions;

export const DEFAULT_FIB_ARCS_OPTIONS = {
  ...DEFAULT_FIB_CIRCLES_OPTIONS,
  fullCircles: false,
};

const HIT_THRESHOLD = 3;

/**
 * Fib Speed Resistance Arcs: circles centred on the first point whose radii are the distance to
 * the second point scaled by each level. Unless `fullCircles` is set only the half on the side of
 * the second point is drawn, cut by the horizontal line through the centre.
 */
export class FibArcs extends FibCircles {
  override readonly type: string = 'fib-arcs';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibArcsOptions> = {}
  ) {
    super(id, anchors, style, { ...DEFAULT_FIB_ARCS_OPTIONS, ...options });
  }

  override layout(viewport: Viewport): FibCirclesLayout | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;

    const radius = Math.hypot(b.x - a.x, b.y - a.y);
    const rings = (this._fibOptions.levels ?? [])
      .filter((l) => l.enabled)
      .map((level) => ({ level, rx: radius * level.value, ry: radius * level.value }))
      .sort((p, q) => p.level.value - q.level.value);
    const side = b.y >= a.y ? 1 : -1;
    const from = side === -1 ? Math.PI : 0;
    return { a, b, center: a, rings, side, arc: this._fibOptions.fullCircles ? undefined : { from, to: from + Math.PI } };
  }

  protected override hitRing(point: Point, layout: FibCirclesLayout, ring: FibCircleRing): boolean {
    const center = layout.center;
    const d = Math.hypot(point.x - center.x, point.y - center.y);
    if (Math.abs(d - ring.rx) > HIT_THRESHOLD) return false;
    if (!layout.arc) return true;
    return layout.side === -1 ? point.y <= center.y + HIT_THRESHOLD : point.y >= center.y - HIT_THRESHOLD;
  }

  override clone(newId: string): IDrawing {
    return new FibArcs(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }

  static override create(
    id: string,
    start: Anchor,
    end: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FibArcsOptions>
  ): FibArcs {
    return new FibArcs(id, [start, end], style, options);
  }
}
