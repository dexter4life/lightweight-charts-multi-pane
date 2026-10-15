import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';

import { GlyphDrawing, type GlyphOptions } from './glyph-drawing';

export interface IconOptions extends GlyphOptions {
  /** Unicode code point of the symbol. */
  icon?: number;
}

export const ICON_COLOR = '#2962FF';
export const ICON_DEFAULT = 0x2605;

export class Icon extends GlyphDrawing {
  readonly type = 'icon';

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<IconOptions> = {}) {
    super(id, anchors, { lineColor: ICON_COLOR, ...style }, options);
    this._glyphOptions = { ...this._glyphOptions, icon: options.icon ?? ICON_DEFAULT } as IconOptions;
  }

  get iconOptions(): IconOptions {
    return this._glyphOptions as IconOptions;
  }

  fill(): number {
    return 0.83;
  }

  glyph(): string {
    return String.fromCodePoint(this.iconOptions.icon ?? ICON_DEFAULT) + '\uFE0E';
  }

  tint(): string {
    return this._style.lineColor;
  }

  clone(newId: string): IDrawing {
    return new Icon(newId, [...this._anchors], { ...this._style }, { ...this.iconOptions });
  }
}
