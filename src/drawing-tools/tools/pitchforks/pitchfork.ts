import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Geometry, LineGeometry } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PitchforkPaneView } from './pitchfork-pane-view';

export type PitchforkVariant = 'original' | 'schiff' | 'modified-schiff' | 'inside';

export interface PitchforkLevel {
  value: number;
  enabled: boolean;
  color: string;
  width: number;
  dash: number[];
}

export interface PitchforkOptions extends DrawingOptions {
  variant?: PitchforkVariant;
  levels?: PitchforkLevel[];
  /** Extends the median and every level infinitely in both directions. */
  extendLines?: boolean;
  backgroundVisible?: boolean;
  backgroundOpacity?: number;
  visibility?: VisibilityMap;
}

const RED = '#F23645';

/** Level values with their default visibility and colour, in the order the settings grid lists them. */
const DEFAULT_LEVELS: ReadonlyArray<[number, boolean, string]> = [
  [0.25, false, '#ffb74d'],
  [0.382, false, '#81c784'],
  [0.5, true, '#089981'],
  [0.618, false, '#089981'],
  [0.75, false, '#00bcd4'],
  [1, true, '#2962FF'],
  [1.5, false, '#9c27b0'],
  [1.75, false, '#e91e63'],
  [2, false, '#F77C80'],
];

export const defaultPitchforkLevels = (): PitchforkLevel[] =>
  DEFAULT_LEVELS.map(([value, enabled, color]) => ({ value, enabled, color, width: 1, dash: [] }));

export const DEFAULT_PITCHFORK_OPTIONS = {
  variant: 'original' as PitchforkVariant,
  extendLines: false,
  backgroundVisible: true,
  backgroundOpacity: 0.2,
};

/** A straight piece of the drawing: `start` plus `dir` (unit vector) from `-back` to `forward` pixels. */
export interface PitchforkRay {
  start: Point;
  dir: Point;
  back: number;
  forward: number;
}

export interface PitchforkLevelRay extends PitchforkRay {
  level: PitchforkLevel;
  /** Signed coefficient: the mirrored half of the fork uses the negative value. */
  signed: number;
}

export interface PitchforkLayout {
  a: Point;
  b: Point;
  c: Point;
  /** Thin segments joining the anchors (and the inside pitchfork's guide). */
  segments: Array<[Point, Point]>;
  median: PitchforkRay | null;
  /** Level lines ordered by signed coefficient, from the far negative side to the far positive side. */
  levels: PitchforkLevelRay[];
  /** True while only the first two points exist: just the guide from A to the cursor shows. */
  partial: boolean;
  /** Fan layouts start every ray at the first point, so the median edge of the bands starts there too. */
  fan?: boolean;
}

const HIT_THRESHOLD = 3;

const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

function unit(from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return len < 1e-9 ? null : { x: dx / len, y: dy / len };
}

/** Distance from a point to the piece of a ray between its `back` and `forward` ends. */
function distanceToRay(p: Point, ray: PitchforkRay): number {
  const ax = ray.start.x - ray.dir.x * ray.back;
  const ay = ray.start.y - ray.dir.y * ray.back;
  const len = ray.back + ray.forward;
  const t = Math.max(0, Math.min(len, (p.x - ax) * ray.dir.x + (p.y - ay) * ray.dir.y));
  return Math.hypot(p.x - (ax + ray.dir.x * t), p.y - (ay + ray.dir.y * t));
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + s * dx), p.y - (a.y + s * dy));
}

/**
 * Andrews' pitchfork and its Schiff, Modified Schiff and Inside variants: three points A, B, C.
 * The median runs from a start point through the middle of B–C; every level line starts on the B–C
 * line, parallel to the median, at `mid + coefficient × (B − mid)` (and the mirror image for the
 * negative side).
 */
export class Pitchfork extends Drawing {
  readonly type: string = 'andrews-pitchfork';

  protected _pitchforkOptions: PitchforkOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<PitchforkOptions> = {},
    variant: PitchforkVariant = 'original'
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(id, anchors, { lineColor: RED, lineWidth: 1, lineDash: [], ...style }, base);

    this._pitchforkOptions = {
      ...DEFAULT_PITCHFORK_OPTIONS,
      variant,
      ...options,
      levels: (options.levels ?? defaultPitchforkLevels()).map((l) => ({ ...l })),
    };
  }

  get pitchforkOptions(): PitchforkOptions {
    return this._pitchforkOptions;
  }

  get variant(): PitchforkVariant {
    return this._pitchforkOptions.variant ?? 'original';
  }

  setPitchforkOptions(options: Partial<PitchforkOptions>): void {
    this._pitchforkOptions = { ...this._pitchforkOptions, ...options };
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
  }

  /** The floating toolbar recolours the median and every level at once. */
  applyUniformStyle(patch: { color?: string; width?: number }): void {
    const levels = (this._pitchforkOptions.levels ?? []).map((l) => ({
      ...l,
      ...(patch.color ? { color: patch.color } : {}),
      ...(patch.width !== undefined ? { width: patch.width } : {}),
    }));
    this._pitchforkOptions = { ...this._pitchforkOptions, levels };
    this.updateStyle({
      ...(patch.color ? { lineColor: patch.color } : {}),
      ...(patch.width !== undefined ? { lineWidth: patch.width } : {}),
    });
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._pitchforkOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  isValid(): boolean {
    return this._anchors.length >= 3;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new PitchforkPaneView(this, 'body'), new PitchforkPaneView(this, 'handles')];
  }

  /** Pixel layout shared by rendering and hit testing; null while an anchor is off the time scale. */
  layout(viewport: Viewport): PitchforkLayout | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    const c = this.anchorToPixel(this._anchors[2], viewport);
    if (!a || !b || !c) return null;

    const placed = this._placedCount ?? 3;
    const o = this._pitchforkOptions;
    const extend = !!o.extendLines;
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const reach = (from: Point) =>
      3 * (viewport.width + viewport.height) + 2 * Math.hypot(from.x - center.x, from.y - center.y);

    if (placed < 2) {
      return { a, b, c, segments: [], median: null, levels: [], partial: true };
    }

    const bc = mid(b, c);
    let dir: Point | null;
    const segments: Array<[Point, Point]> = [[b, c]];
    let start: Point;

    switch (this.variant) {
      case 'schiff':
        start = { x: a.x, y: (a.y + b.y) / 2 };
        dir = unit(start, bc);
        segments.unshift([a, b]);
        break;
      case 'modified-schiff':
        start = mid(a, b);
        dir = unit(start, bc);
        segments.unshift([a, b]);
        break;
      case 'inside': {
        const ab = mid(a, b);
        start = bc;
        dir = unit(ab, c);
        segments.unshift([a, b], [ab, c]);
        break;
      }
      default:
        start = a;
        dir = unit(a, bc);
    }
    if (!dir) return { a, b, c, segments, median: null, levels: [], partial: false };

    const forward = reach(start);
    const median: PitchforkRay = { start, dir, back: extend ? forward : 0, forward };

    const half = { x: b.x - bc.x, y: b.y - bc.y };
    const levels: PitchforkLevelRay[] = [];
    for (const level of o.levels ?? []) {
      if (!level.enabled) continue;
      for (const sign of [-1, 1]) {
        const signed = sign * level.value;
        const s = { x: bc.x + half.x * signed, y: bc.y + half.y * signed };
        const f = reach(s);
        levels.push({ level, signed, start: s, dir, back: extend ? f : 0, forward: f });
      }
    }
    levels.sort((p, q) => p.signed - q.signed);
    return { a, b, c, segments, median, levels, partial: false };
  }

  /** Where the first-step guide ends: a ray when the cursor is to the right of the first point. */
  partialRay(layout: PitchforkLayout, viewport: Viewport): PitchforkRay | null {
    const dir = unit(layout.a, layout.b);
    if (!dir) return null;
    const length = Math.hypot(layout.b.x - layout.a.x, layout.b.y - layout.a.y);
    const forward =
      layout.b.x > layout.a.x
        ? 3 * (viewport.width + viewport.height) + 2 * Math.hypot(layout.a.x - viewport.width / 2, layout.a.y - viewport.height / 2)
        : length;
    return { start: layout.a, dir, back: 0, forward };
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const layout = this.layout(viewport);
    if (!layout) return [];
    const rays = [layout.median, ...layout.levels].filter((r): r is PitchforkRay => r !== null);
    return rays.map(
      (r): LineGeometry => ({
        type: 'line',
        start: { x: r.start.x - r.dir.x * r.back, y: r.start.y - r.dir.y * r.back },
        end: { x: r.start.x + r.dir.x * r.forward, y: r.start.y + r.dir.y * r.forward },
      })
    );
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.layout(viewport);
    if (!layout) return false;

    if (layout.partial) {
      const ray = this.partialRay(layout, viewport);
      return ray ? distanceToRay(point, ray) <= HIT_THRESHOLD : false;
    }
    for (const [p, q] of layout.segments) {
      if (distanceToSegment(point, p, q) <= HIT_THRESHOLD) return true;
    }
    if (layout.median && distanceToRay(point, layout.median) <= HIT_THRESHOLD) return true;
    return layout.levels.some((l) => distanceToRay(point, l) <= HIT_THRESHOLD);
  }

  clone(newId: string): IDrawing {
    return new Pitchfork(
      newId,
      [...this._anchors],
      { ...this._style },
      { ...this._options, ...this._pitchforkOptions },
      this.variant
    );
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._pitchforkOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setPitchforkOptions(data.options);
  }
}
