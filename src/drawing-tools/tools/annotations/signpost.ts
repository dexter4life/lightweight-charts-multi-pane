import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, ControlPoint, Point, Viewport, DrawingStyle, DrawingOptions, DrawingState, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { timeToKey } from '../forecasting/data-utils';
import { SignpostPaneView } from './signpost-pane-view';
import { TEXT_FONT_FAMILY } from './text-annotation';

export interface SignpostOptions extends DrawingOptions {
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  emojiPin?: boolean;
  emoji?: string;
  pinColor?: string;
  visibility?: VisibilityMap;
}

export const SIGNPOST_GEOMETRY = {
  height: 26,
  padX: 10,
  radius: 6,
  textDy: 0.75,
  stemColor: '#797B85',
  handleHalf: 4.75,
  emojiRadius: 34,
  emojiGap: 10,
  emojiSize: 32,
} as const;

export interface SignpostLayout {
  x: number;
  /** Label rectangle in pane pixels. */
  box: { x: number; y: number; w: number; h: number };
  /** Pixel of the anchor price (where the handle sits). */
  anchorY: number;
  /** The label hangs below the anchor (the bar is further down), sits above it (the bar is further up) or rests on the bar. */
  side: 'above-bar' | 'below-bar' | 'on-bar';
  stem: { from: number; to: number } | null;
  emoji: { cx: number; cy: number } | null;
}

export interface SignpostBar {
  high: number;
  low: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/**
 * Signpost - a text label on a stem that points at one bar. The anchor price decides how far the label sits from the bar;
 * a price inside the bar's range rests the label on the bar's high.
 */
export class Signpost extends Drawing {
  readonly type = 'signpost';

  protected static readonly REQUIRED_ANCHORS = 1;

  private _signpostOptions: SignpostOptions;
  private _grab: Point | null = null;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<SignpostOptions> = {}) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: SIGNPOST_GEOMETRY.stemColor, ...style }, base);

    this._signpostOptions = {
      ...this._options,
      text: options.text ?? 'Text',
      fontSize: options.fontSize ?? 12,
      bold: options.bold ?? false,
      italic: options.italic ?? false,
      textColor: options.textColor ?? '#1F1F1F',
      backgroundColor: options.backgroundColor ?? '#FFFFFF',
      borderColor: options.borderColor ?? '#E1E3EA',
      emojiPin: options.emojiPin ?? false,
      emoji: options.emoji ?? '🙂',
      pinColor: options.pinColor ?? '#3861F6',
      visibility: options.visibility,
    };
  }

  get signpostOptions(): SignpostOptions {
    return this._signpostOptions;
  }

  setSignpostOptions(options: Partial<SignpostOptions>): void {
    this._signpostOptions = { ...this._signpostOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  setText(text: string): void {
    this.setSignpostOptions({ text });
  }

  getText(): string {
    return this._signpostOptions.text ?? '';
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._signpostOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override showsAxisTags(): boolean {
    return false;
  }

  isValid(): boolean {
    return this._anchors.length >= 1;
  }

  /** High and low of the bar the signpost points at. */
  bar(): SignpostBar | null {
    const series = this._series;
    const anchor = this._anchors[0];
    if (!series || !anchor) return null;
    const data = series.data() as ReadonlyArray<{ time: unknown; high?: number; low?: number; value?: number }>;
    if (data.length === 0) return null;
    const target = timeToKey(anchor.time);
    let lo = 0;
    let hi = data.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (timeToKey(data[mid].time as never) < target) lo = mid + 1;
      else hi = mid;
    }
    const near = lo > 0 && Math.abs(timeToKey(data[lo - 1].time as never) - target) < Math.abs(timeToKey(data[lo].time as never) - target) ? lo - 1 : lo;
    const item = data[near];
    const high = item.high ?? item.value;
    const low = item.low ?? item.value;
    return high === undefined || low === undefined ? null : { high, low };
  }

  /** The price the label is measured from: a price inside the bar's range rests on the bar's high. */
  effectivePrice(): number | null {
    const anchor = this._anchors[0];
    if (!anchor) return null;
    const bar = this.bar();
    if (bar && anchor.price <= bar.high && anchor.price >= bar.low) return bar.high;
    return anchor.price;
  }

  private visibleRange(viewport: Viewport): number | null {
    const top = viewport.priceScale.coordinateToPrice(0);
    const bottom = viewport.priceScale.coordinateToPrice(viewport.height);
    return top === null || bottom === null ? null : Math.abs(top - bottom);
  }

  /** Distance between the label and the bar as a percentage of the visible price range; negative when below the bar. */
  verticalPercent(viewport: Viewport): number {
    const bar = this.bar();
    const price = this.effectivePrice();
    const range = this.visibleRange(viewport);
    if (!bar || price === null || !range) return 0;
    if (price > bar.high) return ((price - bar.high) / range) * 100;
    if (price < bar.low) return ((price - bar.low) / range) * 100;
    return 0;
  }

  setVerticalPercent(percent: number, viewport: Viewport): void {
    const bar = this.bar();
    const range = this.visibleRange(viewport);
    const anchor = this._anchors[0];
    if (!bar || !range || !anchor || !Number.isFinite(percent)) return;
    const price = percent >= 0 ? bar.high + (percent / 100) * range : bar.low + (percent / 100) * range;
    this.setAnchors([{ ...anchor, price }]);
  }

  textMetrics(): { width: number; font: string } {
    const o = this._signpostOptions;
    const size = o.fontSize ?? 12;
    const font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${size}px ${TEXT_FONT_FAMILY}`;
    const ctx = measurer();
    const width = ctx ? ((ctx.font = font), ctx.measureText(o.text ?? '').width) : (o.text ?? '').length * size * 0.55;
    return { width, font };
  }

  layout(viewport: Viewport): SignpostLayout | null {
    const anchor = this._anchors[0];
    const price = this.effectivePrice();
    if (!anchor || price === null) return null;
    const x = viewport.timeScale.timeToCoordinate(anchor.time);
    const anchorY = viewport.priceScale.priceToCoordinate(price);
    if (x === null || anchorY === null) return null;

    const g = SIGNPOST_GEOMETRY;
    const w = this.textMetrics().width + g.padX * 2;
    const h = g.height;
    const bar = this.bar();
    let side: SignpostLayout['side'] = 'on-bar';
    let top = anchorY - h;
    let stem: SignpostLayout['stem'] = null;
    if (bar && price > bar.high) {
      side = 'above-bar';
      top = anchorY;
      const barY = viewport.priceScale.priceToCoordinate(bar.high);
      if (barY !== null && barY > top + h) stem = { from: top + h, to: barY };
    } else if (bar && price < bar.low) {
      side = 'below-bar';
      top = anchorY - h;
      const barY = viewport.priceScale.priceToCoordinate(bar.low);
      if (barY !== null && barY < top) stem = { from: top, to: barY };
    }

    let emoji: SignpostLayout['emoji'] = null;
    if (this._signpostOptions.emojiPin) {
      const d = g.emojiRadius + g.emojiGap;
      emoji = { cx: x, cy: side === 'above-bar' ? top + h + d : top - d };
    }
    return { x, box: { x: x - w / 2, y: top, w, h }, anchorY, side, stem, emoji };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const l = this.isValid() ? this.layout(viewport) : null;
    return l ? [{ index: 0, x: l.x, y: l.anchorY, radius: 7 }] : [];
  }

  override setState(state: DrawingState): void {
    if (state !== 'editing') this._grab = null;
    super.setState(state);
  }

  override grabControlPoint(index: number, point: Point): void {
    const viewport = this.getViewport();
    const cp = viewport && index === 0 ? this.getControlPoints(viewport)[0] : undefined;
    this._grab = cp ? { x: point.x - cp.x, y: point.y - cp.y } : null;
  }

  override updateAnchor(index: number, anchor: Anchor): void {
    const viewport = this.getViewport();
    if (!viewport || index !== 0) return super.updateAnchor(index, anchor);
    const pointer = this.anchorToPixel(anchor, viewport);
    if (!pointer) return super.updateAnchor(index, anchor);
    const grab = this._grab ?? { x: 0, y: 0 };
    const time = viewport.timeScale.coordinateToTime(pointer.x - grab.x);
    const price = viewport.priceScale.coordinateToPrice(pointer.y - grab.y);
    if (time === null || price === null) return;
    super.updateAnchor(index, { ...anchor, time, price });
  }

  paneViews(): IPrimitivePaneView[] {
    return [new SignpostPaneView(this)];
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;
    const l = this.layout(viewport);
    if (!l) return false;
    const { x, y, w, h } = l.box;
    if (point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h) return true;
    if (l.emoji && Math.hypot(point.x - l.emoji.cx, point.y - l.emoji.cy) <= SIGNPOST_GEOMETRY.emojiRadius) return true;
    if (l.stem && Math.abs(point.x - l.x) <= 4 && point.y >= Math.min(l.stem.from, l.stem.to) && point.y <= Math.max(l.stem.from, l.stem.to)) return true;
    return false;
  }

  override toJSON() {
    const { visible, locked } = this._options;
    return { ...super.toJSON(), options: { ...this._signpostOptions, visible, locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._signpostOptions = { ...this._signpostOptions, ...data.options };
  }

  clone(newId: string): IDrawing {
    return new Signpost(newId, [...this._anchors], { ...this._style }, { ...this._signpostOptions });
  }

  static create(id: string, position: Anchor, text: string, style?: Partial<DrawingStyle>, options?: Partial<SignpostOptions>): Signpost {
    return new Signpost(id, [position], style, { ...options, text });
  }
}
