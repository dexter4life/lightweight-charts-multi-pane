import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import {
  FlatTopBottom,
  FT_END,
  FT_FLAT_END,
  FT_FLAT_START,
  FT_START,
  type FlatTopBottomOptions,
  type FlatTopBottomPixels,
} from './flat-top-bottom';

export type DisjointChannelOptions = FlatTopBottomOptions;

export const DEFAULT_DISJOINT_CHANNEL_OPTIONS = { textColor: '#089981' };

/**
 * Two lines with opposite slopes. The first two anchors give the upper line; the third anchor's price is where
 * the second line ends (under the second anchor's time), and its start is that price shifted by the first line's
 * rise, so the second line mirrors the first.
 */
export class DisjointChannel extends FlatTopBottom {
  override readonly type: string = 'disjoint-channel';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FlatTopBottomOptions> = {}
  ) {
    super(id, anchors, style, { ...DEFAULT_DISJOINT_CHANNEL_OPTIONS, ...options });
  }

  /** Price at the second line's start, above or below its end by the first line's rise. */
  private startPrice(): number {
    const [a0, a1, a2] = this._anchors;
    return a2.price + (a1.price - a0.price);
  }

  override endPrices() {
    return {
      start: this._anchors[0].price,
      end: this._anchors[1].price,
      flatStart: this.startPrice(),
      flatEnd: this._anchors[2].price,
    };
  }

  override isSquareHandle(index: number): boolean {
    return index === FT_FLAT_END;
  }

  override pixels(viewport: Viewport): FlatTopBottomPixels | null {
    if (!this.isValid()) return null;
    const p0 = this.anchorToPixel(this._anchors[0], viewport);
    const p1 = this.anchorToPixel(this._anchors[1], viewport);
    const y0 = viewport.priceScale.priceToCoordinate(this.startPrice());
    const y1 = viewport.priceScale.priceToCoordinate(this._anchors[2].price);
    if (!p0 || !p1 || y0 === null || y1 === null) return null;
    return { start: p0, end: p1, flatStart: { x: p0.x, y: y0 }, flatEnd: { x: p1.x, y: y1 } };
  }

  override dragControlPoint(index: number, _point: Point, anchor: Anchor | null, _viewport: Viewport): void {
    if (!anchor) return;
    const [a0, a1, a2] = this._anchors;
    if (index === FT_START) {
      this.updateAnchor(FT_START, anchor);
    } else if (index === FT_END) {
      // The second line keeps its start while its slope follows the first line.
      const rise = anchor.price - a1.price;
      this._anchors[FT_END] = anchor;
      this._anchors[2] = { ...a2, price: a2.price - rise };
      this.requestUpdate();
    } else if (index === FT_FLAT_END) {
      this._anchors[2] = { ...a2, time: anchor.time, logical: anchor.logical, price: anchor.price };
      this.requestUpdate();
    } else if (index === FT_FLAT_START) {
      this._anchors[FT_START] = {
        ...a0,
        time: anchor.time,
        logical: anchor.logical,
        price: a2.price + a1.price - anchor.price,
      };
      this.requestUpdate();
    }
  }

  override clone(newId: string): IDrawing {
    return new DisjointChannel(newId, [...this._anchors], { ...this._style }, { ...this.channelOptions });
  }

  static override create(
    id: string,
    start: Anchor,
    end: Anchor,
    third: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<FlatTopBottomOptions>
  ): DisjointChannel {
    return new DisjointChannel(id, [start, end, third], style, options);
  }
}
