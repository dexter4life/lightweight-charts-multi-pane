import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawLabel, drawLine } from '../../rendering/canvas-utils';
import type { ElliottWaveDrawing } from './elliott-wave-base';

export class ElliottWavePaneViewBase implements IPrimitivePaneView {
  private readonly _renderer: ElliottWavePaneRendererBase;

  constructor(drawing: ElliottWaveDrawing) {
    this._renderer = new ElliottWavePaneRendererBase(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class ElliottWavePaneRendererBase implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: ElliottWaveDrawing) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const viewport = this._drawing.getViewport();
    if (!viewport || !this._drawing.options.visible || !this._drawing.isValid()) return;

    const points = this._drawing.getWavePoints(viewport);
    if (points.length < 2) return;

    const { context: ctx, horizontalPixelRatio } = scope;
    const pixelRatio = horizontalPixelRatio;
    applyStyle(ctx, this._drawing.style, pixelRatio);

    if (this._drawing.waveOptions.filled && this._drawing.style.fillColor) {
      ctx.save();
      ctx.fillStyle = this._drawing.style.fillColor;
      ctx.beginPath();
      ctx.moveTo(points[0].x * pixelRatio, points[0].y * pixelRatio);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * pixelRatio, points[i].y * pixelRatio);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < points.length - 1; i++) {
      drawLine(ctx, points[i], points[i + 1], pixelRatio);
    }

    if (this._drawing.waveOptions.showLabels) {
      for (let i = 0; i < points.length; i++) {
        drawLabel(
          ctx,
          this._drawing.labels[i] ?? `${i}`,
          { x: points[i].x + 8, y: points[i].y - 14 },
          {
            font: this._drawing.style.labelFont || '11px sans-serif',
            textColor: '#ffffff',
            backgroundColor: this._drawing.style.lineColor + 'D0',
            padding: 3,
            borderRadius: 3,
          },
          pixelRatio
        );
      }
    }

    if (this._drawing.state === 'selected' || this._drawing.state === 'editing' || this._drawing.state === 'hovered') {
      drawControlPoints(ctx, this._drawing.getControlPoints(viewport), null, pixelRatio, this._drawing.style.lineColor);
    }
  }
}
