import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Geometry, LineGeometry } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { FibRetracementPaneView } from './fib-retracement-pane-view';

/** Standard Fibonacci ratios (re-exported for public API compatibility). */
export { FIBONACCI_LEVELS } from './constants';

export interface FibLevel {
  value: number;
  enabled: boolean;
  color: string;
}

export type FibLevelsMode = 'values' | 'percents';
export type FibHAlign = 'left' | 'center' | 'right';
export type FibVAlign = 'top' | 'middle' | 'bottom';

export interface FibRetracementOptions extends DrawingOptions {
  levels?: FibLevel[];
  trendLineVisible?: boolean;
  levelsWidth?: number;
  levelsDash?: number[];
  backgroundVisible?: boolean;
  backgroundOpacity?: number;
  reverse?: boolean;
  showPrices?: boolean;
  showLevels?: boolean;
  levelsMode?: FibLevelsMode;
  labelHAlign?: FibHAlign;
  labelVAlign?: FibVAlign;
  fontSize?: number;
  logScale?: boolean;
  visibility?: VisibilityMap;
}

const GREY = '#787B86';
const RED = '#F23645';
const ORANGE = '#FF9800';
const GREEN = '#4CAF50';
const TEAL = '#089981';
const CYAN = '#00BCD4';
const BLUE = '#2962FF';
const PURPLE = '#9C27B0';
const PINK = '#E91E63';

/** Level list in the order shown by the settings grid (two columns, row by row). */
const DEFAULT_LEVELS: ReadonlyArray<[number, boolean, string]> = [
  [0, true, GREY],
  [0.236, true, RED],
  [0.382, true, ORANGE],
  [0.5, true, GREEN],
  [0.618, true, TEAL],
  [0.786, true, CYAN],
  [1, true, GREY],
  [1.618, true, BLUE],
  [2.618, true, RED],
  [3.618, true, PURPLE],
  [4.236, true, PINK],
  [1.272, false, ORANGE],
  [1.414, false, RED],
  [2.272, false, ORANGE],
  [2.414, false, GREEN],
  [2, false, TEAL],
  [3, false, CYAN],
  [3.272, false, GREY],
  [3.414, false, BLUE],
  [4, false, RED],
  [4.272, false, PURPLE],
  [4.414, false, PINK],
  [4.618, false, ORANGE],
  [4.764, false, TEAL],
];

export const defaultFibLevels = (): FibLevel[] =>
  DEFAULT_LEVELS.map(([value, enabled, color]) => ({ value, enabled, color }));

export const DEFAULT_FIB_OPTIONS = {
  trendLineVisible: true,
  levelsWidth: 1,
  levelsDash: [] as number[],
  backgroundVisible: true,
  backgroundOpacity: 0.2,
  reverse: false,
  showPrices: true,
  showLevels: true,
  levelsMode: 'values' as FibLevelsMode,
  labelHAlign: 'left' as FibHAlign,
  labelVAlign: 'top' as FibVAlign,
  fontSize: 12,
  logScale: false,
};

export interface FibLevelLine {
  level: FibLevel;
  price: number;
  y: number;
}

export interface FibLayout {
  p1: Point;
  p2: Point;
  x1: number;
  x2: number;
  lines: FibLevelLine[];
}

/**
 * Fib Retracement: level 0 sits on the second point and level 1 on the first
 * (swapped when `reverse` is on). Levels are drawn between the two points
 * horizontally, optionally extended to the pane edges.
 */
export class FibRetracement extends Drawing {
  readonly type = 'fib-retracement';

  protected static readonly REQUIRED_ANCHORS = 2;
  protected static readonly HIT_THRESHOLD = 5;

  private _fibOptions: FibRetracementOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibRetracementOptions> = {}
  ) {
    const { extendLeft, extendRight, visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (extendLeft !== undefined) base.extendLeft = extendLeft;
    if (extendRight !== undefined) base.extendRight = extendRight;
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: GREY, lineWidth: 1, lineDash: [6, 6], ...style }, base);

    this._fibOptions = {
      ...DEFAULT_FIB_OPTIONS,
      ...options,
      levels: (options.levels ?? defaultFibLevels()).map((l) => ({ ...l })),
    };
  }

  get fibOptions(): FibRetracementOptions {
    return this._fibOptions;
  }

  setFibOptions(options: Partial<FibRetracementOptions>): void {
    this._fibOptions = { ...this._fibOptions, ...options };
    const { extendLeft, extendRight, visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (extendLeft !== undefined) base.extendLeft = extendLeft;
    if (extendRight !== undefined) base.extendRight = extendRight;
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
  }

  /** Toolbar colour/width apply to the trend line and every level at once. */
  applyUniformStyle(patch: { color?: string; width?: number }): void {
    const levels = (this._fibOptions.levels ?? []).map((l) => (patch.color ? { ...l, color: patch.color } : l));
    this._fibOptions = {
      ...this._fibOptions,
      levels,
      ...(patch.width !== undefined ? { levelsWidth: patch.width } : {}),
    };
    this.updateStyle({
      ...(patch.color ? { lineColor: patch.color } : {}),
      ...(patch.width !== undefined ? { lineWidth: patch.width } : {}),
    });
  }

  // ============ Interval visibility ============

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
    return this._anchors.length >= FibRetracement.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new FibRetracementPaneView(this)];
  }

  // ============ Levels ============

  /** Price at a level value, honouring `reverse` and log scale. */
  getPriceAtLevel(value: number): number {
    if (!this.isValid()) return 0;
    const o = this._fibOptions;
    const first = this._anchors[0].price;
    const second = this._anchors[1].price;
    const from = o.reverse ? first : second;
    const to = o.reverse ? second : first;
    if (o.logScale && from > 0 && to > 0) {
      return Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * value);
    }
    return from + (to - from) * value;
  }

  /** Pixel layout shared by rendering and hit testing; null while the anchors are off the time scale. */
  layout(viewport: Viewport): FibLayout | null {
    if (!this.isValid()) return null;
    const p1 = this.anchorToPixel(this._anchors[0], viewport);
    const p2 = this.anchorToPixel(this._anchors[1], viewport);
    if (!p1 || !p2) return null;

    const lines: FibLevelLine[] = [];
    const enabled = (this._fibOptions.levels ?? []).filter((l) => l.enabled).sort((a, b) => a.value - b.value);
    for (const level of enabled) {
      const price = this.getPriceAtLevel(level.value);
      const y = viewport.priceScale.priceToCoordinate(price);
      if (y !== null) lines.push({ level, price, y });
    }

    return {
      p1,
      p2,
      x1: this._options.extendLeft ? 0 : Math.min(p1.x, p2.x),
      x2: this._options.extendRight ? viewport.width : Math.max(p1.x, p2.x),
      lines,
    };
  }

  formatPrice(price: number): string {
    return this._series ? this._series.priceFormatter().format(price) : price.toFixed(2);
  }

  // ============ Geometry / hit testing ============

  computeGeometry(viewport: Viewport): Geometry[] {
    const layout = this.layout(viewport);
    if (!layout) return [];
    return layout.lines.map(
      (l): LineGeometry => ({
        type: 'line',
        start: { x: layout.x1, y: l.y },
        end: { x: layout.x2, y: l.y },
      })
    );
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.layout(viewport);
    if (!layout) return false;
    const t = FibRetracement.HIT_THRESHOLD;

    if (point.x >= layout.x1 - t && point.x <= layout.x2 + t) {
      for (const l of layout.lines) {
        if (Math.abs(point.y - l.y) <= t) return true;
      }
    }

    if (this._fibOptions.trendLineVisible) {
      const { p1, p2 } = layout;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len2 = dx * dx + dy * dy;
      const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / len2));
      if (Math.hypot(point.x - (p1.x + s * dx), point.y - (p1.y + s * dy)) <= t) return true;
    }
    return false;
  }

  // ============ Clone / serialization ============

  clone(newId: string): IDrawing {
    return new FibRetracement(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._fibOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setFibOptions(data.options);
  }

  static create(
    id: string,
    start: Anchor,
    end: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FibRetracementOptions>
  ): FibRetracement {
    return new FibRetracement(id, [start, end], style, options);
  }
}
