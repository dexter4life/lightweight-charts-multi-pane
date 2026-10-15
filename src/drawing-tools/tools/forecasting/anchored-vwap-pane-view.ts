import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { AnchoredVwap } from './anchored-vwap';
import { drawControlPoints } from '../../rendering/canvas-utils';

export class AnchoredVwapPaneView implements IPrimitivePaneView {
  private _renderer: AnchoredVwapPaneRenderer;

  constructor(drawing: AnchoredVwap) {
    this._renderer = new AnchoredVwapPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class AnchoredVwapPaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: AnchoredVwap;

  constructor(drawing: AnchoredVwap) {
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

    const points = this._drawing.getVwapPoints(viewport);
    if (points.length < 2) {
      return;
    }

    const options = this._drawing.anchoredVwapOptions;
    const bandColor = options.bandColor ?? '#90caf9';
    const bandFillColor = options.bandFillColor ?? 'rgba(144, 202, 249, 0.12)';

    ctx.save();

    if (options.showBands) {
      ctx.fillStyle = bandFillColor;
      ctx.beginPath();
      ctx.moveTo(points[0].x * pixelRatio, points[0].upperY * pixelRatio);
      points.forEach((point) => {
        ctx.lineTo(point.x * pixelRatio, point.upperY * pixelRatio);
      });
      for (let index = points.length - 1; index >= 0; index -= 1) {
        const point = points[index];
        ctx.lineTo(point.x * pixelRatio, point.lowerY * pixelRatio);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = bandColor;
      ctx.lineWidth = 1 * pixelRatio;
      ctx.setLineDash([4 * pixelRatio, 3 * pixelRatio]);
      drawPath(ctx, points, 'upperY', pixelRatio);
      drawPath(ctx, points, 'lowerY', pixelRatio);
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = this._drawing.style.lineColor;
    ctx.lineWidth = this._drawing.style.lineWidth * pixelRatio;
    drawPath(ctx, points, 'y', pixelRatio);

    ctx.restore();

    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      drawControlPoints(ctx, this._drawing.getControlPoints(viewport), null, pixelRatio);
    }
  }
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number; upperY: number; lowerY: number }[],
  key: 'y' | 'upperY' | 'lowerY',
  pixelRatio: number
): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x * pixelRatio, points[0][key] * pixelRatio);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x * pixelRatio, points[index][key] * pixelRatio);
  }
  ctx.stroke();
}
