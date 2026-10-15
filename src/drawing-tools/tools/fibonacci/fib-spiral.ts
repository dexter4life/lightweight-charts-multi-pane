import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { GOLDEN_RATIO } from './constants';
import { FibSpiralPaneView } from './fib-spiral-pane-view';

/** Golden ratio for spiral (re-exported for public API compatibility). */
export { GOLDEN_RATIO } from './constants';

export interface FibSpiralOptions extends DrawingOptions {
  counterclockwise?: boolean;
  visibility?: VisibilityMap;
}

export const DEFAULT_FIB_SPIRAL_OPTIONS = { counterclockwise: false };

export interface FibSpiralLayout {
  center: Point;
  b: Point;
  /** Far end of the ray that runs from the centre through the second point. */
  rayEnd: Point;
  spiral: Point[];
}

const HIT_THRESHOLD = 3;
const STEP = Math.PI / 90;
/** The curve starts about 1.6 turns inside the second point and grows until it leaves any screen. */
const TURNS_IN = 3.2 * Math.PI;
const MAX_RADIUS = 6000;
const QUARTER_GROWTH = Math.log(GOLDEN_RATIO) / (Math.PI / 2);

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + s * dx), p.y - (a.y + s * dy));
}

/**
 * Fib Spiral: a golden logarithmic spiral centred on the first point that passes through the second.
 * It winds clockwise on screen unless `counterclockwise` is set.
 */
export class FibSpiral extends Drawing {
  readonly type = 'fib-spiral';

  protected static readonly REQUIRED_ANCHORS = 2;

  private _fibOptions: FibSpiralOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibSpiralOptions> = {}
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(id, anchors, { lineColor: '#00bcd4', lineWidth: 1, lineDash: [], ...style }, base);
    this._fibOptions = { ...this._options, ...DEFAULT_FIB_SPIRAL_OPTIONS, ...options };
  }

  get fibOptions(): FibSpiralOptions {
    return this._fibOptions;
  }

  setFibOptions(options: Partial<FibSpiralOptions>): void {
    this._fibOptions = { ...this._fibOptions, ...options };
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
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
    return this._anchors.length >= FibSpiral.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new FibSpiralPaneView(this, 'body'), new FibSpiralPaneView(this, 'handles')];
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const points: ControlPoint[] = [];
    this._anchors.forEach((anchor, index) => {
      const p = this.anchorToPixel(anchor, viewport);
      if (p) points.push({ index, x: p.x, y: p.y, radius: 6 });
    });
    return points;
  }

  layout(viewport: Viewport): FibSpiralLayout | null {
    if (!this.isValid()) return null;
    const center = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!center || !b) return null;
    const radius = Math.hypot(b.x - center.x, b.y - center.y);
    if (radius < 1) return { center, b, rayEnd: b, spiral: [] };

    const base = Math.atan2(b.y - center.y, b.x - center.x);
    const dir = this._fibOptions.counterclockwise ? -1 : 1;
    const turnsOut = Math.log(MAX_RADIUS / radius) / QUARTER_GROWTH;
    const spiral: Point[] = [];
    for (let t = -TURNS_IN; t <= Math.max(turnsOut, 0); t += STEP) {
      const r = radius * Math.exp(QUARTER_GROWTH * t);
      const angle = base + dir * t;
      spiral.push({ x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) });
    }
    const k = MAX_RADIUS / radius;
    return { center, b, rayEnd: { x: center.x + (b.x - center.x) * k, y: center.y + (b.y - center.y) * k }, spiral };
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.layout(viewport);
    if (!layout) return false;
    if (distanceToSegment(point, layout.center, layout.rayEnd) <= HIT_THRESHOLD) return true;
    const s = layout.spiral;
    for (let i = 0; i < s.length - 1; i++) {
      if (distanceToSegment(point, s[i], s[i + 1]) <= HIT_THRESHOLD) return true;
    }
    return false;
  }

  clone(newId: string): IDrawing {
    return new FibSpiral(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }

  static create(
    id: string,
    center: Anchor,
    through: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FibSpiralOptions>
  ): FibSpiral {
    return new FibSpiral(id, [center, through], style, options);
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._fibOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setFibOptions(data.options);
  }
}
