import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawLine } from '../../rendering/canvas-utils';
import type { XABCDPattern } from './xabcd-pattern';

export const PATTERN_LABEL_FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const LABEL_PAD_X = 5;
const LABEL_PAD_Y = 4;
const LABEL_RADIUS = 4;
/** Distance between a vertex and the edge of its label box. */
const LABEL_GAP = 5.5;

export class XABCDPatternPaneView implements IPrimitivePaneView {
  private readonly _renderer: XABCDPatternPaneRenderer;

  constructor(drawing: XABCDPattern) {
    this._renderer = new XABCDPatternPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class XABCDPatternPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: XABCDPattern) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;

    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const points = drawing.getPatternPoints(viewport);
    if (points.length < 5) return;

    const options = drawing.xabcdPatternOptions;
    const { lineColor, lineWidth, fillColor } = drawing.style;
    applyStyle(ctx, drawing.style, pr);

    if (options.filled && fillColor) {
      ctx.save();
      ctx.fillStyle = fillColor;
      for (const polygon of drawing.getFilledPolygons(viewport)) {
        ctx.beginPath();
        ctx.moveTo(polygon[0].x * pr, polygon[0].y * pr);
        for (let i = 1; i < polygon.length; i++) ctx.lineTo(polygon[i].x * pr, polygon[i].y * pr);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    for (let i = 0; i < points.length - 1; i++) drawLine(ctx, points[i], points[i + 1], pr);

    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth * pr;
    ctx.lineCap = 'butt';
    ctx.setLineDash([lineWidth * pr, 2 * lineWidth * pr]);
    for (const [start, end] of drawing.getGuideLines(viewport)) {
      ctx.beginPath();
      ctx.moveTo(start.x * pr, start.y * pr);
      ctx.lineTo(end.x * pr, end.y * pr);
      ctx.stroke();
    }
    ctx.restore();

    if (options.showLabels) {
      const size = options.fontSize ?? 12;
      const font = `${options.italic ? 'italic ' : ''}${options.bold ? 'bold ' : ''}${size * pr}px ${PATTERN_LABEL_FONT_FAMILY}`;
      // Ratio boxes are sized as if every digit were as wide as a zero; vertex boxes snap up to an even width.
      const box = (text: string, cx: number, top: number, vertex: boolean) => {
        ctx.font = font;
        const w = vertex
          ? Math.ceil((Math.round(ctx.measureText(text).width / pr) + 8) / 2) * 2 * pr
          : ctx.measureText(text.replace(/\d/g, '0')).width + 2 * LABEL_PAD_X * pr;
        const h = (size + 2 * LABEL_PAD_Y) * pr;
        const x = cx * pr - w / 2;
        ctx.fillStyle = lineColor;
        ctx.beginPath();
        ctx.roundRect(x, top * pr, w, h, LABEL_RADIUS * pr);
        ctx.fill();
        ctx.fillStyle = options.textColor ?? '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx * pr, top * pr + h / 2 + 0.5 * pr);
      };
      const height = size + 2 * LABEL_PAD_Y;

      ctx.save();
      for (const ratio of drawing.getRatioLabels(viewport)) box(ratio.text, ratio.position.x, ratio.position.y - height / 2, false);
      for (const vertex of drawing.getVertexLabels(viewport)) {
        box(vertex.text, vertex.position.x, vertex.above ? vertex.position.y - LABEL_GAP - height : vertex.position.y + LABEL_GAP, true);
      }
      ctx.restore();
    }

    if (drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered') {
      drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, lineColor);
    }
  }
}
