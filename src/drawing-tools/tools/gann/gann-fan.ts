import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Geometry, LineGeometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { GannFanPaneView } from './gann-fan-pane-view';

/** Standard Gann fan angles (re-exported for public API compatibility). */
export { GANN_FAN_ANGLES } from './constants';

/** One fan line: it runs from the first point in the direction (coeff1 * dx, coeff2 * dy). */
export interface GannFanLevel {
  coeff1: number;
  coeff2: number;
  color: string;
  width: number;
  dash?: number[];
  visible: boolean;
}

export interface GannFanOptions extends DrawingOptions {
  levels?: GannFanLevel[];
  showLabels?: boolean;
  fillBackground?: boolean;
  /** Fill opacity, 0..1. */
  backgroundOpacity?: number;
  visibility?: VisibilityMap;
}

/** [coeff1, coeff2, colour] */
const LEVEL_DEFAULTS: Array<[number, number, string]> = [
  [1, 8, '#FF9800'],
  [1, 4, '#089981'],
  [1, 3, '#4caf50'],
  [1, 2, '#089981'],
  [1, 1, '#00bcd4'],
  [2, 1, '#2962FF'],
  [3, 1, '#9c27b0'],
  [4, 1, '#e91e63'],
  [8, 1, '#F23645'],
];

export const defaultGannFanLevels = (): GannFanLevel[] =>
  LEVEL_DEFAULTS.map(([coeff1, coeff2, color]) => ({ coeff1, coeff2, color, width: 1, visible: true }));

export const DEFAULT_GANN_FAN_OPTIONS = {
  showLabels: true,
  fillBackground: true,
  backgroundOpacity: 0.2,
};

/** The 1/1 line is the middle one: lines on its steeper side fill towards it and so do the flatter ones. */
const MIDDLE_LEVEL = 4;

const HIT_THRESHOLD = 3;

export interface GannFanRay {
  index: number;
  level: GannFanLevel;
  /** Direction from the first point. */
  dx: number;
  dy: number;
}

function distanceToRay(p: Point, o: Point, dx: number, dy: number): number {
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - o.x, p.y - o.y);
  const s = Math.max(0, ((p.x - o.x) * dx + (p.y - o.y) * dy) / len2);
  return Math.hypot(p.x - (o.x + s * dx), p.y - (o.y + s * dy));
}

/**
 * Gann Fan: rays from the first point. The second point defines the 1/1 line; every other line
 * scales that vector by its own coefficients.
 */
export class GannFan extends Drawing {
  readonly type = 'gann-fan';

  protected static readonly REQUIRED_ANCHORS = 2;

  private _gannOptions: GannFanOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<GannFanOptions> = {}
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(id, anchors, { lineColor: '#00bcd4', lineWidth: 1, lineDash: [], ...style }, base);

    const defined = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
    this._gannOptions = {
      ...DEFAULT_GANN_FAN_OPTIONS,
      ...defined,
      levels: (options.levels ?? defaultGannFanLevels()).map((l) => ({ ...l })),
    };
  }

  get gannOptions(): GannFanOptions {
    return this._gannOptions;
  }

  setGannOptions(options: Partial<GannFanOptions>): void {
    this._gannOptions = { ...this._gannOptions, ...options };
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
  }

  /** The floating toolbar recolours and restyles every level at once. */
  applyUniformStyle(patch: { color?: string; width?: number; dash?: number[] }): void {
    this._gannOptions = {
      ...this._gannOptions,
      levels: this._gannOptions.levels?.map((l) => ({
        ...l,
        ...(patch.color !== undefined ? { color: patch.color } : {}),
        ...(patch.width !== undefined ? { width: patch.width } : {}),
      })),
    };
    this.updateStyle({
      ...(patch.color !== undefined ? { lineColor: patch.color } : {}),
      ...(patch.width !== undefined ? { lineWidth: patch.width } : {}),
    });
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._gannOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  isValid(): boolean {
    return this._anchors.length >= GannFan.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new GannFanPaneView(this), new GannFanPaneView(this, 'handles')];
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const points: ControlPoint[] = [];
    this._anchors.forEach((anchor, index) => {
      const p = this.anchorToPixel(anchor, viewport);
      if (p) points.push({ index, x: p.x, y: p.y, radius: 6 });
    });
    return points;
  }

  /** Both points in pixels, or null while they coincide on an axis. */
  origin(viewport: Viewport): { a: Point; b: Point } | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;
    return { a, b };
  }

  /** Visible rays in list order, with the vector each one points along. */
  rays(viewport: Viewport): { a: Point; b: Point; rays: GannFanRay[] } | null {
    const pts = this.origin(viewport);
    if (!pts) return null;
    const dx = pts.b.x - pts.a.x;
    const dy = pts.b.y - pts.a.y;
    const rays: GannFanRay[] = [];
    (this._gannOptions.levels ?? []).forEach((level, index) => {
      if (!level.visible || (dx === 0 && dy === 0)) return;
      rays.push({ index, level, dx: dx * level.coeff1, dy: dy * level.coeff2 });
    });
    return { ...pts, rays };
  }

  /**
   * Wedges between neighbouring rays. Levels before 1/2 fill towards the next visible level,
   * 1/1 and the steeper-side ones towards the previous visible level, and 1/2 itself does not fill.
   */
  fills(rays: GannFanRay[]): Array<{ from: GannFanRay; to: GannFanRay }> {
    const out: Array<{ from: GannFanRay; to: GannFanRay }> = [];
    rays.forEach((ray, i) => {
      if (ray.index < MIDDLE_LEVEL - 1) {
        const next = rays[i + 1];
        if (next) out.push({ from: ray, to: next });
      } else if (ray.index >= MIDDLE_LEVEL) {
        const prev = rays[i - 1];
        if (prev) out.push({ from: ray, to: prev });
      }
    });
    return out;
  }

  /** Where a label sits: on the vertical through the second point for flat lines, on its horizontal for steep ones. */
  labelPoint(a: Point, b: Point, level: GannFanLevel): Point {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return level.coeff1 >= level.coeff2
      ? { x: b.x, y: a.y + (dy * level.coeff2) / level.coeff1 }
      : { x: a.x + (dx * level.coeff1) / level.coeff2, y: b.y };
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const r = this.rays(viewport);
    if (!r) return [];
    const reach = (viewport.width + viewport.height) * 4;
    return r.rays.map((ray) => {
      const len = Math.hypot(ray.dx, ray.dy) || 1;
      return {
        type: 'line',
        start: r.a,
        end: { x: r.a.x + (ray.dx / len) * reach, y: r.a.y + (ray.dy / len) * reach },
      } as LineGeometry;
    });
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const r = this.rays(viewport);
    if (!r) return false;
    return r.rays.some((ray) => distanceToRay(point, r.a, ray.dx, ray.dy) <= HIT_THRESHOLD);
  }

  clone(newId: string): IDrawing {
    return new GannFan(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._gannOptions });
  }

  static create(
    id: string,
    origin: Anchor,
    direction: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<GannFanOptions>
  ): GannFan {
    return new GannFan(id, [origin, direction], style, options);
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._gannOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setGannOptions(data.options);
  }
}
