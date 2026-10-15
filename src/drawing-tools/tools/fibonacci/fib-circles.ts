import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { ArcGeometry, Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { FibCirclesPaneView } from './fib-circles-pane-view';

/** Fibonacci circle levels (re-exported for public API compatibility). */
export { FIB_CIRCLE_LEVELS } from './constants';

export interface FibCircleLevel {
  value: number;
  enabled: boolean;
  color: string;
  width: number;
}

export interface FibCirclesOptions extends DrawingOptions {
  levels?: FibCircleLevel[];
  trendLineVisible?: boolean;
  showLabels?: boolean;
  coeffsAsPercents?: boolean;
  backgroundVisible?: boolean;
  backgroundOpacity?: number;
  /** Fib Speed Resistance Arcs only: draw whole circles instead of the half facing the second point. */
  fullCircles?: boolean;
  visibility?: VisibilityMap;
}

const CIRCLE_LEVELS: Array<[number, string]> = [
  [0.236, '#F23645'],
  [0.382, '#FF9800'],
  [0.5, '#089981'],
  [0.618, '#4caf50'],
  [0.786, '#00bcd4'],
  [1, '#787B86'],
  [1.618, '#2962FF'],
  [2.618, '#e91e63'],
  [3.618, '#2962FF'],
  [4.236, '#e91e63'],
  [4.618, '#F23645'],
];

export const defaultFibCircleLevels = (): FibCircleLevel[] =>
  CIRCLE_LEVELS.map(([value, color]) => ({ value, enabled: true, color, width: 1 }));

export const DEFAULT_FIB_CIRCLES_OPTIONS = {
  trendLineVisible: true,
  showLabels: true,
  coeffsAsPercents: false,
  backgroundVisible: true,
  backgroundOpacity: 0.2,
};

export interface FibCircleRing {
  level: FibCircleLevel;
  rx: number;
  ry: number;
  /** Wedge: where the label sits (its right edge is placed just left of this point). */
  label?: Point;
}

export interface FibCirclesLayout {
  a: Point;
  b: Point;
  center: Point;
  /** Enabled levels sorted by value, with the radii of their ellipses. */
  rings: FibCircleRing[];
  /** Arcs: +1 when the second point is below the centre, -1 when above. */
  side?: 1 | -1;
  /** Arcs and wedge: only this part of each circle is drawn, clockwise on screen from `from` to `to`. */
  arc?: { from: number; to: number };
  /** Lines drawn with the trend line style; the circles tool has a single one from `a` to `b`. */
  edges?: Array<[Point, Point]>;
  /** Wedge: the third point projected onto the circle through the second point. */
  wedgeEnd?: Point;
}

const HIT_THRESHOLD = 3;

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + s * dx), p.y - (a.y + s * dy));
}

/**
 * Fib Circles: the two points are opposite corners of a box. The ellipses are centred on the box
 * centre and the level-1 ellipse is inscribed in the box, so each level scales both radii.
 */
export class FibCircles extends Drawing {
  readonly type: string = 'fib-circles';

  protected static readonly REQUIRED_ANCHORS: number = 2;

  protected _fibOptions: FibCirclesOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibCirclesOptions> = {}
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(id, anchors, { lineColor: '#787B86', lineWidth: 1, lineDash: [6, 6], ...style }, base);

    this._fibOptions = {
      ...DEFAULT_FIB_CIRCLES_OPTIONS,
      ...options,
      levels: normaliseLevels(options.levels),
    };
  }

  get fibOptions(): FibCirclesOptions {
    return this._fibOptions;
  }

  setFibOptions(options: Partial<FibCirclesOptions>): void {
    this._fibOptions = { ...this._fibOptions, ...options };
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
  }

  /** The floating toolbar recolours the trend line and every level at once. */
  applyUniformStyle(patch: { color?: string; width?: number; dash?: number[] }): void {
    if (patch.color || patch.width !== undefined) {
      const levels = (this._fibOptions.levels ?? []).map((l) => ({
        ...l,
        ...(patch.color ? { color: patch.color } : {}),
        ...(patch.width !== undefined ? { width: patch.width } : {}),
      }));
      this._fibOptions = { ...this._fibOptions, levels };
    }
    this.updateStyle({
      ...(patch.color ? { lineColor: patch.color } : {}),
      ...(patch.width !== undefined ? { lineWidth: patch.width } : {}),
      ...(patch.dash ? { lineDash: patch.dash } : {}),
    });
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._fibOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  isValid(): boolean {
    return this._anchors.length >= (this.constructor as typeof FibCircles).REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new FibCirclesPaneView(this, 'body'), new FibCirclesPaneView(this, 'handles')];
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const points: ControlPoint[] = [];
    this._anchors.forEach((anchor, index) => {
      const p = this.anchorToPixel(anchor, viewport);
      if (p) points.push({ index, x: p.x, y: p.y, radius: 6 });
    });
    return points;
  }

  layout(viewport: Viewport): FibCirclesLayout | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;

    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const halfW = Math.abs(b.x - a.x) / 2;
    const halfH = Math.abs(b.y - a.y) / 2;
    const rings = (this._fibOptions.levels ?? [])
      .filter((l) => l.enabled)
      .map((level) => ({ level, rx: halfW * level.value, ry: halfH * level.value }))
      .sort((p, q) => p.level.value - q.level.value);
    return { a, b, center, rings };
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const layout = this.layout(viewport);
    if (!layout) return [];
    return layout.rings.map(
      (r): ArcGeometry => ({ type: 'arc', center: layout.center, radius: Math.max(r.rx, r.ry), startAngle: 0, endAngle: Math.PI * 2 })
    );
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.layout(viewport);
    if (!layout) return false;
    if (this._fibOptions.trendLineVisible !== false && distanceToSegment(point, layout.a, layout.b) <= HIT_THRESHOLD) {
      return true;
    }
    return layout.rings.some((r) => this.hitRing(point, layout, r));
  }

  /** Distance to an ellipse is approximated by scaling the point onto the unit circle. */
  protected hitRing(point: Point, layout: FibCirclesLayout, ring: FibCircleRing): boolean {
    const center = layout.center;
    if (ring.rx < 0.5 || ring.ry < 0.5) return Math.hypot(point.x - center.x, point.y - center.y) <= HIT_THRESHOLD;
    const nx = (point.x - center.x) / ring.rx;
    const ny = (point.y - center.y) / ring.ry;
    const d = Math.hypot(nx, ny);
    if (d === 0) return false;
    const ex = center.x + (nx / d) * ring.rx;
    const ey = center.y + (ny / d) * ring.ry;
    return Math.hypot(point.x - ex, point.y - ey) <= HIT_THRESHOLD;
  }

  clone(newId: string): IDrawing {
    return new FibCircles(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }

  static create(
    id: string,
    start: Anchor,
    end: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FibCirclesOptions>
  ): FibCircles {
    return new FibCircles(id, [start, end], style, options);
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._fibOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setFibOptions(data.options);
  }
}

/** Older saves stored plain numbers; they map onto the default colours. */
function normaliseLevels(levels: unknown): FibCircleLevel[] {
  if (!Array.isArray(levels)) return defaultFibCircleLevels();
  return levels.map((l, i) => {
    if (typeof l === 'number') {
      const known = defaultFibCircleLevels().find((d) => d.value === l);
      return known ?? { value: l, enabled: true, color: '#787B86', width: 1 };
    }
    return { ...(l as FibCircleLevel) };
  });
}
