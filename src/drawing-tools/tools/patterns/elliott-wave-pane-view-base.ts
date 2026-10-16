import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawLine } from '../../rendering/canvas-utils';
import { DEFAULT_ELLIOTT_DEGREE, elliottLabelStyle, type ElliottWaveDrawing } from './elliott-wave-base';
import { PATTERN_LABEL_FONT_FAMILY } from './xabcd-pattern-pane-view';

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
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;

    const points = drawing.getWavePoints(viewport);
    if (points.length < 2) return;

    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const { lineColor, lineWidth } = drawing.style;
    applyStyle(ctx, drawing.style, pr);

    if (drawing.waveOptions.showWave !== false) {
      for (let i = 0; i < points.length - 1; i++) drawLine(ctx, points[i], points[i + 1], pr);
    }

    const style = elliottLabelStyle(drawing.waveOptions.degree ?? DEFAULT_ELLIOTT_DEGREE);
    ctx.save();
    ctx.font = `${style.bold ? 'bold ' : ''}${style.fontSize * pr}px ${PATTERN_LABEL_FONT_FAMILY}`;
    ctx.fillStyle = lineColor;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = Math.max(1, lineWidth) * pr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of drawing.getWaveLabels(viewport)) {
      const cx = label.position.x * pr;
      const cy = (label.position.y + (label.above ? -style.offset : style.offset)) * pr;
      if (style.kind === 'circle') {
        ctx.beginPath();
        ctx.arc(cx, cy, (style.circleDiameter / 2) * pr, 0, Math.PI * 2);
        ctx.lineWidth = pr;
        ctx.stroke();
      }
      ctx.fillText(label.text, cx, cy + 0.5 * pr);
    }
    ctx.restore();

    if (drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered') {
      drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, '#2962FF');
    }
  }
}
