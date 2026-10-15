import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Emoji } from './emoji';
import { drawControlPoints } from '../../rendering/canvas-utils';

export class EmojiPaneView implements IPrimitivePaneView {
  private _renderer: EmojiPaneRenderer;

  constructor(drawing: Emoji) {
    this._renderer = new EmojiPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class EmojiPaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: Emoji;

  constructor(drawing: Emoji) {
    this._drawing = drawing;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      this.drawImpl(scope);
    });
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio } = scope;
    const pixelRatio = horizontalPixelRatio;
    const viewport = this._drawing.getViewport();

    if (!viewport || !this._drawing.options.visible || !this._drawing.isValid()) {
      return;
    }

    const anchor = this._drawing.anchorToPixel(this._drawing.anchors[0], viewport);
    if (!anchor) {
      return;
    }

    const options = this._drawing.emojiOptions;
    ctx.save();
    ctx.font = `${(options.size ?? 32) * pixelRatio}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.emoji ?? '😀', anchor.x * pixelRatio, anchor.y * pixelRatio);
    ctx.restore();

    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      drawControlPoints(ctx, this._drawing.getControlPoints(viewport), null, pixelRatio);
    }
  }
}
