import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { drawControlPoints } from '../../rendering/canvas-utils';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PatternDrawing } from '../patterns/pattern-base';
import { PATTERN_LABEL_FONT_FAMILY } from '../patterns/xabcd-pattern-pane-view';
import { findNearestBarIndex, resolveSeriesBars, timeToKey } from './data-utils';
import type { SeriesDatumLike } from './data-utils';

export interface ForecastOptions extends DrawingOptions {
  visibility?: VisibilityMap;
  sourceTextColor: string;
  sourceBackColor: string;
  sourceStrokeColor: string;
  targetTextColor: string;
  targetBackColor: string;
  targetStrokeColor: string;
  successTextColor: string;
  successBackground: string;
  failureTextColor: string;
  failureBackground: string;
  /** Percent of see-through applied to the boxes and badges. */
  transparency: number;
  centersColor: string;
}

/** 0 while the target time has not been reached, 1 when the target price was hit by then, 2 when it was missed. */
export type ForecastStatus = 0 | 1 | 2;

export const FORECAST_COLOR = '#2962FF';

const DEFAULT_OPTIONS: ForecastOptions = {
  sourceTextColor: '#ffffff',
  sourceBackColor: FORECAST_COLOR,
  sourceStrokeColor: FORECAST_COLOR,
  targetTextColor: '#ffffff',
  targetBackColor: FORECAST_COLOR,
  targetStrokeColor: FORECAST_COLOR,
  successTextColor: '#ffffff',
  successBackground: '#4caf50',
  failureTextColor: '#ffffff',
  failureBackground: '#F23645',
  transparency: 10,
  centersColor: '#000000',
};

const MINUS = '\u2212';
const BOX_OFFSET_X = 20.5;
const TAIL_H = 5;
const TAIL_HALF = 5.3;
const BODY_GAP = 10;
const RADIUS = 4;
const PAD_X = 6.4;
const TEXT_X = 6.8;
const HEADER_H = 18;
const HEADER_GAP = 1.5;
const SOURCE_H = 33.5;
const TARGET_H = 39.5;
const HIT = 6;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Box {
  rect: Rect;
  /** The box hangs below its anchor, so its pointer is on the top edge. */
  below: boolean;
  anchorX: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export class Forecast extends PatternDrawing<ForecastOptions> {
  readonly type = 'forecast';
  protected _patternOptions: ForecastOptions;

  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;
  /** Where the two boxes and the badge were last painted, for picking. */
  hitRects: Rect[] = [];

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ForecastOptions> = {}) {
    super(id, anchors, { lineColor: FORECAST_COLOR, lineWidth: 1, ...style }, {
      ...(options.visible !== undefined ? { visible: options.visible } : {}),
      ...(options.locked !== undefined ? { locked: options.locked } : {}),
    });
    this._patternOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  get forecastOptions(): ForecastOptions {
    return this._patternOptions;
  }

  setForecastOptions(options: Partial<ForecastOptions>): void {
    this.updatePatternOptions(options);
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._patternOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._patternOptions, visible: this._options.visible, locked: this._options.locked } };
  }

  override isValid(): boolean {
    return this._anchors.length >= 2;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new ForecastPaneView(this)];
  }

  override computeGeometry(): never[] {
    return [];
  }

  override autoscaleInfo(): null {
    return null;
  }

  /** Whether the forecast expects the price to rise. */
  private get rising(): boolean {
    return this._anchors[1].price >= this._anchors[0].price;
  }

  /** Judged on the bar that carries the target time: did its range reach the target price. */
  getStatus(): ForecastStatus {
    if (!this.isValid() || !this._series) return 0;
    const bars = resolveSeriesBars(this._series.data() as unknown as readonly SeriesDatumLike[]);
    if (!bars.length) return 0;
    const [a, b] = this._anchors;
    if (timeToKey(b.time) > timeToKey(bars[bars.length - 1].time)) return 0;
    const i = findNearestBarIndex(bars, b.time);
    if (i < 0) return 0;
    const delta = b.price - a.price;
    if (delta > 0) return bars[i].high >= b.price ? 1 : 2;
    if (delta < 0) return bars[i].low <= b.price ? 1 : 2;
    return 2;
  }

  private formatPrice(value: number): string {
    return this._series ? this._series.priceFormatter().format(value) : value.toFixed(2);
  }

  private formatDate(anchor: Anchor): string {
    const d = new Date(timeToKey(anchor.time) * 1000);
    const date = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    const unit = this._interval?.unit;
    return unit === 'minutes' || unit === 'hours' ? `${date} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}` : date;
  }

  private formatSpan(): string {
    const seconds = timeToKey(this._anchors[1].time) - timeToKey(this._anchors[0].time);
    const total = Math.round(Math.abs(seconds) / 60);
    const d = Math.floor(total / 1440);
    const h = Math.floor((total % 1440) / 60);
    const m = total % 60;
    const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean);
    const text = parts.length ? parts.join(' ') : '0m';
    return seconds < 0 ? `-${text}` : text;
  }

  /** The text of the two boxes; the second target line is the price and the date, drawn around a clock. */
  getTexts(): { source: [string, string]; target: [string, string, string] } | null {
    if (!this.isValid()) return null;
    const [a, b] = this._anchors;
    const change = b.price - a.price;
    const percent = a.price !== 0 ? (change / a.price) * 100 : 0;
    const sign = (n: number) => (n < 0 ? MINUS : '');
    return {
      source: [this.formatPrice(a.price), this.formatDate(a)],
      target: [
        `${sign(change)}${this.formatPrice(Math.abs(change))} (${sign(percent)}${Math.abs(percent).toFixed(2)}%) in ${this.formatSpan()}`,
        this.formatPrice(b.price),
        this.formatDate(b),
      ],
    };
  }

  anchorPixels(viewport: Viewport): [Point, Point] | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    return a && b ? [a, b] : null;
  }

  /** Control point of the quadratic curve that leaves the source flat and lands on the target nearly upright. */
  private control(p1: Point, p2: Point): Point {
    return { x: p1.x + (p2.x - p1.x) * 1.04, y: p1.y + (p2.y - p1.y) * 0.1 };
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const pixels = this.anchorPixels(viewport);
    if (!pixels) return false;
    const [p1, p2] = pixels;
    const c = this.control(p1, p2);
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40;
      const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * c.x + t * t * p2.x;
      const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * c.y + t * t * p2.y;
      if (Math.hypot(point.x - x, point.y - y) <= HIT) return true;
    }
    return this.hitRects.some((r) => point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h);
  }

  override clone(newId: string): IDrawing {
    return new Forecast(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }

  static create(id: string, startAnchor: Anchor, targetAnchor: Anchor, style?: Partial<DrawingStyle>, options?: Partial<ForecastOptions>): Forecast {
    return new Forecast(id, [startAnchor, targetAnchor], style, options);
  }

  /** Whether the shape is drawn over the candles: while it is being worked on, not once it rests. */
  isRaised(): boolean {
    return this.state === 'selected' || this.state === 'editing' || this.state === 'hovered' || this.placedCount !== null;
  }

  paint(scope: BitmapCoordinatesRenderingScope, viewport: Viewport): void {
    const pixels = this.anchorPixels(viewport);
    const texts = this.getTexts();
    if (!pixels || !texts) return;
    const [p1, p2] = pixels;
    const o = this._patternOptions;
    const { context: ctx, horizontalPixelRatio: pr, verticalPixelRatio: vr } = scope;
    const rising = this.rising;
    const alpha = Math.max(0, Math.min(1, 1 - o.transparency / 100));
    const family = PATTERN_LABEL_FONT_FAMILY;

    ctx.save();
    ctx.scale(pr, vr);
    this.hitRects = [];

    const c = this.control(p1, p2);
    ctx.strokeStyle = this._style.lineColor;
    ctx.lineWidth = this._style.lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(c.x, c.y, p2.x, p2.y);
    ctx.stroke();
    const angle = Math.atan2(p2.y - c.y, p2.x - c.x);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    ctx.fillStyle = this._style.lineColor;
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - ux * 8 - uy * 3.75, p2.y - uy * 8 + ux * 3.75);
    ctx.lineTo(p2.x - ux * 8 + uy * 3.75, p2.y - uy * 8 - ux * 3.75);
    ctx.closePath();
    ctx.fill();

    const measure = (text: string, size: number) => {
      ctx.font = `${size}px ${family}`;
      return ctx.measureText(text).width;
    };
    const CLOCK = 10;
    const CLOCK_GAP = 4;
    const [headline, targetPrice, targetDate] = texts.target;
    const sourceW = Math.max(measure(texts.source[0], 12.3), measure(texts.source[1], 10)) + 2 * PAD_X;
    const sub2W = measure(targetPrice, 10) + CLOCK_GAP + CLOCK + CLOCK_GAP + measure(targetDate, 10);
    const targetW = Math.max(measure(headline, 14.5), sub2W) + 2 * PAD_X;

    // The source hangs on the side away from the move; the target sits ahead of it.
    const source = this.placeBox(p1, sourceW, SOURCE_H, rising);
    const target = this.placeBox(p2, targetW, TARGET_H, !rising);
    this.hitRects.push(source.rect, target.rect);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    this.drawBox(ctx, source, o.sourceBackColor, o.sourceStrokeColor, alpha);
    ctx.fillStyle = o.sourceTextColor;
    ctx.font = `12.3px ${family}`;
    ctx.fillText(texts.source[0], source.rect.x + TEXT_X, source.rect.y + 10.75 + 0.5);
    ctx.font = `10px ${family}`;
    ctx.fillText(texts.source[1], source.rect.x + TEXT_X, source.rect.y + 23.25 + 0.5);

    this.drawBox(ctx, target, o.targetBackColor, o.targetStrokeColor, alpha);
    ctx.fillStyle = o.targetTextColor;
    ctx.font = `14.5px ${family}`;
    ctx.fillText(headline, target.rect.x + TEXT_X, target.rect.y + 12.8 + 0.5);
    ctx.font = `10px ${family}`;
    const y2 = target.rect.y + 28.2 + 0.5;
    let x = target.rect.x + TEXT_X;
    ctx.fillText(targetPrice, x, y2);
    x += measure(targetPrice, 10) + CLOCK_GAP;
    this.drawClock(ctx, x + CLOCK / 2, y2 - 0.5, CLOCK / 2, o.targetBackColor);
    x += CLOCK + CLOCK_GAP;
    ctx.fillStyle = o.targetTextColor;
    ctx.font = `10px ${family}`;
    ctx.fillText(targetDate, x, y2);

    const status = this.getStatus();
    if (status !== 0) this.drawBadge(ctx, target, status, alpha, rising);

    ctx.restore();

    const resting = this.state !== 'selected' && this.state !== 'editing' && this.state !== 'hovered' && this.placedCount === null;
    if (resting) {
      ctx.save();
      ctx.fillStyle = o.centersColor;
      for (const p of [p1, p2]) {
        ctx.beginPath();
        ctx.arc(p.x * pr, p.y * vr, 3 * pr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /** The box hangs below its anchor when `below`, else sits above it. */
  private placeBox(anchor: Point, w: number, h: number, below: boolean): Box {
    const x = anchor.x - BOX_OFFSET_X;
    const y = below ? anchor.y + BODY_GAP : anchor.y - BODY_GAP - h;
    return { rect: { x, y, w, h }, below, anchorX: anchor.x };
  }

  private drawBox(ctx: CanvasRenderingContext2D, box: Box, fill: string, stroke: string, alpha: number): void {
    const { x, y, w, h } = box.rect;
    const r = RADIUS;
    const tx = Math.max(x + r + TAIL_HALF, Math.min(box.anchorX, x + w - r - TAIL_HALF));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    if (box.below) {
      ctx.lineTo(tx - TAIL_HALF, y);
      ctx.lineTo(tx, y - TAIL_H);
      ctx.lineTo(tx + TAIL_HALF, y);
    }
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    if (!box.below) {
      ctx.lineTo(tx + TAIL_HALF, y + h);
      ctx.lineTo(tx, y + h + TAIL_H);
      ctx.lineTo(tx - TAIL_HALF, y + h);
    }
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  private drawClock(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, hand: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hand;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.6);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + r * 0.45, cy + r * 0.25);
    ctx.stroke();
    ctx.restore();
  }

  /** The SUCCESS / FAILURE tab above (or, for a falling forecast, below) the target box. */
  private drawBadge(ctx: CanvasRenderingContext2D, target: Box, status: 1 | 2, alpha: number, rising: boolean): void {
    const o = this._patternOptions;
    const { x, y, w, h } = target.rect;
    const by = rising ? y - HEADER_GAP - HEADER_H : y + h + HEADER_GAP;
    const ok = status === 1;
    this.hitRects.push({ x, y: by, w, h: HEADER_H });

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ok ? o.successBackground : o.failureBackground;
    ctx.beginPath();
    ctx.roundRect(x, by, w, HEADER_H, RADIUS);
    ctx.fill();
    ctx.restore();

    const label = ok ? 'SUCCESS' : 'FAILURE';
    ctx.font = `bold 14px ${PATTERN_LABEL_FONT_FAMILY}`;
    ctx.fillStyle = ok ? o.successTextColor : o.failureTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = x + w / 2;
    const cy = by + HEADER_H / 2;
    ctx.fillText(label, cx, cy + 0.5);
    const iconX = cx - ctx.measureText(label).width / 2 - 4 - 5.5;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (ok) {
      ctx.moveTo(iconX - 4.5, cy + 0.5);
      ctx.lineTo(iconX - 1.5, cy + 3.5);
      ctx.lineTo(iconX + 4.5, cy - 3.5);
    } else {
      ctx.arc(iconX, cy, 5.5, 0, Math.PI * 2);
      ctx.moveTo(iconX - 2.5, cy + 3);
      ctx.quadraticCurveTo(iconX, cy + 0.8, iconX + 2.5, cy + 3);
    }
    ctx.stroke();
    if (!ok) {
      ctx.beginPath();
      ctx.arc(iconX - 2, cy - 1.5, 0.9, 0, Math.PI * 2);
      ctx.arc(iconX + 2, cy - 1.5, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

class ForecastPaneView implements IPrimitivePaneView {
  private readonly _renderer: ForecastPaneRenderer;

  constructor(private readonly _drawing: Forecast) {
    this._renderer = new ForecastPaneRenderer(_drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._drawing.isRaised() ? 'top' : 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class ForecastPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: Forecast) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const drawing = this._drawing;
      const viewport = drawing.getViewport();
      if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;
      drawing.paint(scope, viewport);
      if (drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered') {
        drawControlPoints(scope.context, drawing.getControlPoints(viewport), null, scope.horizontalPixelRatio, FORECAST_COLOR);
      }
    });
  }
}
