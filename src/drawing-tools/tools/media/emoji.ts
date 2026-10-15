import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';

import { GlyphDrawing, type GlyphOptions } from './glyph-drawing';

export interface EmojiOptions extends GlyphOptions {
  emoji?: string;
}

export class Emoji extends GlyphDrawing {
  readonly type = 'emoji';

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<EmojiOptions> = {}) {
    super(id, anchors, style, options);
    this._glyphOptions = { ...this._glyphOptions, emoji: options.emoji ?? '😀' } as EmojiOptions;
  }

  get emojiOptions(): EmojiOptions {
    return this._glyphOptions as EmojiOptions;
  }

  setEmojiOptions(options: Partial<EmojiOptions>): void {
    this.setGlyphOptions(options);
  }

  fill(): number {
    return 1;
  }

  glyph(): string {
    return this.emojiOptions.emoji ?? '😀';
  }

  tint(): null {
    return null;
  }

  clone(newId: string): IDrawing {
    return new Emoji(newId, [...this._anchors], { ...this._style }, { ...this.emojiOptions });
  }
}
