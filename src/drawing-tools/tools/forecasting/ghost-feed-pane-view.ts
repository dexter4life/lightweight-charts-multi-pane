import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { GhostFeed } from './ghost-feed';
import { drawControlPoints, drawLine } from '../../rendering/canvas-utils';

export class GhostFeedPaneView implements IPrimitivePaneView {
  private _renderer: GhostFeedPaneRenderer;

  constructor(drawing: GhostFeed) {
    this._renderer = new GhostFeedPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class GhostFeedPaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: GhostFeed;

  constructor(drawing: GhostFeed) {
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

    const { bars, candleWidth } = this._drawing.getProjectedBars(viewport);
    if (bars.length === 0) {
      return;
    }

    const options = this._drawing.ghostFeedOptions;
    const upColor = this._drawing.style.lineColor || '#26a69a';
    const downColor = this._drawing.style.fillColor || 'rgba(239, 83, 80, 0.7)';
    const opacity = Math.max(0.05, Math.min(1, options.opacity ?? 0.35));

    ctx.save();
    ctx.globalAlpha = opacity;

    bars.forEach((bar, index) => {
      const color = bar.isUp ? upColor : downColor;
      const bodyTop = Math.min(bar.openY, bar.closeY);
      const bodyBottom = Math.max(bar.openY, bar.closeY);

      if (options.showWicks) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 * pixelRatio;
        drawLine(ctx, { x: bar.x, y: bar.highY }, { x: bar.x, y: bar.lowY }, pixelRatio);
      }

      if (options.showBodies) {
        ctx.fillStyle = color;
        ctx.fillRect(
          (bar.x - candleWidth / 2) * pixelRatio,
          bodyTop * pixelRatio,
          candleWidth * pixelRatio,
          Math.max(1, bodyBottom - bodyTop) * pixelRatio
        );
      }

      if (index > 0) {
        const previous = bars[index - 1];
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 * pixelRatio;
        drawLine(ctx, { x: previous.x, y: previous.closeY }, { x: bar.x, y: bar.closeY }, pixelRatio);
      }
    });

    ctx.restore();

    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      drawControlPoints(ctx, this._drawing.getControlPoints(viewport), null, pixelRatio);
    }
  }
}
