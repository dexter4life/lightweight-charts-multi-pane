import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import type { IPrimitivePaneView } from '../../../model/ipane-primitive';
import {
  FibRetracement,
  measureText,
  type FibLabelItem,
  type FibLayout,
  type FibLevel,
  type FibRetracementOptions,
} from '../channels/fib-retracement';
import { FibChannelPaneView } from './fib-channel-pane-view';

/** Standard Fibonacci channel levels (re-exported for public API compatibility). */
export { FIB_CHANNEL_LEVELS } from './constants';

export type FibChannelOptions = FibRetracementOptions;

export interface FibChannelSegment {
  level: FibLevel;
  price: number;
  /** Start of the level line (`A + value × (C − A)`), before extension. */
  start: Point;
  /** End of the level line (`B + value × (C − A)`), before extension. */
  end: Point;
  /** Drawn endpoints, after left/right extension. */
  a: Point;
  b: Point;
}

export interface FibChannelLayout extends FibLayout {
  segments: FibChannelSegment[];
  /** Thin A→cursor guide shown until the second point is placed. */
  guide: [Point, Point] | null;
}

const LABEL_GAP = 8;
const V_SHIFT = 10;
const EXTEND = 1e4;

/**
 * Fib Channel: three points A, B, C. Every level line is segment AB translated by
 * `value × (C − A)`, so level 0 is AB and level 1 starts at C.
 */
export class FibChannel extends FibRetracement {
  override readonly type: string = 'fib-channel';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibChannelOptions> = {}
  ) {
    super(id, anchors, style, { trendLineVisible: false, labelVAlign: 'middle', ...options });
  }

  override isValid(): boolean {
    return this._anchors.length >= 3;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new FibChannelPaneView(this)];
  }

  override getPriceAtLevel(value: number): number {
    if (!this.isValid()) return 0;
    const [a, , c] = this._anchors;
    return a.price + (c.price - a.price) * value;
  }

  channelLayout(viewport: Viewport): FibChannelLayout | null {
    if (!this.isValid()) return null;
    const pA = this.anchorToPixel(this._anchors[0], viewport);
    const pB = this.anchorToPixel(this._anchors[1], viewport);
    const pC = this.anchorToPixel(this._anchors[2], viewport);
    if (!pA || !pB || !pC) return null;

    const placed = this._placedCount ?? 3;
    const base = { p1: pA, p2: pB, trend: [pA, pB], x1: pA.x, x2: pB.x, lines: [] };
    if (placed < 2) return { ...base, segments: [], guide: [pA, pB] };

    const [a, b, c] = this._anchors;
    const scale = viewport.priceScale;
    const enabled = (this._fibOptions.levels ?? []).filter((l) => l.enabled).sort((p, q) => p.value - q.value);
    const dx = pB.x - pA.x;
    const len = Math.hypot(dx, pB.y - pA.y) || 1;
    const t0 = this._options.extendLeft ? -EXTEND / len : 0;
    const t1 = this._options.extendRight ? 1 + EXTEND / len : 1;

    const segments: FibChannelSegment[] = [];
    for (const level of enabled) {
      const v = level.value;
      const price = a.price + (c.price - a.price) * v;
      const ys = scale.priceToCoordinate(price);
      const ye = scale.priceToCoordinate(b.price + (c.price - a.price) * v);
      if (ys === null || ye === null) continue;
      const shift = (pC.x - pA.x) * v;
      const start = { x: pA.x + shift, y: ys };
      const end = { x: pB.x + shift, y: ye };
      const at = (t: number): Point => ({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
      segments.push({ level, price, start, end, a: at(t0), b: at(t1) });
    }

    return {
      ...base,
      lines: segments.map((s) => ({ level: s.level, price: s.price, y: s.start.y })),
      segments,
      guide: null,
    };
  }

  override layout(viewport: Viewport): FibChannelLayout | null {
    return this.channelLayout(viewport);
  }

  override labelItems(layout: FibLayout, paneWidth: number): FibLabelItem[] {
    void paneWidth;
    const segments = (layout as FibChannelLayout).segments ?? [];
    const o = this._fibOptions;
    if (!o.showLevels && !o.showPrices) return [];
    const size = o.fontSize ?? 12;
    const h = o.labelHAlign ?? 'left';
    const v = o.labelVAlign ?? 'middle';
    const shift = v === 'top' ? V_SHIFT : v === 'bottom' ? -V_SHIFT : 0;

    return segments.map((s) => {
      const parts: string[] = [];
      if (o.showLevels) {
        parts.push(o.levelsMode === 'percents' ? `${(s.level.value * 100).toFixed(2)}%` : `${s.level.value}`);
      }
      if (o.showPrices) parts.push(`(${this.formatPrice(s.price)})`);
      const text = parts.join('');
      const width = measureText(text, size);

      let x: number;
      let align: FibLabelItem['align'];
      let y: number;
      if (h === 'left') {
        [x, align, y] = [s.start.x - LABEL_GAP, 'right', s.start.y];
      } else if (h === 'right') {
        [x, align, y] = [s.end.x + LABEL_GAP, 'left', s.end.y];
      } else {
        [x, align, y] = [(s.start.x + s.end.x) / 2, 'center', (s.start.y + s.end.y) / 2];
      }
      const baseline = y + shift + size * 0.36;
      const left = align === 'left' ? x : align === 'right' ? x - width : x - width / 2;
      return {
        text,
        x,
        align,
        baseline,
        color: s.level.color,
        box: { left: left - 3, right: left + width + 3, top: baseline - size, bottom: baseline + 3 },
      };
    });
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const layout = this.channelLayout(viewport);
    if (!layout) return [];
    return layout.segments.map((s): LineGeometry => ({ type: 'line', start: s.a, end: s.b }));
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.channelLayout(viewport);
    if (!layout) return false;
    const t = FibRetracement['HIT_THRESHOLD'];

    if (layout.guide) return distToSegment(point, layout.guide[0], layout.guide[1]) <= t;
    for (const s of layout.segments) {
      if (distToSegment(point, s.a, s.b) <= t) return true;
    }
    for (const { box } of this.labelItems(layout, viewport.width)) {
      if (point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom) return true;
    }
    return false;
  }

  override clone(newId: string): IDrawing {
    return new FibChannel(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }

  static createChannel(
    id: string,
    pointA: Anchor,
    pointB: Anchor,
    pointC: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FibChannelOptions>
  ): FibChannel {
    return new FibChannel(id, [pointA, pointB, pointC], style, options);
  }
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + s * dx), p.y - (a.y + s * dy));
}
