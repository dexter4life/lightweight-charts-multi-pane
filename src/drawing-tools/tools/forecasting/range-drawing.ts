import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';
import type { ISeriesApi } from '../../../api/iseries-api';
import type { SeriesType } from '../../../model/series-options';

import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { drawControlPoints } from '../../rendering/canvas-utils';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PatternDrawing } from '../patterns/pattern-base';
import { PATTERN_LABEL_FONT_FAMILY } from '../patterns/xabcd-pattern-pane-view';
import { timeToKey } from './data-utils';
import { computeMeasureInfo, formatVolume } from './measure';
import type { MeasureInfo } from './measure';

export interface RangeCustomText {
  visible: boolean;
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

export interface RangeOptions extends DrawingOptions {
  visibility?: VisibilityMap;
  fillBackground: boolean;
  /** Date Range: the side lines run to the pane edge. */
  extendTop: boolean;
  extendBottom: boolean;
  /** Date and Price Range: outlines the box. */
  drawBorder: boolean;
  borderColor: string;
  borderWidth: number;
  labelSize: number;
  labelColor: string;
  fillLabel: boolean;
  labelBackground: string;
  customText: RangeCustomText;
}

export type RangeKind = 'date' | 'price' | 'date-price';

export const RANGE_COLOR = '#2962FF';
export const RANGE_FILL = 'rgba(41, 98, 255, 0.15)';

const DEFAULT_TEXT: RangeCustomText = { visible: false, text: '', color: RANGE_COLOR, fontSize: 12, bold: false, italic: false };

const DEFAULT_OPTIONS: RangeOptions = {
  fillBackground: true,
  extendTop: false,
  extendBottom: false,
  extendLeft: false,
  extendRight: false,
  drawBorder: false,
  borderColor: RANGE_COLOR,
  borderWidth: 1,
  labelSize: 12,
  labelColor: '#000000',
  fillLabel: true,
  labelBackground: '#ffffff',
  customText: DEFAULT_TEXT,
};

const MINUS = '\u2212';
const LABEL_GAP = 10;
const LABEL_PAD_X = 9.5;
const LABEL_PAD_Y = 5;
const LABEL_PITCH = 20;
const LABEL_RADIUS = 6;
const ARROW = 5;
const TEXT_GAP = 8;
const HIT = 6;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Shared base of Date Range, Price Range and Date and Price Range: two anchors span a box that reports what it covers. */
export abstract class RangeDrawing extends PatternDrawing<RangeOptions> {
  protected _patternOptions: RangeOptions;
  protected abstract readonly kind: RangeKind;

  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;
  private _volumeSeries: ISeriesApi<SeriesType> | null = null;
  /** Where the summary label was last painted, for picking. */
  labelRect: Rect | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<RangeOptions> = {}) {
    super(id, anchors, { lineColor: RANGE_COLOR, lineWidth: 1, fillColor: RANGE_FILL, ...style }, {
      ...(options.visible !== undefined ? { visible: options.visible } : {}),
      ...(options.locked !== undefined ? { locked: options.locked } : {}),
    });
    this._patternOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
      customText: { ...DEFAULT_TEXT, ...options.customText },
    };
  }

  get rangeOptions(): RangeOptions {
    return this._patternOptions;
  }

  setRangeOptions(options: Partial<RangeOptions>): void {
    const { customText, ...rest } = options;
    this.updatePatternOptions({
      ...rest,
      ...(customText ? { customText: { ...this._patternOptions.customText, ...customText } } : {}),
    });
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  setVolumeSeries(series: ISeriesApi<SeriesType> | null): void {
    this._volumeSeries = series;
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
    return [new RangePaneView(this)];
  }

  override computeGeometry(): never[] {
    return [];
  }

  override autoscaleInfo(): null {
    return null;
  }

  getInfo(): MeasureInfo | null {
    if (!this.isValid() || !this._series) return null;
    return computeMeasureInfo(this._series, this._volumeSeries, this._anchors[0], this._anchors[1]);
  }

  /** Whether the second point lies after the first in time. */
  private forward(): boolean {
    return timeToKey(this._anchors[1].time) >= timeToKey(this._anchors[0].time);
  }

  private formatPrice(value: number): string {
    return this._series ? this._series.priceFormatter().format(value) : value.toFixed(2);
  }

  /** Lines of the summary label. */
  getLabelLines(): string[] {
    const info = this.getInfo();
    if (!info) return [];
    const sign = (n: number) => (n < 0 ? MINUS : '');
    const lines: string[] = [];
    if (this.kind !== 'date') {
      lines.push(
        `${sign(info.priceChange)}${this.formatPrice(Math.abs(info.priceChange))} (${sign(info.percent)}${Math.abs(info.percent).toFixed(2)}%) ${sign(info.ticks)}${Math.abs(info.ticks)}`
      );
    }
    if (this.kind !== 'price') {
      const neg = this.forward() ? '' : '-';
      lines.push(`${neg}${info.bars} bars, ${neg}${info.duration}`);
      if (info.volume !== null) lines.push(`Vol ${formatVolume(info.volume)}`);
    }
    return lines;
  }

  /** Pixel positions of the two anchors, or null while either is off-screen. */
  anchorPixels(viewport: Viewport): [Point, Point] | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    return a && b ? [a, b] : null;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const pixels = this.anchorPixels(viewport);
    if (!pixels) return false;
    const [a, b] = pixels;
    const o = this._patternOptions;
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    const inBox = point.x >= left - HIT && point.x <= right + HIT && point.y >= top - HIT && point.y <= bottom + HIT;
    if (inBox) return true;

    if (this.kind === 'date') {
      const y0 = o.extendTop ? 0 : top;
      const y1 = o.extendBottom ? viewport.height : bottom;
      if (point.y >= y0 - HIT && point.y <= y1 + HIT && (Math.abs(point.x - left) <= HIT || Math.abs(point.x - right) <= HIT)) return true;
    }
    if (this.kind === 'price') {
      const x0 = o.extendLeft ? 0 : left;
      const x1 = o.extendRight ? viewport.width : right;
      if (point.x >= x0 - HIT && point.x <= x1 + HIT && (Math.abs(point.y - top) <= HIT || Math.abs(point.y - bottom) <= HIT)) return true;
    }
    const l = this.labelRect;
    return !!l && point.x >= l.x && point.x <= l.x + l.w && point.y >= l.y && point.y <= l.y + l.h;
  }

  override clone(newId: string): IDrawing {
    const copy = this.create(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions, customText: { ...this._patternOptions.customText } });
    copy.setVolumeSeries(this._volumeSeries);
    return copy;
  }

  protected abstract create(id: string, anchors: Anchor[], style: Partial<DrawingStyle>, options: Partial<RangeOptions>): RangeDrawing;

  /** Whether the shape is drawn over the candles: while it is being worked on, not once it rests. */
  isRaised(): boolean {
    return this.state === 'selected' || this.state === 'editing' || this.state === 'hovered' || this.placedCount !== null;
  }

  paint(scope: BitmapCoordinatesRenderingScope, viewport: Viewport): void {
    const pixels = this.anchorPixels(viewport);
    if (!pixels) return;
    const [p1, p2] = pixels;
    const o = this._patternOptions;
    const { context: ctx, horizontalPixelRatio: pr, verticalPixelRatio: vr } = scope;
    const hx = (x: number) => Math.round(x * pr);
    const vy = (y: number) => Math.round(y * vr);
    const lw = Math.max(1, Math.round(this._style.lineWidth * pr));
    const snap = (v: number) => Math.round(v - lw / 2) + lw / 2;

    const left = hx(Math.min(p1.x, p2.x));
    const right = hx(Math.max(p1.x, p2.x));
    const top = vy(Math.min(p1.y, p2.y));
    const bottom = vy(Math.max(p1.y, p2.y));
    const paneW = Math.round(viewport.width * pr);
    const paneH = Math.round(viewport.height * vr);

    ctx.save();
    // Extending a side line widens the shaded area with it.
    const fillTop = this.kind === 'date' && o.extendTop ? 0 : top;
    const fillBottom = this.kind === 'date' && o.extendBottom ? paneH : bottom;
    const fillLeft = this.kind === 'price' && o.extendLeft ? 0 : left;
    const fillRight = this.kind === 'price' && o.extendRight ? paneW : right;
    if (o.fillBackground) {
      ctx.fillStyle = this._style.fillColor ?? RANGE_FILL;
      ctx.fillRect(fillLeft, fillTop, fillRight - fillLeft, fillBottom - fillTop);
    }

    ctx.strokeStyle = this._style.lineColor;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    ctx.setLineDash([]);

    if (this.kind === 'date') {
      const y0 = o.extendTop ? 0 : top;
      const y1 = o.extendBottom ? paneH : bottom;
      ctx.beginPath();
      ctx.moveTo(snap(left), y0);
      ctx.lineTo(snap(left), y1);
      ctx.moveTo(snap(right), y0);
      ctx.lineTo(snap(right), y1);
      ctx.stroke();
    } else if (this.kind === 'price') {
      const x0 = o.extendLeft ? 0 : left;
      const x1 = o.extendRight ? paneW : right;
      ctx.beginPath();
      ctx.moveTo(x0, snap(top));
      ctx.lineTo(x1, snap(top));
      ctx.moveTo(x0, snap(bottom));
      ctx.lineTo(x1, snap(bottom));
      ctx.stroke();
    } else if (o.drawBorder) {
      const bw = Math.max(1, Math.round(o.borderWidth * pr));
      ctx.strokeStyle = o.borderColor;
      ctx.lineWidth = bw;
      ctx.strokeRect(left + bw / 2, top + bw / 2, right - left - bw, bottom - top - bw);
      ctx.strokeStyle = this._style.lineColor;
      ctx.lineWidth = lw;
    }

    const arrow = ARROW * pr;
    const text = o.customText.visible && o.customText.text.trim() ? o.customText : null;
    let textBox: { w: number; h: number; lines: string[] } | null = null;
    if (text) {
      ctx.font = this.customFont(text, vr);
      const lines = text.text.split('\n');
      textBox = { w: Math.max(...lines.map((t) => ctx.measureText(t).width)), h: lines.length * text.fontSize * 1.2 * vr, lines };
    }

    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;
    if (this.kind !== 'price') {
      const dir = p2.x >= p1.x ? 1 : -1;
      const x1 = hx(p1.x);
      const x2 = hx(p2.x);
      const y = snap(midY);
      const gap = textBox ? textBox.w / 2 + TEXT_GAP * pr : 0;
      ctx.beginPath();
      if (textBox && Math.abs(x2 - x1) > gap * 2) {
        const cx = (x1 + x2) / 2;
        ctx.moveTo(x1, y);
        ctx.lineTo(cx - dir * gap, y);
        ctx.moveTo(cx + dir * gap, y);
      } else {
        ctx.moveTo(x1, y);
      }
      ctx.lineTo(x2, y);
      ctx.moveTo(x2 - dir * arrow, y - arrow);
      ctx.lineTo(x2, y);
      ctx.lineTo(x2 - dir * arrow, y + arrow);
      ctx.stroke();
    }
    if (this.kind !== 'date') {
      const dir = p2.y >= p1.y ? 1 : -1;
      const y1 = vy(p1.y);
      const y2 = vy(p2.y);
      const x = snap(midX);
      const gap = textBox && this.kind === 'price' ? textBox.h / 2 + TEXT_GAP * vr : 0;
      ctx.beginPath();
      if (gap && Math.abs(y2 - y1) > gap * 2) {
        const cy = (y1 + y2) / 2;
        ctx.moveTo(x, y1);
        ctx.lineTo(x, cy - dir * gap);
        ctx.moveTo(x, cy + dir * gap);
      } else {
        ctx.moveTo(x, y1);
      }
      ctx.lineTo(x, y2);
      ctx.moveTo(x - arrow, y2 - dir * arrow);
      ctx.lineTo(x, y2);
      ctx.lineTo(x + arrow, y2 - dir * arrow);
      ctx.stroke();
    }

    if (text && textBox) {
      ctx.fillStyle = text.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pitch = text.fontSize * 1.2 * vr;
      textBox.lines.forEach((line, i) => ctx.fillText(line, midX, midY - textBox!.h / 2 + pitch * (i + 0.5)));
    }

    this.drawLabel(scope, viewport, Math.min(p1.x, p2.x), Math.max(p1.x, p2.x), Math.min(p1.y, p2.y), Math.max(p1.y, p2.y), p2.y <= p1.y);
    ctx.restore();
  }

  private customFont(t: RangeCustomText, vr: number): string {
    return `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.fontSize * vr}px ${PATTERN_LABEL_FONT_FAMILY}`;
  }

  private drawLabel(scope: BitmapCoordinatesRenderingScope, viewport: Viewport, left: number, right: number, top: number, bottom: number, up: boolean): void {
    const lines = this.getLabelLines();
    this.labelRect = null;
    if (!lines.length) return;
    const o = this._patternOptions;
    const { context: ctx, horizontalPixelRatio: pr, verticalPixelRatio: vr } = scope;
    const size = o.labelSize;
    const pitch = Math.max(LABEL_PITCH, size * (LABEL_PITCH / 12));
    ctx.font = `${size * vr}px ${PATTERN_LABEL_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textW = Math.max(...lines.map((t) => ctx.measureText(t).width)) / pr;
    const w = Math.ceil(textW + 2 * LABEL_PAD_X);
    const h = lines.length * pitch + 2 * LABEL_PAD_Y;
    const cx = (left + right) / 2;
    let y = up ? top - LABEL_GAP - h : bottom + LABEL_GAP;
    y = Math.max(0, Math.min(y, viewport.height - h));
    const x = cx - w / 2;
    this.labelRect = { x, y, w, h };

    if (o.fillLabel) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 4 * pr;
      ctx.shadowOffsetY = vr;
      ctx.fillStyle = o.labelBackground;
      ctx.beginPath();
      ctx.roundRect(Math.round(x * pr), Math.round(y * vr), w * pr, h * vr, LABEL_RADIUS * pr);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = o.labelColor;
    lines.forEach((line, i) => {
      ctx.fillText(line, cx * pr, (y + LABEL_PAD_Y + pitch * (i + 0.5)) * vr + 0.5 * vr);
    });
  }
}

class RangePaneView implements IPrimitivePaneView {
  private readonly _renderer: RangePaneRenderer;

  constructor(private readonly _drawing: RangeDrawing) {
    this._renderer = new RangePaneRenderer(_drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._drawing.isRaised() ? 'top' : 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class RangePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: RangeDrawing) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const drawing = this._drawing;
      const viewport = drawing.getViewport();
      if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;
      drawing.paint(scope, viewport);
      if (drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered') {
        drawControlPoints(scope.context, drawing.getControlPoints(viewport), null, scope.horizontalPixelRatio, RANGE_COLOR);
      }
    });
  }
}
