import type { IPrimitivePaneView } from '../../../model/ipane-primitive';
import type { Logical } from '../../../model/time-data';

import { Drawing } from '../../core/drawing';
import type { PriceTag } from '../../core/drawing';
import { createFractionalMapper } from '../../core/fractional-logical';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PositionPaneView } from './position-pane-view';

export type RiskDisplayMode = 'percents' | 'money';

export interface PositionOptions extends DrawingOptions {
  /** Distances of the take-profit and stop levels from the entry, in ticks; filled in when the drawing is first attached. */
  profitTicks?: number;
  stopTicks?: number;
  tickSize?: number;
  accountSize?: number;
  lotSize?: number;
  risk?: number;
  riskDisplayMode?: RiskDisplayMode;
  compact?: boolean;
  alwaysShowStats?: boolean;
  showPriceLabels?: boolean;
  textColor?: string;
  fontSize?: number;
  profitBackground?: string;
  stopBackground?: string;
  fillBackground?: boolean;
  drawBorder?: boolean;
  borderColor?: string;
  visibility?: VisibilityMap;
}

export const POSITION_LINE_COLOR = '#787B86';
export const POSITION_PROFIT_BACKGROUND = 'rgba(8, 153, 129, 0.2)';
export const POSITION_STOP_BACKGROUND = 'rgba(242, 54, 69, 0.2)';
const DEFAULT_WIDTH_SHARE = 0.15;
const FALLBACK_WIDTH_BARS = 25;
const DEFAULT_RANGE_SHARE = 0.2;

export const CP_ENTRY = 0;
export const CP_RIGHT = 1;
export const CP_TARGET = 2;
export const CP_STOP = 3;

interface Bar {
  time: unknown;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  value?: number;
}

export interface PositionStats {
  entry: number;
  profitPrice: number;
  stopPrice: number;
  profitDistance: number;
  stopDistance: number;
  profitTicks: number;
  stopTicks: number;
  qty: number;
  amountTarget: number;
  amountStop: number;
  riskReward: number;
  pnl: number;
  closed: boolean;
  /** Where the dashed progress line ends: the bar that closed the trade, or the last bar inside the box. */
  exit: { logical: number; price: number } | null;
}

/** Shared model of the Long / Short Position tools: an entry point, a width and take-profit / stop levels in ticks. */
export abstract class PositionDrawing extends Drawing {
  /** +1 when the take-profit lies above the entry (long), -1 below (short). */
  protected abstract readonly direction: 1 | -1;

  protected _positionOptions: PositionOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<PositionOptions> = {}
  ) {
    const {
      profitTicks,
      stopTicks,
      tickSize,
      accountSize,
      lotSize,
      risk,
      riskDisplayMode,
      compact,
      alwaysShowStats,
      showPriceLabels,
      textColor,
      fontSize,
      profitBackground,
      stopBackground,
      fillBackground,
      drawBorder,
      borderColor,
      visibility,
      ...baseOptions
    } = options;
    super(id, anchors, { lineColor: POSITION_LINE_COLOR, lineWidth: 1, ...style }, baseOptions);

    this._positionOptions = {
      ...this._options,
      profitTicks,
      stopTicks,
      tickSize,
      accountSize: accountSize ?? 1000,
      lotSize: lotSize ?? 1,
      risk: risk ?? 25,
      riskDisplayMode: riskDisplayMode ?? 'percents',
      compact: compact ?? false,
      alwaysShowStats: alwaysShowStats ?? false,
      showPriceLabels: showPriceLabels ?? true,
      textColor: textColor ?? '#ffffff',
      fontSize: fontSize ?? 12,
      profitBackground: profitBackground ?? POSITION_PROFIT_BACKGROUND,
      stopBackground: stopBackground ?? POSITION_STOP_BACKGROUND,
      fillBackground: fillBackground ?? true,
      drawBorder: drawBorder ?? false,
      borderColor: borderColor ?? '#667b8b',
      visibility,
    };
  }

  get positionOptions(): PositionOptions {
    return this._positionOptions;
  }

  get side(): 1 | -1 {
    return this.direction;
  }

  setPositionOptions(options: Partial<PositionOptions>): void {
    this._positionOptions = { ...this._positionOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._positionOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override toJSON(): SerializedDrawing {
    return { ...super.toJSON(), options: { ...this._positionOptions, visible: this._options.visible, locked: this._options.locked } };
  }

  override isValid(): boolean {
    return this._anchors.length >= 2 && this._positionOptions.profitTicks !== undefined;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new PositionPaneView(this)];
  }

  override autoscaleInfo(): null {
    return null;
  }

  override showsPriceBand(): boolean {
    return false;
  }

  /** Placing a position takes one click; the width and the levels are filled in as soon as the chart is known. */
  override attached(params: Parameters<Drawing['attached']>[0]): void {
    super.attached(params);
    this.initialise();
  }

  // ============ Data helpers ============

  private bars(): Bar[] {
    return (this._series?.data() as unknown as Bar[] | undefined) ?? [];
  }

  private tick(): number {
    const stored = this._positionOptions.tickSize;
    if (stored) return stored;
    const minMove = (this._series?.options() as { priceFormat?: { minMove?: number } } | undefined)?.priceFormat?.minMove;
    return minMove && minMove > 0 ? minMove : 0.01;
  }

  private indexOfTime(bars: Bar[], time: unknown): number | null {
    if (typeof time === 'number') {
      let lo = 0;
      let hi = bars.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const t = bars[mid].time as number;
        if (t === time) return mid;
        if (t < time) lo = mid + 1;
        else hi = mid - 1;
      }
      return null;
    }
    const i = bars.findIndex((b) => b.time === time);
    return i < 0 ? null : i;
  }

  /** Time of a (possibly future) bar index; numeric times extrapolate with the spacing of the last bars. */
  timeAtLogical(logical: number, bars: Bar[] = this.bars()): Anchor['time'] | null {
    const n = bars.length;
    if (!n) return null;
    const i = Math.round(logical);
    if (i >= 0 && i < n) return bars[i].time as Anchor['time'];
    const edge = bars[i < 0 ? 0 : n - 1].time;
    if (typeof edge !== 'number' || n < 2) return edge as Anchor['time'];
    const step = i < 0 ? (bars[1].time as number) - edge : edge - (bars[n - 2].time as number);
    return (edge + (i < 0 ? i : i - (n - 1)) * step) as Anchor['time'];
  }

  private initialise(): void {
    if (!this._series || !this._chart || this._anchors.length === 0) return;
    const bars = this.bars();
    if (!bars.length) return;

    const entry = { ...this._anchors[0] };
    if (entry.logical === undefined) {
      const index = this.indexOfTime(bars, entry.time);
      if (index === null) return;
      entry.logical = index;
    }
    const visible = this._chart.timeScale().getVisibleLogicalRange();
    const widthBars = visible ? Math.max(1, Math.round((visible.to - visible.from) * DEFAULT_WIDTH_SHARE)) : FALLBACK_WIDTH_BARS;
    let right = this._anchors[1];
    if (!right) {
      const logical = entry.logical + widthBars;
      right = { time: this.timeAtLogical(logical, bars) ?? entry.time, price: entry.price, logical };
    } else if (right.logical === undefined) {
      right = { ...right, logical: this.indexOfTime(bars, right.time) ?? entry.logical + widthBars };
    }
    this._anchors = [entry, right];

    const opts = this._positionOptions;
    if (opts.tickSize === undefined) opts.tickSize = this.tick();
    if (opts.profitTicks === undefined || opts.stopTicks === undefined) {
      const range = this.visibleRange(bars);
      const ticks = Math.max(1, Math.round((range * DEFAULT_RANGE_SHARE) / opts.tickSize));
      opts.profitTicks ??= ticks;
      opts.stopTicks ??= ticks;
    }
    this.requestUpdate();
  }

  /** High-low span of the bars currently on screen. */
  private visibleRange(bars: Bar[]): number {
    const logical = this._chart?.timeScale().getVisibleLogicalRange();
    const from = Math.max(0, Math.floor(logical?.from ?? 0));
    const to = Math.min(bars.length - 1, Math.ceil(logical?.to ?? bars.length - 1));
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = from; i <= to; i++) {
      hi = Math.max(hi, bars[i].high ?? bars[i].value ?? -Infinity);
      lo = Math.min(lo, bars[i].low ?? bars[i].value ?? Infinity);
    }
    return Number.isFinite(hi - lo) && hi > lo ? hi - lo : this._anchors[0].price * 0.02;
  }

  // ============ Model ============

  levelPrices(): { entry: number; profit: number; stop: number } {
    const o = this._positionOptions;
    const tick = o.tickSize ?? 0.01;
    const entry = this._anchors[0].price;
    return {
      entry,
      profit: entry + this.direction * (o.profitTicks ?? 0) * tick,
      stop: entry - this.direction * (o.stopTicks ?? 0) * tick,
    };
  }

  formatPrice(value: number): string {
    return this._series ? this._series.priceFormatter().format(value) : value.toFixed(2);
  }

  getStats(): PositionStats | null {
    if (!this.isValid()) return null;
    const o = this._positionOptions;
    const tick = o.tickSize ?? 0.01;
    const { entry, profit, stop } = this.levelPrices();
    const profitTicks = o.profitTicks ?? 0;
    const stopTicks = o.stopTicks ?? 0;
    const profitDistance = profitTicks * tick;
    const stopDistance = stopTicks * tick;

    const account = o.accountSize ?? 0;
    const riskAmount = o.riskDisplayMode === 'money' ? (o.risk ?? 0) : (account * (o.risk ?? 0)) / 100;
    const qty = stopDistance > 0 ? riskAmount / (stopDistance * (o.lotSize || 1)) : 0;

    const result: PositionStats = {
      entry,
      profitPrice: profit,
      stopPrice: stop,
      profitDistance,
      stopDistance,
      profitTicks,
      stopTicks,
      qty,
      amountTarget: Math.round(account + qty * profitDistance),
      amountStop: Math.round(account - riskAmount),
      riskReward: stopDistance > 0 ? profitDistance / stopDistance : 0,
      pnl: 0,
      closed: false,
      exit: null,
    };

    const bars = this.bars();
    const first = Math.round(this._anchors[0].logical ?? 0);
    const last = Math.min(bars.length - 1, Math.round(Math.max(this._anchors[0].logical ?? 0, this._anchors[1].logical ?? 0)));
    const d = this.direction;
    for (let i = first + 1; i <= last; i++) {
      const bar = bars[i];
      const high = bar.high ?? bar.value ?? 0;
      const low = bar.low ?? bar.value ?? 0;
      const hitStop = d > 0 ? low <= stop : high >= stop;
      const hitProfit = d > 0 ? high >= profit : low <= profit;
      if (hitStop || hitProfit) {
        result.closed = true;
        result.pnl = hitStop ? -stopDistance : profitDistance;
        result.exit = { logical: i, price: hitStop ? stop : profit };
        return result;
      }
    }
    if (last > first && bars[last]) {
      const close = bars[last].close ?? bars[last].value ?? entry;
      result.pnl = d * (close - entry);
      result.exit = { logical: last, price: close };
    }
    return result;
  }

  // ============ Interaction ============

  private logicalAtX(x: number): number | null {
    return this._chart ? (createFractionalMapper(this._chart.timeScale())?.toLogical(x) ?? null) : null;
  }

  /** Whole-bar anchor under a pixel, including the empty space right of the last bar. */
  anchorAtPixel(point: Point): Anchor | null {
    const price = this._series?.coordinateToPrice(point.y) ?? null;
    const raw = this.logicalAtX(point.x);
    if (price === null || raw === null) return null;
    const logical = Math.round(raw);
    const time = this.timeAtLogical(logical);
    return time === null ? null : { time, price, logical };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    if (!this.isValid() || this._placedCount !== null) return [];
    const entry = this.anchorToPixel(this._anchors[0], viewport);
    const right = this.anchorToPixel(this._anchors[1], viewport);
    const { profit, stop } = this.levelPrices();
    const yProfit = viewport.priceScale.priceToCoordinate(profit);
    const yStop = viewport.priceScale.priceToCoordinate(stop);
    const points: ControlPoint[] = [];
    if (entry) points.push({ index: CP_ENTRY, x: entry.x, y: entry.y, radius: 6 });
    if (entry && right) points.push({ index: CP_RIGHT, x: right.x, y: entry.y, radius: 6 });
    if (entry && yProfit !== null) points.push({ index: CP_TARGET, x: entry.x, y: yProfit, radius: 6 });
    if (entry && yStop !== null) points.push({ index: CP_STOP, x: entry.x, y: yStop, radius: 6 });
    return points;
  }

  private ticksBetween(price: number, from: number): number {
    return Math.max(1, Math.round(Math.abs(price - from) / (this._positionOptions.tickSize ?? 0.01)));
  }

  override dragControlPoint(index: number, point: Point, anchor: Anchor | null): void {
    const target = this.anchorAtPixel(point);
    if (!target) return;
    const price = anchor?.price ?? target.price;
    const entryPrice = this._anchors[0].price;
    const levels = this.levelPrices();

    if (index === CP_ENTRY) {
      // The levels keep their prices; only their distance to the new entry changes.
      this._anchors = [
        { ...target, price },
        { ...this._anchors[1], price },
      ];
      this._positionOptions = {
        ...this._positionOptions,
        profitTicks: this.directionalTicks(levels.profit, price, this.direction),
        stopTicks: this.directionalTicks(levels.stop, price, -this.direction),
      };
    } else if (index === CP_RIGHT) {
      this._anchors = [this._anchors[0], { ...target, price: entryPrice }];
    } else if (index === CP_TARGET) {
      this._positionOptions = { ...this._positionOptions, profitTicks: this.directionalTicks(target.price, entryPrice, this.direction) };
    } else if (index === CP_STOP) {
      this._positionOptions = { ...this._positionOptions, stopTicks: this.directionalTicks(target.price, entryPrice, -this.direction) };
    }
    this.requestUpdate();
  }

  /** Moves the entry (the levels keep their prices) or one level to an exact price, as the settings dialog does. */
  setLevelPrice(which: 'entry' | 'profit' | 'stop', price: number): void {
    if (!Number.isFinite(price) || this._anchors.length < 2) return;
    const levels = this.levelPrices();
    if (which === 'entry') {
      this._anchors = this._anchors.map((a) => ({ ...a, price }));
      this._positionOptions = {
        ...this._positionOptions,
        profitTicks: this.directionalTicks(levels.profit, price, this.direction),
        stopTicks: this.directionalTicks(levels.stop, price, -this.direction),
      };
    } else if (which === 'profit') {
      this._positionOptions = { ...this._positionOptions, profitTicks: this.directionalTicks(price, levels.entry, this.direction) };
    } else {
      this._positionOptions = { ...this._positionOptions, stopTicks: this.directionalTicks(price, levels.entry, -this.direction) };
    }
    this.requestUpdate();
  }

  /** Ticks from `from` to `price` measured along `sign`; never below one tick. */
  private directionalTicks(price: number, from: number, sign: number): number {
    const signed = sign * (price - from);
    return signed <= 0 ? 1 : this.ticksBetween(price, from);
  }

  override bodyDragOrigin(viewport: Viewport): Point[] | null {
    const points = this._anchors.map((a) => this.anchorToPixel(a, viewport));
    return points.every((p): p is Point => p !== null) && points.length === 2 ? points : null;
  }

  override bodyDragAnchors(origin: Point[], dx: number, dy: number): Anchor[] | null {
    const entry = this.anchorAtPixel({ x: origin[0].x + dx, y: origin[0].y + dy });
    const right = this.anchorAtPixel({ x: origin[1].x + dx, y: origin[0].y + dy });
    return entry && right ? [entry, { ...right, price: entry.price }] : null;
  }

  override updateAnchor(index: number, anchor: Anchor): void {
    if (index === 0 && this._anchors[1]) {
      this._anchors = [{ ...anchor }, { ...this._anchors[1], price: anchor.price }];
      this.requestUpdate();
      return;
    }
    super.updateAnchor(index, anchor);
  }

  override setAnchors(anchors: Anchor[]): void {
    const entry = anchors[0];
    this._anchors = anchors.length >= 2 ? [entry, { ...anchors[1], price: entry.price }] : [...anchors];
    this.requestUpdate();
  }

  // ============ Axis tags ============

  override customPriceTags(): PriceTag[] | null {
    if (!this.isValid()) return [];
    if (!this._positionOptions.showPriceLabels) return [];
    const { entry, profit, stop } = this.levelPrices();
    return [
      { price: profit, backColor: '#089981' },
      { price: entry, backColor: POSITION_LINE_COLOR },
      { price: stop, backColor: '#F23645' },
    ];
  }

  // ============ Geometry ============

  override computeGeometry(): never[] {
    return [];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid()) return false;
    const entry = this.anchorToPixel(this._anchors[0], viewport);
    const right = this.anchorToPixel(this._anchors[1], viewport);
    if (!entry || !right) return false;
    const { profit, stop } = this.levelPrices();
    const yProfit = viewport.priceScale.priceToCoordinate(profit);
    const yStop = viewport.priceScale.priceToCoordinate(stop);
    if (yProfit === null || yStop === null) return false;
    const left = Math.min(entry.x, right.x);
    const rightEdge = Math.max(entry.x, right.x);
    return (
      point.x >= left &&
      point.x <= rightEdge &&
      point.y >= Math.min(yProfit, yStop, entry.y) &&
      point.y <= Math.max(yProfit, yStop, entry.y)
    );
  }

  /** Logical position of an anchor on the time scale; used to turn bar indices into pixels. */
  toX(logical: number, viewport: Viewport): number | null {
    return viewport.timeScale.logicalToCoordinate(logical as Logical);
  }
}
