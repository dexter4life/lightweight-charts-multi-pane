import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { TextAnnotation, type TextAnnotationOptions } from './text-annotation';

export type AnchoredTextOptions = TextAnnotationOptions;

/**
 * Anchored Text - a text label fixed to a spot of the pane rather than to a price and time, so it stays
 * put while the chart is scrolled or zoomed. The spot is kept as a fraction of the pane size.
 */
export class AnchoredText extends TextAnnotation {
  override readonly type: string = 'anchored-text';

  private _rel: { fx: number; fy: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<AnchoredTextOptions> = {}) {
    super(id, anchors, style, options);
    const rel = (options as { relative?: { fx: number; fy: number } }).relative;
    if (rel) this._rel = { ...rel };
  }

  get relative(): { fx: number; fy: number } | null {
    return this._rel;
  }

  override boxOrigin(viewport: Viewport): Point | null {
    if (!this._rel) {
      const p = super.boxOrigin(viewport);
      if (!p) return null;
      this._rel = { fx: p.x / viewport.width, fy: p.y / viewport.height };
    }
    return { x: this._rel.fx * viewport.width, y: this._rel.fy * viewport.height };
  }

  /** The handle moves the text by the pointer delta, in pane pixels. */
  override updateAnchor(index: number, anchor: Anchor): void {
    const viewport = this.getViewport();
    if (!viewport || index !== 0) return super.updateAnchor(index, anchor);
    const pointer = this.anchorToPixel(anchor, viewport);
    const cp = this.getControlPoints(viewport)[0];
    if (!pointer || !cp) return super.updateAnchor(index, anchor);
    if (!this._grab) this._grab = { x: 0, y: 0 };
    const box = this.layout();
    const x = pointer.x - this._grab.x - box.width / 2;
    const y = pointer.y - this._grab.y - box.height + 1;
    this._rel = { fx: x / viewport.width, fy: y / viewport.height };
    this.requestUpdate();
  }

  override bodyDragOrigin(viewport: Viewport): Point[] | null {
    const o = this.boxOrigin(viewport);
    return o ? [o] : null;
  }

  override bodyDragAnchors(origin: Point[], dx: number, dy: number, viewport: Viewport): Anchor[] | null {
    const o = origin[0];
    this._rel = { fx: (o.x + dx) / viewport.width, fy: (o.y + dy) / viewport.height };
    return [...this._anchors];
  }

  override toJSON() {
    const json = super.toJSON();
    return { ...json, options: { ...json.options, relative: this._rel ?? undefined } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    const rel = data?.options?.relative;
    this._rel = rel ? { ...rel } : null;
  }

  override clone(newId: string): IDrawing {
    return new AnchoredText(newId, [...this._anchors], { ...this._style }, { ...this._textOptions, relative: this._rel ?? undefined } as Partial<AnchoredTextOptions>);
  }

  static override create(id: string, position: Anchor, text: string, style?: Partial<DrawingStyle>, options?: Partial<AnchoredTextOptions>): AnchoredText {
    return new AnchoredText(id, [position], style, { ...options, text });
  }
}
