import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { Geometry, TextGeometry } from '../../core/geometry';
import { EmojiPaneView } from './emoji-pane-view';

export interface EmojiOptions extends DrawingOptions {
  emoji?: string;
  size?: number;
}

export class Emoji extends Drawing {
  readonly type = 'emoji';

  protected static readonly REQUIRED_ANCHORS = 1;

  private _emojiOptions: EmojiOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<EmojiOptions> = {}
  ) {
    const { emoji, size, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._emojiOptions = {
      ...this._options,
      emoji: emoji ?? '😀',
      size: size ?? 32,
    };
  }

  get emojiOptions(): EmojiOptions {
    return this._emojiOptions;
  }

  setEmojiOptions(options: Partial<EmojiOptions>): void {
    this._emojiOptions = { ...this._emojiOptions, ...options };
    super.updateOptions(options);
  }

  override updateOptions(options: Partial<EmojiOptions>): void {
    this._emojiOptions = { ...this._emojiOptions, ...options };
    super.updateOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= Emoji.REQUIRED_ANCHORS;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new EmojiPaneView(this)];
  }

  getBounds(viewport: Viewport): { left: number; right: number; top: number; bottom: number } | null {
    if (!this.isValid()) {
      return null;
    }

    const anchor = this.anchorToPixel(this._anchors[0], viewport);
    if (!anchor) {
      return null;
    }

    const size = this._emojiOptions.size ?? 32;
    return {
      left: anchor.x - size / 2,
      right: anchor.x + size / 2,
      top: anchor.y - size / 2,
      bottom: anchor.y + size / 2,
    };
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    if (!this.isValid()) {
      return [];
    }

    const anchor = this.anchorToPixel(this._anchors[0], viewport);
    if (!anchor) {
      return [];
    }

    return [{
      type: 'text',
      position: anchor,
      text: this._emojiOptions.emoji ?? '😀',
      font: `${this._emojiOptions.size ?? 32}px sans-serif`,
      align: 'center',
      baseline: 'middle',
    } as TextGeometry];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const bounds = this.getBounds(viewport);
    if (!bounds) {
      return false;
    }

    return (
      point.x >= bounds.left &&
      point.x <= bounds.right &&
      point.y >= bounds.top &&
      point.y <= bounds.bottom
    );
  }

  override toJSON(): SerializedDrawing {
    return {
      ...super.toJSON(),
      options: { ...this._emojiOptions },
    };
  }

  override fromJSON(data: SerializedDrawing): void {
    super.fromJSON(data);
    this._emojiOptions = { ...this._emojiOptions, ...data.options };
  }

  override clone(newId: string): IDrawing {
    return new Emoji(newId, [...this._anchors], { ...this._style }, { ...this._emojiOptions });
  }
}
