import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { drawControlPoints } from '../../rendering/canvas-utils';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PatternDrawing } from '../patterns/pattern-base';
import { findNearestBarIndex, resolveSeriesBars } from './data-utils';
import type { SeriesDatumLike } from './data-utils';

export type BarsPatternMode = 'hl' | 'oc' | 'close' | 'open' | 'high' | 'low' | 'hl2';

/** One copied candle: open, high, low, close. */
export type BarsPatternBar = [number, number, number, number];

export interface BarsPatternOptions extends DrawingOptions {
  visibility?: VisibilityMap;
  mode: BarsPatternMode;
  mirrored: boolean;
  flipped: boolean;
  /** The candles captured when the pattern was placed; it keeps its shape wherever it is moved. */
  source?: BarsPatternBar[];
}

export const BARS_PATTERN_COLOR = '#2962FF';

const DEFAULT_OPTIONS: BarsPatternOptions = {
  mode: 'hl',
  mirrored: false,
  flipped: false,
};

/** How far above the picked candles the copy is first drawn, in css pixels. */
const LIFT_PX = 38;
const BAR_W = 3;
const HIT = 5;

export class BarsPattern extends PatternDrawing<BarsPatternOptions> {
  readonly type = 'bars-pattern';
  protected _patternOptions: BarsPatternOptions;

  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<BarsPatternOptions> = {}) {
    super(id, anchors, { lineColor: BARS_PATTERN_COLOR, lineWidth: 2, ...style }, {
      ...(options.visible !== undefined ? { visible: options.visible } : {}),
      ...(options.locked !== undefined ? { locked: options.locked } : {}),
    });
    this._patternOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  get barsPatternOptions(): BarsPatternOptions {
    return this._patternOptions;
  }

  setBarsPatternOptions(options: Partial<BarsPatternOptions>): void {
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
    return [new BarsPatternPaneView(this)];
  }

  override computeGeometry(): never[] {
    return [];
  }

  override autoscaleInfo(): null {
    return null;
  }

  /** Called once the placement is committed: captures the candles between the two clicks and snaps the anchors onto the copy. */
  finalizePlacement(): void {
    if (this._placedCount !== null || !this.isValid() || this._patternOptions.source || !this._series) return;
    const viewport = this.getViewport();
    if (!viewport) return;
    const bars = resolveSeriesBars(this._series.data() as unknown as readonly SeriesDatumLike[]);
    if (!bars.length) return;
    let from = findNearestBarIndex(bars, this._anchors[0].time);
    let to = findNearestBarIndex(bars, this._anchors[1].time);
    if (from < 0 || to < 0) return;
    if (from > to) [from, to] = [to, from];
    const picked = bars.slice(from, to + 1);
    const first = picked[0];
    const last = picked[picked.length - 1];
    const y = viewport.priceScale.priceToCoordinate(first.high);
    const lifted = y === null ? null : viewport.priceScale.coordinateToPrice(y - LIFT_PX);
    const lift = lifted === null ? 0 : lifted - first.high;
    this._anchors = [
      { time: first.time, price: first.high + lift },
      { time: last.time, price: last.low + lift },
    ];
    this._patternOptions = { ...this._patternOptions, source: picked.map((b): BarsPatternBar => [b.open, b.high, b.low, b.close]) };
    this.requestUpdate();
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const shape = this.layout(viewport);
    if (!shape) return false;
    const { xs, ys } = shape;
    const mode = this._patternOptions.mode;
    if (mode === 'hl' || mode === 'oc') {
      return xs.some((x, i) => Math.abs(point.x - x) <= BAR_W / 2 + HIT && point.y >= ys[i].top - HIT && point.y <= ys[i].bottom + HIT);
    }
    const line = ys.map((v) => v.line);
    for (let i = 1; i < xs.length; i += 1) {
      if (distanceToSegment(point, { x: xs[i - 1], y: line[i - 1] }, { x: xs[i], y: line[i] }) <= HIT) return true;
    }
    return xs.length === 1 && Math.hypot(point.x - xs[0], point.y - line[0]) <= HIT;
  }

  override clone(newId: string): IDrawing {
    return new BarsPattern(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }

  static create(id: string, startAnchor: Anchor, endAnchor: Anchor, style?: Partial<DrawingStyle>, options?: Partial<BarsPatternOptions>): BarsPattern {
    return new BarsPattern(id, [startAnchor, endAnchor], style, options);
  }

  anchorPixels(viewport: Viewport): [Point, Point] | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    return a && b ? [a, b] : null;
  }

  /** The copied candles pinned between the two anchors: the first candle's high sits on the first anchor, the last candle's low on the second. */
  layout(viewport: Viewport): { xs: number[]; ys: { top: number; bottom: number; line: number }[] } | null {
    const o = this._patternOptions;
    const source = o.source;
    const pixels = this.anchorPixels(viewport);
    if (!source?.length || !pixels) return null;
    const [p1, p2] = pixels;
    const n = source.length;
    const high0 = source[0][1];
    const lowN = source[n - 1][2];
    const span = lowN - high0;
    const axis = high0 + lowN;
    const toY = (price: number) => {
      const p = o.mirrored ? axis - price : price;
      return Math.abs(span) < 1e-12 ? p1.y : p1.y + ((p - high0) / span) * (p2.y - p1.y);
    };
    const xs: number[] = [];
    const ys: { top: number; bottom: number; line: number }[] = [];
    for (let i = 0; i < n; i += 1) {
      const [open, high, low, close] = source[o.flipped ? n - 1 - i : i];
      xs.push(n === 1 ? p1.x : p1.x + ((p2.x - p1.x) * i) / (n - 1));
      let a: number;
      let b: number;
      let line: number;
      switch (o.mode) {
        case 'oc':
          a = toY(open);
          b = toY(close);
          line = b;
          break;
        case 'close':
          a = b = line = toY(close);
          break;
        case 'open':
          a = b = line = toY(open);
          break;
        case 'high':
          a = b = line = toY(high);
          break;
        case 'low':
          a = b = line = toY(low);
          break;
        case 'hl2':
          a = b = line = toY((high + low) / 2);
          break;
        default:
          a = toY(high);
          b = toY(low);
          line = toY((high + low) / 2);
      }
      ys.push({ top: Math.min(a, b), bottom: Math.max(a, b), line });
    }
    return { xs, ys };
  }

  /** Whether the shape is drawn over the candles. */
  isRaised(): boolean {
    return true;
  }

  paint(scope: BitmapCoordinatesRenderingScope, viewport: Viewport): void {
    const { context: ctx, horizontalPixelRatio: pr, verticalPixelRatio: vr } = scope;
    const color = this._style.lineColor;
    ctx.save();
    ctx.scale(pr, vr);

    if (this.placedCount !== null) {
      const pixels = this.anchorPixels(viewport);
      if (pixels) {
        const [p1, p2] = pixels;
        ctx.strokeStyle = '#9598a1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, 0);
        ctx.lineTo(p1.x, viewport.height);
        ctx.moveTo(p2.x, 0);
        ctx.lineTo(p2.x, viewport.height);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    const shape = this.layout(viewport);
    if (!shape) {
      ctx.restore();
      return;
    }
    const { xs, ys } = shape;
    const mode = this._patternOptions.mode;
    if (mode === 'hl' || mode === 'oc') {
      ctx.fillStyle = color;
      for (let i = 0; i < xs.length; i += 1) {
        const h = Math.max(ys[i].bottom - ys[i].top, 1);
        ctx.fillRect(xs[i] - BAR_W / 2, ys[i].top, BAR_W, h);
      }
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = this._style.lineWidth;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      xs.forEach((x, i) => (i === 0 ? ctx.moveTo(x, ys[i].line) : ctx.lineTo(x, ys[i].line)));
      ctx.stroke();
    }
    ctx.restore();
  }
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

class BarsPatternPaneView implements IPrimitivePaneView {
  private readonly _renderer: BarsPatternPaneRenderer;

  constructor(drawing: BarsPattern) {
    this._renderer = new BarsPatternPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class BarsPatternPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: BarsPattern) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const drawing = this._drawing;
      const viewport = drawing.getViewport();
      if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;
      drawing.paint(scope, viewport);
      if (drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered') {
        if (drawing.placedCount !== null) return;
        drawControlPoints(scope.context, drawing.getControlPoints(viewport), null, scope.horizontalPixelRatio, BARS_PATTERN_COLOR);
      }
    });
  }
}

