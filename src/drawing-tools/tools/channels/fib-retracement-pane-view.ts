import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import { defaultFontFamily as FONT_FAMILY } from '../../../helpers/make-font';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawLine } from '../../rendering/canvas-utils';
import type { FibLayout, FibRetracement } from './fib-retracement';

const HANDLE_COLOR = '#2962FF';

export class FibRetracementPaneView implements IPrimitivePaneView {
  private _renderer: FibRetracementPaneRenderer;

  constructor(drawing: FibRetracement) {
    this._renderer = new FibRetracementPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FibRetracementPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: FibRetracement) {}

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

    const o = drawing.fibOptions;
    const { x1, x2, lines } = layout;
    const state = drawing.state;
    const placed = drawing.placedCount === null || drawing.placedCount >= 2;

    ctx.save();

    // Each band takes the colour of the farther (higher-valued) level.
    if (o.backgroundVisible && placed) {
      ctx.globalAlpha = o.backgroundOpacity ?? 0.2;
      for (let i = 1; i < lines.length; i++) {
        const a = lines[i - 1].y;
        const b = lines[i].y;
        ctx.fillStyle = lines[i].level.color;
        ctx.fillRect(x1 * pr, Math.min(a, b) * pr, (x2 - x1) * pr, Math.abs(b - a) * pr);
      }
      ctx.globalAlpha = 1;
    }

    const lw = o.levelsWidth ?? 1;
    const deviceWidth = Math.max(1, Math.round(lw * pr));
    const half = deviceWidth % 2 === 1 ? 0.5 : 0;
    ctx.lineWidth = deviceWidth;
    ctx.lineCap = 'butt';
    ctx.setLineDash((o.levelsDash ?? []).map((d) => d * pr));
    for (const l of lines) {
      const y = Math.round(l.y * pr) + half;
      ctx.strokeStyle = l.level.color;
      ctx.beginPath();
      ctx.moveTo(x1 * pr, y);
      ctx.lineTo(x2 * pr, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (o.trendLineVisible) {
      applyStyle(ctx, drawing.style, pr);
      for (let i = 1; i < layout.trend.length; i++) drawLine(ctx, layout.trend[i - 1], layout.trend[i], pr);
    }

    this.drawLabels(ctx, layout, pr, viewport.width);

    if (state === 'selected' || state === 'editing' || state === 'hovered') {
      ctx.setLineDash([]);
      drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, HANDLE_COLOR);
    }
    ctx.restore();
  }

  private drawLabels(ctx: CanvasRenderingContext2D, layout: FibLayout, pr: number, paneWidth: number): void {
    const drawing = this._drawing;
    const size = drawing.fibOptions.fontSize ?? 12;
    ctx.font = `${size * pr}px ${FONT_FAMILY}`;
    for (const label of drawing.labelItems(layout, paneWidth)) {
      ctx.textAlign = label.align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = label.color;
      ctx.fillText(label.text, label.x * pr, label.baseline * pr);
    }
  }
}
