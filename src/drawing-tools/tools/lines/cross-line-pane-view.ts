import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { CrossLine } from './cross-line';
import { applyStyle, drawLine } from '../../rendering/canvas-utils';

export class CrossLinePaneView implements IPrimitivePaneView {
  private _renderer: CrossLinePaneRenderer;

  constructor(drawing: CrossLine) {
    this._renderer = new CrossLinePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class CrossLinePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: CrossLine) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._drawing;
    const viewport = d.getViewport();
    if (!viewport || !d.options.visible || !d.isDisplayed()) return;
    const p = d.crossPixel(viewport);
    if (!p) return;

    ctx.save();
    applyStyle(ctx, d.style, pr);
    ctx.lineCap = 'butt';
    drawLine(ctx, { x: 0, y: p.y }, { x: viewport.width, y: p.y }, pr);
    drawLine(ctx, { x: p.x, y: 0 }, { x: p.x, y: viewport.height }, pr);
    ctx.restore();

    if (d.state === 'selected' || d.state === 'editing') {
      ctx.save();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p.x * pr, p.y * pr, 5 * pr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = d.style.lineColor;
      ctx.lineWidth = 2 * pr;
      ctx.stroke();
      ctx.restore();
    }
  }
}
