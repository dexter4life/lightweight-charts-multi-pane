import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Geometry, LineGeometry, TextGeometry } from '../../core/geometry';
import { getLineAngleDegrees, midpoint } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { formatPrice } from '../../rendering/canvas-utils';
import { BaseLine } from './base-line';
import { TrendLinePaneView } from './trend-line-pane-view';

/**
 * TrendLine options beyond base drawing options
 */
export type LineEnd = 'normal' | 'arrow';
export type StatsPosition = 'left' | 'center' | 'right';
export type TextVAlign = 'top' | 'middle' | 'bottom';
export type TextHAlign = 'left' | 'center' | 'right';
export type IntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';

export interface IntervalVisibility {
  enabled: boolean;
  min: number;
  max: number;
}

export type VisibilityMap = Record<IntervalUnit, IntervalVisibility>;

export const DEFAULT_VISIBILITY: VisibilityMap = {
  minutes: { enabled: true, min: 1, max: 59 },
  hours: { enabled: true, min: 1, max: 24 },
  days: { enabled: true, min: 1, max: 366 },
  weeks: { enabled: true, min: 1, max: 52 },
  months: { enabled: true, min: 1, max: 12 },
};

export interface TrendLineOptions extends DrawingOptions {
  showAngle?: boolean;
  showPriceChange?: boolean;
  showPercentChange?: boolean;
  showBars?: boolean;

  /** extendLeft extends beyond point 1, extendRight beyond point 2 (by point index, not by x). */
  middlePoint?: boolean;
  priceLabels?: boolean;
  statsPrice?: boolean;
  statsBars?: boolean;
  statsDate?: boolean;
  statsDistance?: boolean;
  statsAngle?: boolean;
  alwaysShowStats?: boolean;
  statsPosition?: StatsPosition;
  leftEnd?: LineEnd;
  rightEnd?: LineEnd;
  showText?: boolean;
  text?: string;
  textColor?: string;
  textSize?: number;
  textBold?: boolean;
  textItalic?: boolean;
  textVAlign?: TextVAlign;
  textHAlign?: TextHAlign;
  visibility?: VisibilityMap;
}

export const DEFAULT_TREND_LINE_OPTIONS = {
  middlePoint: false,
  priceLabels: false,
  statsPrice: false,
  statsBars: false,
  statsDate: false,
  statsDistance: false,
  statsAngle: false,
  alwaysShowStats: false,
  statsPosition: 'right' as StatsPosition,
  leftEnd: 'normal' as LineEnd,
  rightEnd: 'normal' as LineEnd,
  showText: false,
  text: '',
  textSize: 14,
  textBold: false,
  textItalic: false,
  textVAlign: 'top' as TextVAlign,
  textHAlign: 'center' as TextHAlign,
};

export interface TrendLineStats {
  price?: string;
  range?: string;
  angle?: string;
}

const MINUS = '\u2212';

/**
 * TrendLine - The most advanced line drawing tool.
 *
 * Features:
 * - Two-point line drawing
 * - Optional line extensions (left/right)
 * - Optional angle display
 * - Optional price/percentage change display
 * - Optional bar count display
 * - Hit testing for selection
 * - Anchor manipulation
 */
export class TrendLine extends BaseLine {
  readonly type: string = 'trend-line';

  private _trendLineOptions: TrendLineOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TrendLineOptions> = {}
  ) {
    const { showAngle, showPriceChange, showPercentChange, showBars, ...rest } = options;

    super(id, anchors, style, rest);

    this._trendLineOptions = {
      ...DEFAULT_TREND_LINE_OPTIONS,
      ...this._options,
      ...rest,
      showAngle: showAngle ?? false,
      showPriceChange: showPriceChange ?? false,
      showPercentChange: showPercentChange ?? false,
      showBars: showBars ?? false,
    };
  }

  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  /** Current chart interval, used by the per-interval visibility option. */
  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  isVisibleAtInterval(): boolean {
    const map = this._trendLineOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override showsIdlePriceLabels(): boolean {
    return !!this._trendLineOptions.priceLabels && this.isVisibleAtInterval();
  }

  override isDisplayed(): boolean {
    return this.isVisibleAtInterval();
  }

  /** Raw pixel positions of the two anchors. */
  anchorPixels(viewport: Viewport): [Point, Point] | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    return a && b ? [a, b] : null;
  }

  /** Subclasses that draw the angle arc and degree label (Trend Angle). */
  get showsAngleArc(): boolean {
    return false;
  }

  hasStats(): boolean {
    const o = this._trendLineOptions;
    return !!(o.statsPrice || o.statsBars || o.statsDate || o.statsDistance || o.statsAngle);
  }

  /** Lines of text for the stats box; empty when no stat is enabled. */
  computeStats(p1: Point, p2: Point): { icon: 'price' | 'range' | 'angle'; text: string }[] {
    const o = this._trendLineOptions;
    const rows: { icon: 'price' | 'range' | 'angle'; text: string }[] = [];
    const fmtSigned = (v: number, text: string) => (v < 0 ? `${MINUS}${text}` : text);

    if (o.statsPrice) {
      const diff = this._anchors[1].price - this._anchors[0].price;
      const base = this._anchors[0].price;
      const pct = base !== 0 ? (diff / base) * 100 : 0;
      const series = this._series;
      const fmt = (v: number) => (series ? series.priceFormatter().format(v) : v.toFixed(2));
      const minMove = (series?.options() as { priceFormat?: { minMove?: number } } | undefined)?.priceFormat?.minMove || 0.01;
      const ticks = Math.round(Math.abs(diff) / minMove);
      rows.push({
        icon: 'price',
        text: `${fmtSigned(diff, fmt(Math.abs(diff)))} (${fmtSigned(pct, Math.abs(pct).toFixed(2) + '%')}), ${fmtSigned(diff, String(ticks))}`,
      });
    }

    if (o.statsBars || o.statsDate || o.statsDistance) {
      const parts: string[] = [];
      const barSpacing = this._chart ? this._chart.timeScale().options().barSpacing : 6;
      const bars = Math.round((p2.x - p1.x) / (barSpacing || 6));
      const barsText = `${bars} bars`;
      const dateText = this.formatTimeSpan();
      if (o.statsBars && o.statsDate) parts.push(`${barsText} (${dateText})`);
      else if (o.statsBars) parts.push(barsText);
      else if (o.statsDate) parts.push(dateText);
      if (o.statsDistance) parts.push(`distance: ${Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y))} px`);
      rows.push({ icon: 'range', text: parts.join(', ') });
    }

    if (o.statsAngle) {
      const angle = Math.round((Math.atan2(-(p2.y - p1.y), p2.x - p1.x) * 180) / Math.PI);
      rows.push({ icon: 'angle', text: `${angle}\u00b0` });
    }
    return rows;
  }

  private formatTimeSpan(): string {
    const t0 = BaseLine.timeToSeconds(this._anchors[0].time);
    const t1 = BaseLine.timeToSeconds(this._anchors[1].time);
    let secs = Math.round(t1 - t0);
    const sign = secs < 0 ? '-' : '';
    secs = Math.abs(secs);
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean);
    return sign + (parts.length ? parts.join(' ') : '0d');
  }

  // ============ Hit Testing ============

  override testHit(point: Point, viewport: Viewport): boolean {
    const px = this.anchorPixels(viewport);
    if (!px) return false;
    const [a, b] = px;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(point.x - a.x, point.y - a.y) <= 5;
    let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
    if (t < 0 && !this._options.extendLeft) t = 0;
    if (t > 1 && !this._options.extendRight) t = 1;
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)) <= 5;
  }

  // ============ Getters/Setters ============

  get trendLineOptions(): TrendLineOptions {
    return this._trendLineOptions;
  }

  setTrendLineOptions(options: Partial<TrendLineOptions>): void {
    this._trendLineOptions = { ...this._trendLineOptions, ...options };
    // Restoring from JSON copies every option into the base set, so keep it in sync or stale values win.
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  // ============ Pane Views ============

  override paneViews(): IPrimitivePaneView[] {
    return [new TrendLinePaneView(this)];
  }

  // ============ Geometry ============

  override computeGeometry(viewport: Viewport): Geometry[] {
    if (!this.isValid()) return [];

    const start = this.anchorToPixel(this._anchors[0], viewport);
    const end = this.anchorToPixel(this._anchors[1], viewport);

    if (!start || !end) return [];

    const geometries: Geometry[] = [];

    // Main line
    const lineGeometry: LineGeometry = {
      type: 'line',
      start,
      end,
      extendLeft: this._options.extendLeft,
      extendRight: this._options.extendRight,
    };
    geometries.push(lineGeometry);

    // Add labels if enabled
    if (this._trendLineOptions.showAngle ||
        this._trendLineOptions.showPriceChange ||
        this._trendLineOptions.showPercentChange ||
        this._trendLineOptions.showBars) {
      const labelGeometries = this.computeLabelGeometry(start, end);
      geometries.push(...labelGeometries);
    }

    return geometries;
  }

  private computeLabelGeometry(start: Point, end: Point): Geometry[] {
    const labels: TextGeometry[] = [];
    const labelPosition = midpoint(start, end);
    const offset = 15; // pixels above the line

    // Calculate label text
    const labelParts: string[] = [];

    if (this._trendLineOptions.showAngle) {
      const angle = getLineAngleDegrees(start, end);
      labelParts.push(`${angle.toFixed(1)}°`);
    }

    if (this._trendLineOptions.showPriceChange) {
      const { absolute } = this.getPriceChange();
      const sign = absolute >= 0 ? '+' : '';
      labelParts.push(`${sign}${formatPrice(absolute)}`);
    }

    if (this._trendLineOptions.showPercentChange) {
      const { percentage } = this.getPriceChange();
      const sign = percentage >= 0 ? '+' : '';
      labelParts.push(`${sign}${percentage.toFixed(2)}%`);
    }

    if (this._trendLineOptions.showBars) {
      const bars = this.getTimeSpan();
      labelParts.push(`${bars} bars`);
    }

    if (labelParts.length > 0) {
      labels.push({
        type: 'text',
        position: { x: labelPosition.x, y: labelPosition.y - offset },
        text: labelParts.join(' | '),
        font: this._style.labelFont,
        color: this._style.labelColor,
        align: 'center',
        baseline: 'bottom',
      });
    }

    return labels;
  }

  // ============ Clone ============

  clone(newId: string): IDrawing {
    return new TrendLine(
      newId,
      [...this._anchors],
      { ...this._style },
      { ...this._trendLineOptions }
    );
  }

  // ============ Serialization ============

  override toJSON() {
    const base = super.toJSON();
    return {
      ...base,
      options: { ...this._trendLineOptions },
    };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) {
      this._trendLineOptions = { ...this._trendLineOptions, ...data.options };
    }
  }

  // ============ Static Factory ============

  static create(
    id: string,
    startAnchor: Anchor,
    endAnchor: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<TrendLineOptions>
  ): TrendLine {
    return new TrendLine(id, [startAnchor, endAnchor], style, options);
  }
}
