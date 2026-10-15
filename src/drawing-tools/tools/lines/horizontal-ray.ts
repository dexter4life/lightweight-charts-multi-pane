import { Drawing } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, IDrawing } from '../../core/types';
import { HorizontalLine } from './horizontal-line';
import type { TrendLineOptions } from './trend-line';

/** Horizontal Ray shares the Trend Line option set. */
export type HorizontalRayOptions = TrendLineOptions;

/** A level that starts at its anchor and runs to the right edge of the pane. */
export class HorizontalRay extends HorizontalLine {
  override readonly type: string = 'horizontal-ray';

  protected static override readonly HIT_THRESHOLD: number = 3;

  override lineSpan(viewport: Viewport): { x0: number; x1: number } | null {
    const p = this._anchors[0] ? this.anchorToPixel(this._anchors[0], viewport) : null;
    if (!p) return null;
    return { x0: Math.max(0, p.x), x1: viewport.width };
  }

  // The anchor circle is grabbable a little before the line starts.
  override testHit(point: Point, viewport: Viewport): boolean {
    const h = this.handlePixel(viewport);
    if (h && Math.hypot(point.x - h.x, point.y - h.y) <= 6) return true;
    return super.testHit(point, viewport);
  }

  override handleKind(): 'square' | 'circle' {
    return 'circle';
  }

  override handlePixel(viewport: Viewport): Point | null {
    return this._anchors[0] ? this.anchorToPixel(this._anchors[0], viewport) : null;
  }

  // The ray's anchor moves freely in both axes.
  override dragControlPoint(index: number, _point: Point, anchor: Anchor | null): void {
    if (anchor && this._anchors[index]) this.updateAnchor(index, anchor);
  }

  override bodyDragAnchors(origin: Point[], dx: number, dy: number, viewport: Viewport): Anchor[] | null {
    return Drawing.prototype.bodyDragAnchors.call(this, origin, dx, dy, viewport);
  }

  override clone(newId: string): IDrawing {
    return new HorizontalRay(newId, [...this._anchors], { ...this._style }, { ...this.trendLineOptions });
  }

  static override create(
    id: string,
    price: number,
    time: number | string,
    style?: Partial<DrawingStyle>,
    options?: Partial<TrendLineOptions>
  ): HorizontalRay {
    return new HorizontalRay(id, [{ time: time as any, price }], style, options);
  }
}
