import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawDashedLine, drawLabel, drawLine } from '../../rendering/canvas-utils';
import type { CypherPattern } from './cypher-pattern';

export class CypherPatternPaneView implements IPrimitivePaneView {
  private readonly _renderer: CypherPatternPaneRenderer;

  constructor(drawing: CypherPattern) {
    this._renderer = new CypherPatternPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class CypherPatternPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: CypherPattern) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const viewport = this._drawing.getViewport();
    if (!viewport || !this._drawing.options.visible || !this._drawing.isValid()) return;

    const { context: ctx, horizontalPixelRatio } = scope;
    const pixelRatio = horizontalPixelRatio;
    const points = this._drawing.getPatternPoints(viewport);
    if (points.length < 5) return;

    const options = this._drawing.cypherPatternOptions;
    applyStyle(ctx, this._drawing.style, pixelRatio);

    if (options.filled && this._drawing.style.fillColor) {
      ctx.save();
      ctx.fillStyle = this._drawing.style.fillColor;
      for (const polygon of this._drawing.getFilledPolygons(viewport)) {
        ctx.beginPath();
        ctx.moveTo(polygon[0].x * pixelRatio, polygon[0].y * pixelRatio);
        for (let i = 1; i < polygon.length; i++) {
          ctx.lineTo(polygon[i].x * pixelRatio, polygon[i].y * pixelRatio);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

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

    if (options.showLabels) {
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
