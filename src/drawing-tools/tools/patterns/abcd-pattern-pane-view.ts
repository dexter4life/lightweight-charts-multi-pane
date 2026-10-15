import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawDashedLine, drawLabel, drawLine } from '../../rendering/canvas-utils';
import type { ABCDPattern } from './abcd-pattern';

export class ABCDPatternPaneView implements IPrimitivePaneView {
  private readonly _renderer: ABCDPatternPaneRenderer;

  constructor(drawing: ABCDPattern) {
    this._renderer = new ABCDPatternPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class ABCDPatternPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: ABCDPattern) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const viewport = this._drawing.getViewport();
    if (!viewport || !this._drawing.options.visible || !this._drawing.isValid()) return;

    const { context: ctx, horizontalPixelRatio } = scope;
    const pixelRatio = horizontalPixelRatio;
    const points = this._drawing.getPatternPoints(viewport);
    if (points.length < 4) return;

    applyStyle(ctx, this._drawing.style, pixelRatio);

    for (let i = 0; i < points.length - 1; i++) {
      drawLine(ctx, points[i], points[i + 1], pixelRatio);
    }

    ctx.save();
    ctx.strokeStyle = this._drawing.style.lineColor;
    ctx.lineWidth = this._drawing.style.lineWidth * pixelRatio;
    for (const [start, end] of this._drawing.getGuideLines(viewport)) {
      drawDashedLine(ctx, start, end, [6, 4], pixelRatio);
    }
    ctx.restore();

    if (this._drawing.abcdPatternOptions.showLabels) {
      for (let i = 0; i < points.length; i++) {
        drawLabel(
          ctx,
          this._drawing.anchorLabels[i],
          { x: points[i].x + 6, y: points[i].y - 14 },
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

      for (const ratio of this._drawing.getRatioLabels(viewport)) {
        drawLabel(
          ctx,
          ratio.text,
          ratio.position,
          {
            font: '11px sans-serif',
            textColor: this._drawing.style.labelColor || this._drawing.style.lineColor,
            backgroundColor: 'rgba(19, 23, 34, 0.92)',
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
