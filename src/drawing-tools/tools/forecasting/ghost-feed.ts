import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { drawControlPoints } from '../../rendering/canvas-utils';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PatternDrawing } from '../patterns/pattern-base';
import { resolveSeriesBars } from './data-utils';
import type { SeriesDatumLike } from './data-utils';

export interface GhostFeedOptions extends DrawingOptions {
  visibility?: VisibilityMap;
  /** Average high-low range of a ghost candle, in min ticks. Measured from the chart's candles when placed. */
  averageHL?: number;
  /** How far, in percent, the range of each ghost candle may deviate from the average. */
  variance: number;
  /** 0-100. */
  transparency: number;
  upColor: string;
  downColor: string;
  drawBorder: boolean;
  borderUpColor: string;
  borderDownColor: string;
  drawWick: boolean;
  wickColor: string;
  /** Seeds the random candles, so a feed looks the same every time it is drawn. */
  seed?: number;
}

export const GHOST_FEED_LINE = '#787B86';

const DEFAULT_OPTIONS: GhostFeedOptions = {
  variance: 50,
  transparency: 50,
  upColor: '#ACE5DC',
  downColor: '#FAA1A4',
  drawBorder: true,
  borderUpColor: '#089981',
  borderDownColor: '#F23645',
  drawWick: true,
  wickColor: '#787B86',
};

const HIT = 5;

export interface GhostCandle {
  x: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** A hand-drawn path that sprouts a run of random, translucent candles - a "what could the market do" sketch. */
export class GhostFeed extends PatternDrawing<GhostFeedOptions> {
  readonly type = 'ghost-feed';
  protected _patternOptions: GhostFeedOptions;

  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<GhostFeedOptions> = {}) {
    super(id, anchors, { lineColor: GHOST_FEED_LINE, lineWidth: 1, ...style }, {
      ...(options.visible !== undefined ? { visible: options.visible } : {}),
      ...(options.locked !== undefined ? { locked: options.locked } : {}),
    });
    this._patternOptions = { ...DEFAULT_OPTIONS, ...options, seed: options.seed ?? Math.floor(Math.random() * 2 ** 31) };
  }

  get ghostFeedOptions(): GhostFeedOptions {
    return this._patternOptions;
  }

  setGhostFeedOptions(options: Partial<GhostFeedOptions>): void {
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
    return [new GhostFeedPaneView(this)];
  }

  override computeGeometry(): never[] {
    return [];
  }

  override autoscaleInfo(): null {
    return null;
  }

  addPoint(anchor: Anchor): void {
    this._anchors.push(anchor);
    this.requestUpdate();
  }

  private get minTick(): number {
    const minMove = (this._series?.options() as { priceFormat?: { minMove?: number } } | undefined)?.priceFormat?.minMove;
    return minMove && minMove > 0 ? minMove : 0.01;
  }

  /** Measures the typical candle range of the chart once the feed is committed. */
  finalizePlacement(): void {
    if (this._placedCount !== null || this._patternOptions.averageHL !== undefined || !this._series) return;
    const bars = resolveSeriesBars(this._series.data() as unknown as readonly SeriesDatumLike[]);
    if (!bars.length) return;
    const avg = bars.reduce((s, b) => s + (b.high - b.low), 0) / bars.length;
    this._patternOptions = { ...this._patternOptions, averageHL: Math.round(avg / this.minTick) };
    this.requestUpdate();
  }

  private pathPixels(viewport: Viewport): Point[] {
    const out: Point[] = [];
    const count = this._anchors.length;
    for (let i = 0; i < count; i += 1) {
      const p = this.anchorToPixel(this._anchors[i], viewport);
      if (p) out.push(p);
    }
    return out;
  }

  private static yAt(pts: Point[], x: number): number | null {
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const lo = Math.min(a.x, b.x);
      const hi = Math.max(a.x, b.x);
      if (x < lo - 1e-6 || x > hi + 1e-6) continue;
      return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    }
    return null;
  }

  /** One candle per chart bar between the first and the last point; the path decides where each one sits. */
  candles(viewport: Viewport, path: Point[]): { list: GhostCandle[]; spacing: number } {
    const ts = viewport.timeScale;
    const c0 = ts.logicalToCoordinate(0 as never);
    const c1 = ts.logicalToCoordinate(1 as never);
    const avgTicks = this._patternOptions.averageHL;
    if (c0 === null || c1 === null || path.length < 2 || !avgTicks) return { list: [], spacing: 0 };
    const spacing = c1 - c0;
    if (!(spacing > 0)) return { list: [], spacing: 0 };
    const avg = avgTicks * this.minTick;
    const variance = Math.max(0, this._patternOptions.variance) / 100;
    const seed = this._patternOptions.seed ?? 1;
    const xMin = Math.min(...path.map((p) => p.x));
    const xMax = Math.max(...path.map((p) => p.x));
    const kFrom = Math.ceil((xMin - c0) / spacing - 1e-6);
    const kTo = Math.floor((xMax - c0) / spacing + 1e-6);
    const list: GhostCandle[] = [];
    for (let k = kFrom; k <= kTo; k += 1) {
      const x = c0 + k * spacing;
      const y = GhostFeed.yAt(path, x);
      if (y === null) continue;
      const centre = viewport.priceScale.coordinateToPrice(y);
      if (centre === null) continue;
      const rnd = mulberry32(seed ^ Math.imul(k + 1000003, 0x9e3779b1));
      const range = avg * (1 + (rnd() * 2 - 1) * variance);
      const body = range * (0.2 + rnd() * 0.55);
      const up = rnd() > 0.5;
      const mid = centre + (rnd() - 0.5) * range * 0.4;
      const open = up ? mid - body / 2 : mid + body / 2;
      const close = up ? mid + body / 2 : mid - body / 2;
      const spare = Math.max(range - body, 0);
      const upper = spare * rnd();
      list.push({ x, open, close, high: Math.max(open, close) + upper, low: Math.min(open, close) - (spare - upper) });
    }
    return { list, spacing };
  }

  private candlePixels(viewport: Viewport, c: GhostCandle) {
    const ps = viewport.priceScale;
    const o = ps.priceToCoordinate(c.open);
    const cl = ps.priceToCoordinate(c.close);
    const h = ps.priceToCoordinate(c.high);
    const l = ps.priceToCoordinate(c.low);
    if (o === null || cl === null || h === null || l === null) return null;
    return { o, c: cl, h, l, up: c.close >= c.open };
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const path = this.pathPixels(viewport);
    for (let i = 1; i < path.length; i += 1) {
      if (distanceToSegment(point, path[i - 1], path[i]) <= HIT) return true;
    }
    return false;
  }

  override clone(newId: string): IDrawing {
    return new GhostFeed(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }

  static create(id: string, points: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<GhostFeedOptions>): GhostFeed {
    return new GhostFeed(id, points, style, options);
  }

  paint(scope: BitmapCoordinatesRenderingScope, viewport: Viewport): void {
    const { context: ctx, horizontalPixelRatio: pr, verticalPixelRatio: vr } = scope;
    const o = this._patternOptions;
    const path = this.pathPixels(viewport);
    if (path.length < 2) return;
    ctx.save();
    ctx.scale(pr, vr);

    const alpha = 1 - Math.min(Math.max(o.transparency, 0), 100) / 100;
    const { list, spacing } = this.candles(viewport, path);
    const bodyW = Math.max(1, Math.round(spacing * 0.75));
    for (const c of list) {
      const px = this.candlePixels(viewport, c);
      if (!px) continue;
      const left = Math.round(c.x - bodyW / 2);
      const top = Math.min(px.o, px.c);
      const h = Math.max(Math.abs(px.o - px.c), 1);
      if (o.drawWick) {
        ctx.strokeStyle = hexToRgba(o.wickColor, alpha);
        ctx.lineWidth = 1;
        const wx = Math.round(c.x) + 0.5;
        ctx.beginPath();
        ctx.moveTo(wx, px.h);
        ctx.lineTo(wx, px.l);
        ctx.stroke();
      }
      ctx.fillStyle = hexToRgba(px.up ? o.upColor : o.downColor, alpha);
      ctx.fillRect(left, top, bodyW, h);
      if (o.drawBorder) {
        ctx.strokeStyle = hexToRgba(px.up ? o.borderUpColor : o.borderDownColor, alpha);
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 0.5, top + 0.5, bodyW - 1, Math.max(h - 1, 0));
      }
    }

    ctx.strokeStyle = this._style.lineColor;
    ctx.lineWidth = this._style.lineWidth;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }
}

class GhostFeedPaneView implements IPrimitivePaneView {
  private readonly _renderer: GhostFeedPaneRenderer;

  constructor(drawing: GhostFeed) {
    this._renderer = new GhostFeedPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class GhostFeedPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: GhostFeed) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const drawing = this._drawing;
      const viewport = drawing.getViewport();
      if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;
      drawing.paint(scope, viewport);
      if (drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered') {
        drawControlPoints(scope.context, drawing.getControlPoints(viewport), null, scope.horizontalPixelRatio, '#2962FF');
      }
    });
  }
}
