import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawLine } from '../../rendering/canvas-utils';
import type { FibTimeZone } from './fib-time-zone';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const HANDLE_COLOR = '#2962FF';
const LABEL_GAP = 7;
const LABEL_EDGE = 5.5;

/** The lines sit behind the candles while the handles stay on top of them. */
export class FibTimeZonePaneView implements IPrimitivePaneView {
  private _renderer: FibTimeZonePaneRenderer;

  constructor(
    drawing: FibTimeZone,
    private readonly _layer: 'body' | 'handles' = 'body'
  ) {
    this._renderer = new FibTimeZonePaneRenderer(drawing, _layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._layer === 'body' ? 'bottom' : 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FibTimeZonePaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: FibTimeZone,
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

    const o = drawing.fibOptions;
    const state = drawing.state;
    ctx.save();
    ctx.lineCap = 'butt';

    if (this._layer === 'handles') {
      if (state === 'selected' || state === 'editing' || state === 'hovered') {
        drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, HANDLE_COLOR);
      }
      ctx.restore();
      return;
    }

    // Each band takes the colour of its right-hand (higher) level and runs to the pane edge past the last one.
    if (o.backgroundVisible) {
      ctx.globalAlpha = o.backgroundOpacity ?? 0.2;
      const all = layout.all;
      for (let i = 1; i < all.length; i++) {
        const left = Math.max(0, all[i - 1].x);
        const right = Math.min(viewport.width, all[i].x);
        if (right <= left) continue;
        ctx.fillStyle = all[i].level.color;
        ctx.fillRect(left * pr, 0, (right - left) * pr, viewport.height * pr);
      }
      ctx.globalAlpha = 1;
    }

    for (const l of layout.lines) {
      ctx.strokeStyle = l.level.color;
      ctx.lineWidth = Math.max(1, Math.round((l.level.width ?? 1) * pr));
      ctx.setLineDash((l.level.dash ?? []).map((d) => d * pr));
      const x = Math.round(l.x * pr - 0.5) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height * pr);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (o.trendLineVisible !== false) {
      applyStyle(ctx, drawing.style, pr);
      for (let i = 1; i < layout.trend.length; i++) drawLine(ctx, layout.trend[i - 1], layout.trend[i], pr);
    }

    if (o.showLabels !== false) {
      const size = o.fontSize ?? 12;
      ctx.font = `${size * pr}px ${FONT_FAMILY}`;
      const h = o.labelHAlign ?? 'right';
      const v = o.labelVAlign ?? 'bottom';
      ctx.textAlign = h === 'right' ? 'left' : h === 'left' ? 'right' : 'center';
      ctx.textBaseline = v === 'top' ? 'top' : v === 'middle' ? 'middle' : 'alphabetic';
      const y = v === 'top' ? LABEL_EDGE : v === 'middle' ? viewport.height / 2 : viewport.height - LABEL_EDGE;
      for (const l of layout.lines) {
        const x = h === 'right' ? l.x + LABEL_GAP : h === 'left' ? l.x - LABEL_GAP : l.x;
        ctx.fillStyle = l.level.color;
        ctx.fillText(String(l.level.value), x * pr, y * pr);
      }
    }
    ctx.restore();
  }
}
