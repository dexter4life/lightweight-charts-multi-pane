import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawLine } from '../../rendering/canvas-utils';
import type { FibSpiral } from './fib-spiral';

const HANDLE_COLOR = '#2962FF';

export class FibSpiralPaneView implements IPrimitivePaneView {
  private _renderer: FibSpiralPaneRenderer;

  constructor(drawing: FibSpiral, layer: 'body' | 'handles' = 'body') {
    this._renderer = new FibSpiralPaneRenderer(drawing, layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FibSpiralPaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: FibSpiral,
    private readonly _layer: 'body' | 'handles'
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isDisplayed()) return;
    const layout = drawing.layout(viewport);
    if (!layout) return;

    ctx.save();
    if (this._layer === 'handles') {
      const state = drawing.state;
      if (state === 'selected' || state === 'editing' || state === 'hovered') {
        drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, HANDLE_COLOR);
      }
      ctx.restore();
      return;
    }

    applyStyle(ctx, drawing.style, pr);
    drawLine(ctx, layout.center, layout.rayEnd, pr);
    const { spiral } = layout;
    if (spiral.length > 1) {
      ctx.beginPath();
      ctx.moveTo(spiral[0].x * pr, spiral[0].y * pr);
      for (let i = 1; i < spiral.length; i++) ctx.lineTo(spiral[i].x * pr, spiral[i].y * pr);
      ctx.stroke();
    }
    ctx.restore();
  }
}
