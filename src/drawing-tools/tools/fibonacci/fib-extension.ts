import type { Anchor, DrawingStyle, IDrawing, Viewport } from '../../core/types';
import {
  FibRetracement,
  type FibLayout,
  type FibLevelLine,
  type FibRetracementOptions,
} from '../channels/fib-retracement';

/** Standard Fibonacci extension levels (re-exported for public API compatibility). */
export { FIB_EXTENSION_LEVELS } from './constants';

export type FibExtensionOptions = FibRetracementOptions;

/**
 * Trend-Based Fib Extension: three points A, B, C. Each level sits at
 * `C + (B − A) × value` and is drawn horizontally from B to C (or extended).
 */
export class FibExtension extends FibRetracement {
  override readonly type: string = 'fib-extension';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibExtensionOptions> = {}
  ) {
    super(id, anchors, style, options);
  }

  override isValid(): boolean {
    return this._anchors.length >= 3;
  }

  override getPriceAtLevel(value: number): number {
    if (!this.isValid()) return 0;
    const [a, b, c] = this._anchors;
    const sign = this._fibOptions.reverse ? -1 : 1;
    return c.price + (b.price - a.price) * value * sign;
  }

  override layout(viewport: Viewport): FibLayout | null {
    if (!this.isValid()) return null;
    const pA = this.anchorToPixel(this._anchors[0], viewport);
    const pB = this.anchorToPixel(this._anchors[1], viewport);
    const pC = this.anchorToPixel(this._anchors[2], viewport);
    if (!pA || !pB || !pC) return null;

    const placed = this._placedCount ?? 3;
    // Until B is placed only the A→cursor segment shows; C is the live cursor afterwards.
    if (placed < 2) {
      return { p1: pA, p2: pB, trend: [pA, pB], x1: pA.x, x2: pB.x, lines: [] };
    }

    const lines: FibLevelLine[] = [];
    const enabled = (this._fibOptions.levels ?? []).filter((l) => l.enabled).sort((a, b) => a.value - b.value);
    for (const level of enabled) {
      const price = this.getPriceAtLevel(level.value);
      const y = viewport.priceScale.priceToCoordinate(price);
      if (y !== null) lines.push({ level, price, y });
    }

    return {
      p1: pA,
      p2: pB,
      trend: [pA, pB, pC],
      x1: this._options.extendLeft ? 0 : Math.min(pB.x, pC.x),
      x2: this._options.extendRight ? viewport.width : Math.max(pB.x, pC.x),
      lines,
    };
  }

  override clone(newId: string): IDrawing {
    return new FibExtension(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }

  static createExtension(
    id: string,
    pointA: Anchor,
    pointB: Anchor,
    pointC: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FibExtensionOptions>
  ): FibExtension {
    return new FibExtension(id, [pointA, pointB, pointC], style, options);
  }
}
