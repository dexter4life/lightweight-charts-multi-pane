import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';

import { GlyphDrawing, type GlyphOptions } from './glyph-drawing';
import { createStickerSource, type StickerSource } from './sticker-source';

export interface StickerOptions extends GlyphOptions {
  /** URL of the sticker file (.tgs, .webp, .png ...). */
  sticker?: string;
}

export const STICKER_DEFAULT_SIZE = 78;
const SOURCE_STEP = 64;

/** One-point drawing that shows a sticker centred on its anchor; it turns and resizes like an icon. */
export class Sticker extends GlyphDrawing {
  readonly type = 'sticker';

  private _source: StickerSource | null = null;
  private _sourceUrl = '';

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<StickerOptions> = {}) {
    super(id, anchors, style, { size: STICKER_DEFAULT_SIZE, ...options });
    this._glyphOptions = { ...this._glyphOptions, sticker: options.sticker ?? '' } as StickerOptions;
  }

  get stickerOptions(): StickerOptions {
    return this._glyphOptions as StickerOptions;
  }

  fill(): number {
    return 1;
  }

  glyph(): string {
    return '';
  }

  tint(): string | null {
    return null;
  }

  override image(): CanvasImageSource | null {
    const url = this.stickerOptions.sticker ?? '';
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const need = Math.ceil((this.size * dpr) / SOURCE_STEP) * SOURCE_STEP;
    if (!url) return null;
    if (!this._source || this._sourceUrl !== url || this._source.size < need) {
      this._source?.dispose();
      this._sourceUrl = url;
      this._source = createStickerSource(url, need, () => this.requestUpdate());
    }
    return this._source?.image() ?? null;
  }

  override detached(): void {
    this._source?.dispose();
    this._source = null;
    this._sourceUrl = '';
    super.detached();
  }

  clone(newId: string): IDrawing {
    return new Sticker(newId, [...this._anchors], { ...this._style }, { ...this.stickerOptions });
  }
}
