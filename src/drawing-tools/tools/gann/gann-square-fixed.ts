import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Geometry, LineGeometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { GannSquareFixedPaneView } from './gann-square-fixed-pane-view';

/** Gann square levels (re-exported for public API compatibility). */
export { GANN_SQUARE_LEVELS } from './constants';

export interface GannSquareFixedLine {
  color: string;
  width: number;
  visible: boolean;
}

/** A fan is a ray from the origin with slope y/x; an arc is a circle of radius hypot(x, y) units. */
export interface GannSquareFixedRay extends GannSquareFixedLine {
  x: number;
  y: number;
}

export interface GannSquareFixedOptions extends DrawingOptions {
  levels?: GannSquareFixedLine[];
  fanlines?: GannSquareFixedRay[];
  arcs?: GannSquareFixedRay[];
  arcsBackground?: boolean;
  arcsOpacity?: number;
  fillBackground?: boolean;
  reverse?: boolean;
  visibility?: VisibilityMap;
}

const GREY = '#787B86';
const LEVEL_COLORS = [GREY, '#FF9800', '#00bcd4', '#4caf50', '#089981', GREY];
/** [x, y, colour, visible] */
const FAN_DEFAULTS: Array<[number, number, string, boolean]> = [
  [8, 1, '#B39DDB', false],
  [5, 1, '#F23645', false],
  [4, 1, GREY, false],
  [3, 1, '#FF9800', false],
  [2, 1, '#00bcd4', true],
  [1, 1, '#4caf50', true],
  [1, 2, '#089981', true],
  [1, 3, '#089981', false],
  [1, 4, '#2962FF', false],
  [1, 5, '#9575cd', false],
  [1, 8, '#B39DDB', false],
];
const ARC_DEFAULTS: Array<[number, number, string]> = [
  [1, 0, '#FF9800'],
  [1, 1, '#FF9800'],
  [1.5, 0, '#FF9800'],
  [2, 0, '#00bcd4'],
  [2, 1, '#00bcd4'],
  [3, 0, '#4caf50'],
  [3, 1, '#4caf50'],
  [4, 0, '#089981'],
  [4, 1, '#089981'],
  [5, 0, '#2962FF'],
  [5, 1, '#2962FF'],
];

export const defaultGannSquareFixedLevels = (): GannSquareFixedLine[] =>
  LEVEL_COLORS.map((color) => ({ color, width: 1, visible: true }));
export const defaultGannSquareFixedFans = (): GannSquareFixedRay[] =>
  FAN_DEFAULTS.map(([x, y, color, visible]) => ({ x, y, color, width: 1, visible }));
export const defaultGannSquareFixedArcs = (): GannSquareFixedRay[] =>
  ARC_DEFAULTS.map(([x, y, color]) => ({ x, y, color, width: 1, visible: true }));

export const DEFAULT_GANN_SQUARE_FIXED_OPTIONS = {
  arcsBackground: true,
  arcsOpacity: 0.2,
  fillBackground: false,
  reverse: false,
};

/** The box spans this many units of the base distance on each axis. */
export const GANN_SQUARE_FIXED_SPAN = 5;

export interface GannSquareFixedLayout {
  origin: Point;
  /** Pixel length of one unit: the distance between the two points. */
  unit: number;
  /** Direction the box grows in along each axis (+1 or -1). */
  sx: number;
  sy: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
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
 * Gann Square Fixed: a square of fixed pixel size whose unit is the distance between the two
 * points. It grows from the first point towards the second; `reverse` grows it from the second.
 */
export class GannSquareFixed extends Drawing {
  readonly type: string = 'gann-square-fixed';

  protected static readonly REQUIRED_ANCHORS = 2;

  protected _gannOptions: GannSquareFixedOptions;
  protected _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<GannSquareFixedOptions> = {}
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(id, anchors, { lineColor: GREY, lineWidth: 1, lineDash: [], ...style }, base);

    const defined = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
    this._gannOptions = {
      ...DEFAULT_GANN_SQUARE_FIXED_OPTIONS,
      ...defined,
      levels: (options.levels ?? defaultGannSquareFixedLevels()).map((l) => ({ ...l })),
      fanlines: (options.fanlines ?? defaultGannSquareFixedFans()).map((l) => ({ ...l })),
      arcs: (options.arcs ?? defaultGannSquareFixedArcs()).map((l) => ({ ...l })),
    };
  }

  get gannOptions(): GannSquareFixedOptions {
    return this._gannOptions;
  }

  setGannOptions(options: Partial<GannSquareFixedOptions>): void {
    this._gannOptions = { ...this._gannOptions, ...options };
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
  }

  /** The floating toolbar recolours and restyles every level, fan and arc at once. */
  applyUniformStyle(patch: { color?: string; width?: number; dash?: number[] }): void {
    const o = this._gannOptions;
    const apply = <T extends GannSquareFixedLine>(list: T[] | undefined): T[] | undefined =>
      list?.map((l) => ({
        ...l,
        ...(patch.color !== undefined ? { color: patch.color } : {}),
        ...(patch.width !== undefined ? { width: patch.width } : {}),
      }));
    this._gannOptions = { ...o, levels: apply(o.levels), fanlines: apply(o.fanlines), arcs: apply(o.arcs) };
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
    return this._anchors.length >= GannSquareFixed.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new GannSquareFixedPaneView(this), new GannSquareFixedPaneView(this, 'handles')];
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const points: ControlPoint[] = [];
    this._anchors.forEach((anchor, index) => {
      const p = this.anchorToPixel(anchor, viewport);
      if (p) points.push({ index, x: p.x, y: p.y, radius: 6 });
    });
    return points;
  }

  layout(viewport: Viewport): GannSquareFixedLayout | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;

    const origin = this._gannOptions.reverse ? b : a;
    const far = this._gannOptions.reverse ? a : b;
    const unit = Math.hypot(b.x - a.x, b.y - a.y);
    const sign = (v: number) => (v < 0 ? -1 : 1);
    const sx = sign(far.x - origin.x);
    const sy = sign(far.y - origin.y);
    const span = unit * GANN_SQUARE_FIXED_SPAN;
    const ex = origin.x + sx * span;
    const ey = origin.y + sy * span;
    return {
      origin,
      unit,
      sx,
      sy,
      left: Math.min(origin.x, ex),
      right: Math.max(origin.x, ex),
      top: Math.min(origin.y, ey),
      bottom: Math.max(origin.y, ey),
    };
  }

  /** Where a level line sits along its axis, as an offset from the origin. */
  levelOffset(layout: GannSquareFixedLayout, index: number): number {
    return index * layout.unit;
  }

  /** End of a fan ray: it runs from the origin to the box edge. */
  fanEnd(layout: GannSquareFixedLayout, fan: GannSquareFixedRay): Point {
    const m = Math.max(fan.x, fan.y) || 1;
    const t = GANN_SQUARE_FIXED_SPAN / m;
    return {
      x: layout.origin.x + layout.sx * fan.x * t * layout.unit,
      y: layout.origin.y + layout.sy * fan.y * t * layout.unit,
    };
  }

  arcRadius(layout: GannSquareFixedLayout, arc: GannSquareFixedRay): number {
    return Math.hypot(arc.x, arc.y) * layout.unit;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const layout = this.layout(viewport);
    if (!layout) return [];
    const geometries: Geometry[] = [];
    (this._gannOptions.levels ?? []).forEach((l, i) => {
      if (!l.visible) return;
      const d = this.levelOffset(layout, i);
      const y = layout.origin.y + layout.sy * d;
      const x = layout.origin.x + layout.sx * d;
      geometries.push({ type: 'line', start: { x: layout.left, y }, end: { x: layout.right, y } } as LineGeometry);
      geometries.push({ type: 'line', start: { x, y: layout.top }, end: { x, y: layout.bottom } } as LineGeometry);
    });
    return geometries;
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.layout(viewport);
    if (!layout) return false;
    const { left, right, top, bottom, origin } = layout;
    const o = this._gannOptions;

    const inX = point.x >= left - HIT_THRESHOLD && point.x <= right + HIT_THRESHOLD;
    const inY = point.y >= top - HIT_THRESHOLD && point.y <= bottom + HIT_THRESHOLD;
    if (!inX || !inY) return false;

    for (let i = 0; i < (o.levels ?? []).length; i++) {
      if (!o.levels![i].visible) continue;
      const d = this.levelOffset(layout, i);
      if (Math.abs(point.y - (origin.y + layout.sy * d)) <= HIT_THRESHOLD) return true;
      if (Math.abs(point.x - (origin.x + layout.sx * d)) <= HIT_THRESHOLD) return true;
    }
    for (const fan of o.fanlines ?? []) {
      if (fan.visible && distanceToSegment(point, origin, this.fanEnd(layout, fan)) <= HIT_THRESHOLD) return true;
    }
    const dist = Math.hypot(point.x - origin.x, point.y - origin.y);
    const inQuadrant = (point.x - origin.x) * layout.sx >= -HIT_THRESHOLD && (point.y - origin.y) * layout.sy >= -HIT_THRESHOLD;
    if (inQuadrant) {
      for (const arc of o.arcs ?? []) {
        if (arc.visible && Math.abs(dist - this.arcRadius(layout, arc)) <= HIT_THRESHOLD) return true;
      }
    }
    return false;
  }

  clone(newId: string): IDrawing {
    return new GannSquareFixed(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._gannOptions });
  }

  static create(
    id: string,
    point1: Anchor,
    point2: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<GannSquareFixedOptions>
  ): GannSquareFixed {
    return new GannSquareFixed(id, [point1, point2], style, options);
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._gannOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setGannOptions(data.options);
  }
}
