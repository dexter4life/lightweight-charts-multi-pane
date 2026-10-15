import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { ImageDrawing } from './image';
import { drawControlPoints } from '../../rendering/canvas-utils';

export class ImagePaneView implements IPrimitivePaneView {
  private _renderer: ImagePaneRenderer;

  constructor(drawing: ImageDrawing) {
    this._renderer = new ImagePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class ImagePaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: ImageDrawing;

  constructor(drawing: ImageDrawing) {
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

    const bounds = this._drawing.getBounds(viewport);
    if (!bounds) {
      return;
    }

    const image = this._drawing.loadedImage;
    const opacity = Math.max(0, Math.min(1, this._drawing.imageOptions.opacity ?? 1));

    ctx.save();
    ctx.globalAlpha = opacity;

    if (image) {
      ctx.drawImage(
        image,
        bounds.left * pixelRatio,
        bounds.top * pixelRatio,
        (bounds.right - bounds.left) * pixelRatio,
        (bounds.bottom - bounds.top) * pixelRatio
      );
    } else {
      ctx.fillStyle = 'rgba(41, 98, 255, 0.12)';
      ctx.fillRect(
        bounds.left * pixelRatio,
        bounds.top * pixelRatio,
        (bounds.right - bounds.left) * pixelRatio,
        (bounds.bottom - bounds.top) * pixelRatio
      );
      ctx.strokeStyle = this._drawing.style.lineColor;
      ctx.lineWidth = 1 * pixelRatio;
      ctx.strokeRect(
        bounds.left * pixelRatio,
        bounds.top * pixelRatio,
        (bounds.right - bounds.left) * pixelRatio,
        (bounds.bottom - bounds.top) * pixelRatio
      );
      ctx.font = `${12 * pixelRatio}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this._drawing.style.labelColor ?? this._drawing.style.lineColor;
      ctx.fillText('Image', ((bounds.left + bounds.right) / 2) * pixelRatio, ((bounds.top + bounds.bottom) / 2) * pixelRatio);
    }

    ctx.restore();

    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      drawControlPoints(ctx, this._drawing.getControlPoints(viewport), null, pixelRatio);
    }
  }
}
