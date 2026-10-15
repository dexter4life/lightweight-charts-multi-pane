import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Geometry, LineGeometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { FIB_TIME_INTERVALS } from './constants';
import { FibTimeZonePaneView } from './fib-time-zone-pane-view';

/** Fibonacci time zone intervals (re-exported for public API compatibility). */
export { FIB_TIME_INTERVALS } from './constants';

export interface FibTimeZoneLevel {
  value: number;
  enabled: boolean;
  color: string;
  width: number;
  dash: number[];
}

export type FibTimeZoneHAlign = 'left' | 'center' | 'right';
export type FibTimeZoneVAlign = 'top' | 'middle' | 'bottom';

export interface FibTimeZoneOptions extends DrawingOptions {
  levels?: FibTimeZoneLevel[];
  trendLineVisible?: boolean;
  showLabels?: boolean;
  backgroundVisible?: boolean;
  backgroundOpacity?: number;
  labelHAlign?: FibTimeZoneHAlign;
  labelVAlign?: FibTimeZoneVAlign;
  fontSize?: number;
  visibility?: VisibilityMap;
}

const GREY = '#787B86';
const BLUE = '#2962FF';

export const defaultFibTimeZoneLevels = (): FibTimeZoneLevel[] =>
  FIB_TIME_INTERVALS.map((value) => ({ value, enabled: true, color: value === 0 ? GREY : BLUE, width: 1, dash: [] }));

export const DEFAULT_FIB_TIME_ZONE_OPTIONS = {
  trendLineVisible: true,
  showLabels: true,
  backgroundVisible: false,
  backgroundOpacity: 0.2,
  labelHAlign: 'right' as FibTimeZoneHAlign,
  labelVAlign: 'bottom' as FibTimeZoneVAlign,
  fontSize: 12,
};

export interface FibTimeZoneLine {
  level: FibTimeZoneLevel;
  x: number;
}

export interface FibTimeZoneLayout {
  a: Point;
  b: Point;
  /** Vertical level lines ordered by value; lines outside the pane are dropped. */
  lines: FibTimeZoneLine[];
  /** Every enabled level, including the ones scrolled out of view, for the background bands. */
  all: FibTimeZoneLine[];
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
 * Fib Time Zone: the first point is level 0 and the distance to the second point is the unit.
 * Each enabled level draws a full-height vertical line at `A + value × (B − A)`.
 */
export class FibTimeZone extends Drawing {
  readonly type: string = 'fib-time-zone';

  protected static readonly REQUIRED_ANCHORS = 2;

  private _fibOptions: FibTimeZoneOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibTimeZoneOptions> = {}
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(id, anchors, { lineColor: '#808080', lineWidth: 1, lineDash: [6, 6], ...style }, base);

    this._fibOptions = {
      ...DEFAULT_FIB_TIME_ZONE_OPTIONS,
      ...options,
      levels: (options.levels ?? defaultFibTimeZoneLevels()).map((l) => ({ ...l })),
    };
  }

  get fibOptions(): FibTimeZoneOptions {
    return this._fibOptions;
  }

  setFibOptions(options: Partial<FibTimeZoneOptions>): void {
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
    if (patch.color) {
      const levels = (this._fibOptions.levels ?? []).map((l) => ({ ...l, color: patch.color as string }));
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
    return this._anchors.length >= FibTimeZone.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new FibTimeZonePaneView(this, 'body'), new FibTimeZonePaneView(this, 'handles')];
  }

  /** While placing, the reference shows a handle on the cursor point as well. */
  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const points: ControlPoint[] = [];
    this._anchors.forEach((anchor, index) => {
      const p = this.anchorToPixel(anchor, viewport);
      if (p) points.push({ index, x: p.x, y: p.y, radius: 6 });
    });
    return points;
  }

  layout(viewport: Viewport): FibTimeZoneLayout | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;

    const unit = b.x - a.x;
    const all: FibTimeZoneLine[] = [];
    for (const level of this._fibOptions.levels ?? []) {
      if (!level.enabled) continue;
      all.push({ level, x: a.x + level.value * unit });
    }
    all.sort((p, q) => p.level.value - q.level.value);
    const lines = all.filter((l) => l.x >= -1 && l.x <= viewport.width + 1);
    return { a, b, lines, all };
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const layout = this.layout(viewport);
    if (!layout) return [];
    return layout.lines.map(
      (l): LineGeometry => ({ type: 'line', start: { x: l.x, y: 0 }, end: { x: l.x, y: viewport.height } })
    );
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.layout(viewport);
    if (!layout) return false;
    if (this._fibOptions.trendLineVisible !== false && distanceToSegment(point, layout.a, layout.b) <= HIT_THRESHOLD) {
      return true;
    }
    return layout.lines.some((l) => Math.abs(point.x - l.x) <= HIT_THRESHOLD);
  }

  clone(newId: string): IDrawing {
    return new FibTimeZone(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }

  static create(
    id: string,
    start: Anchor,
    end: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FibTimeZoneOptions>
  ): FibTimeZone {
    return new FibTimeZone(id, [start, end], style, options);
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._fibOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setFibOptions(data.options);
  }
}
