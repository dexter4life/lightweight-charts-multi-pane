import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Geometry, LineGeometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { FibSpeedFanPaneView } from './fib-speed-fan-pane-view';

/** Fibonacci speed fan ratios (re-exported for public API compatibility). */
export { FIB_SPEED_RATIOS } from './constants';

export interface FibFanLevel {
  value: number;
  enabled: boolean;
  color: string;
}

export interface FibFanGrid {
  visible: boolean;
  color: string;
  width: number;
  dash?: number[];
}

export interface FibSpeedFanOptions extends DrawingOptions {
  /** Levels that cut the right edge of the box. */
  hlevels?: FibFanLevel[];
  /** Levels that cut the top edge of the box. */
  vlevels?: FibFanLevel[];
  showLeftLabels?: boolean;
  showRightLabels?: boolean;
  showTopLabels?: boolean;
  showBottomLabels?: boolean;
  fillBackground?: boolean;
  /** Fill opacity, 0..1. */
  backgroundOpacity?: number;
  grid?: FibFanGrid;
  reverse?: boolean;
  visibility?: VisibilityMap;
}

const LEVEL_DEFAULTS: Array<[number, string]> = [
  [0, '#787B86'],
  [0.25, '#FF9800'],
  [0.382, '#00bcd4'],
  [0.5, '#4caf50'],
  [0.618, '#089981'],
  [0.75, '#2962FF'],
  [1, '#787B86'],
];

export const defaultFibFanLevels = (): FibFanLevel[] =>
  LEVEL_DEFAULTS.map(([value, color]) => ({ value, enabled: true, color }));

export const DEFAULT_FIB_FAN_OPTIONS = {
  showLeftLabels: true,
  showRightLabels: true,
  showTopLabels: true,
  showBottomLabels: true,
  fillBackground: true,
  backgroundOpacity: 0.2,
  reverse: false,
  grid: { visible: true, color: 'rgba(21, 56, 153, 0.8)', width: 1, dash: [] as number[] },
};

const HIT_THRESHOLD = 3;

export interface FibFanRay {
  level: FibFanLevel;
  /** Direction from the first point. */
  dx: number;
  dy: number;
  /** Angle from the vertical edge towards the horizontal one. */
  angle: number;
}

export interface FibFanBox {
  a: Point;
  b: Point;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function distanceToRay(p: Point, o: Point, dx: number, dy: number): number {
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - o.x, p.y - o.y);
  const s = Math.max(0, ((p.x - o.x) * dx + (p.y - o.y) * dy) / len2);
  return Math.hypot(p.x - (o.x + s * dx), p.y - (o.y + s * dy));
}

/**
 * Fib Speed Resistance Fan: a box from the first point to the second. Rays leave the first
 * point through the box's top and right edges at each level; the grid and labels sit on the box.
 */
export class FibSpeedFan extends Drawing {
  readonly type = 'fib-speed-fan';

  protected static readonly REQUIRED_ANCHORS = 2;

  private _fibOptions: FibSpeedFanOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibSpeedFanOptions> = {}
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(id, anchors, { lineColor: '#787B86', lineWidth: 1, lineDash: [], ...style }, base);

    const defined = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
    this._fibOptions = {
      ...DEFAULT_FIB_FAN_OPTIONS,
      ...defined,
      grid: { ...DEFAULT_FIB_FAN_OPTIONS.grid, ...options.grid },
      hlevels: (options.hlevels ?? defaultFibFanLevels()).map((l) => ({ ...l })),
      vlevels: (options.vlevels ?? defaultFibFanLevels()).map((l) => ({ ...l })),
    };
  }

  get fibOptions(): FibSpeedFanOptions {
    return this._fibOptions;
  }

  setFibOptions(options: Partial<FibSpeedFanOptions>): void {
    this._fibOptions = { ...this._fibOptions, ...options };
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
  }

  /** The floating toolbar recolours and restyles every line at once. */
  applyUniformStyle(patch: { color?: string; width?: number; dash?: number[] }): void {
    const paint = (list?: FibFanLevel[]) => list?.map((l) => ({ ...l, ...(patch.color !== undefined ? { color: patch.color } : {}) }));
    this._fibOptions = { ...this._fibOptions, hlevels: paint(this._fibOptions.hlevels), vlevels: paint(this._fibOptions.vlevels) };
    this.updateStyle({
      ...(patch.color !== undefined ? { lineColor: patch.color } : {}),
      ...(patch.width !== undefined ? { lineWidth: patch.width } : {}),
      ...(patch.dash !== undefined ? { lineDash: patch.dash } : {}),
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
    return this._anchors.length >= FibSpeedFan.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new FibSpeedFanPaneView(this), new FibSpeedFanPaneView(this, 'handles')];
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const points: ControlPoint[] = [];
    this._anchors.forEach((anchor, index) => {
      const p = this.anchorToPixel(anchor, viewport);
      if (p) points.push({ index, x: p.x, y: p.y, radius: 6 });
    });
    return points;
  }

  box(viewport: Viewport): FibFanBox | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;
    return { a, b, left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) };
  }

  /** A level's position along an edge: 0 sits on the second point and 1 on the first, or the other way round when reversed. */
  private along(from: number, to: number, value: number): number {
    return this._fibOptions.reverse ? from + (to - from) * value : to + (from - to) * value;
  }

  levelX(box: FibFanBox, value: number): number {
    return this.along(box.a.x, box.b.x, value);
  }

  levelY(box: FibFanBox, value: number): number {
    return this.along(box.a.y, box.b.y, value);
  }

  /** Visible rays ordered from the vertical edge to the horizontal one; the line shared by both level sets appears once. */
  rays(box: FibFanBox): FibFanRay[] {
    const dx = box.b.x - box.a.x;
    const dy = box.b.y - box.a.y;
    if (dx === 0 || dy === 0) return [];
    const out: FibFanRay[] = [];
    const push = (level: FibFanLevel, rx: number, ry: number) => {
      const angle = Math.atan2(Math.abs(rx), Math.abs(ry));
      const sameAs = out.find((r) => Math.abs(r.dx * ry - r.dy * rx) < 1e-6 * (Math.abs(rx) + Math.abs(ry) + 1));
      if (sameAs) return;
      out.push({ level, dx: rx, dy: ry, angle });
    };
    (this._fibOptions.vlevels ?? []).forEach((l) => l.enabled && push(l, this.levelX(box, l.value) - box.a.x, dy));
    (this._fibOptions.hlevels ?? []).forEach((l) => l.enabled && push(l, dx, this.levelY(box, l.value) - box.a.y));
    return out.sort((p, q) => p.angle - q.angle);
  }

  /** Wedges between neighbouring rays take the colour of the one with the larger level. */
  fills(rays: FibFanRay[]): Array<{ from: FibFanRay; to: FibFanRay; color: string }> {
    const out: Array<{ from: FibFanRay; to: FibFanRay; color: string }> = [];
    for (let i = 0; i + 1 < rays.length; i++) {
      const p = rays[i];
      const q = rays[i + 1];
      out.push({ from: p, to: q, color: (p.level.value >= q.level.value ? p : q).level.color });
    }
    return out;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const box = this.box(viewport);
    if (!box) return [];
    const reach = (viewport.width + viewport.height) * 4;
    return this.rays(box).map((ray) => {
      const len = Math.hypot(ray.dx, ray.dy) || 1;
      return {
        type: 'line',
        start: box.a,
        end: { x: box.a.x + (ray.dx / len) * reach, y: box.a.y + (ray.dy / len) * reach },
      } as LineGeometry;
    });
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const box = this.box(viewport);
    if (!box) return false;
    return this.rays(box).some((ray) => distanceToRay(point, box.a, ray.dx, ray.dy) <= HIT_THRESHOLD);
  }

  clone(newId: string): IDrawing {
    return new FibSpeedFan(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }

  static create(
    id: string,
    start: Anchor,
    end: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FibSpeedFanOptions>
  ): FibSpeedFan {
    return new FibSpeedFan(id, [start, end], style, options);
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._fibOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setFibOptions(data.options);
  }
}
