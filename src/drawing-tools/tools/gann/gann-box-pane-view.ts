import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import { defaultFontFamily as FONT_FAMILY } from '../../../helpers/make-font';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { GannBox } from './gann-box';

const HANDLE_COLOR = '#2962FF';

/** The box sits behind the candles while the handles stay on top of them. */
export class GannBoxPaneView implements IPrimitivePaneView {
  private _renderer: GannBoxPaneRenderer;

  constructor(
    drawing: GannBox,
    private readonly _layer: 'body' | 'handles' = 'body'
  ) {
    this._renderer = new GannBoxPaneRenderer(drawing, _layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._layer === 'body' ? 'bottom' : 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class GannBoxPaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: GannBox,
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

    const o = drawing.gannOptions;
    const style = drawing.style;
    const { left, right, top, bottom } = layout;
    ctx.save();
    ctx.lineCap = 'butt';

    if (this._layer === 'handles') {
      const st = drawing.state;
      if (st === 'selected' || st === 'editing' || st === 'hovered') {
        drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, HANDLE_COLOR);
      }
      ctx.restore();
      return;
    }

    // Each band takes the colour of the higher level that closes it.
    if (o.fillHorzBackground !== false) {
      ctx.globalAlpha = o.horzOpacity ?? 0.2;
      for (let i = 1; i < layout.price.length; i++) {
        const y0 = layout.price[i - 1].pos;
        const y1 = layout.price[i].pos;
        ctx.fillStyle = layout.price[i].level.color;
        ctx.fillRect(left * pr, Math.min(y0, y1) * pr, (right - left) * pr, Math.abs(y1 - y0) * pr);
      }
    }
    if (o.fillVertBackground !== false) {
      ctx.globalAlpha = o.vertOpacity ?? 0.2;
      for (let i = 1; i < layout.time.length; i++) {
        const x0 = layout.time[i - 1].pos;
        const x1 = layout.time[i].pos;
        ctx.fillStyle = layout.time[i].level.color;
        ctx.fillRect(Math.min(x0, x1) * pr, top * pr, Math.abs(x1 - x0) * pr, (bottom - top) * pr);
      }
    }
    ctx.globalAlpha = 1;

    const lineWidth = Math.max(1, Math.round(style.lineWidth * pr));
    const dash = (style.lineDash ?? []).map((d) => d * pr);
    const crisp = (v: number) => Math.round(v * pr - 0.5) + 0.5;

    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    if (o.showFans) {
      ctx.strokeStyle = o.fansColor ?? '#9598A1';
      ctx.beginPath();
      for (const [p, q] of drawing.fanLines(layout)) {
        ctx.moveTo(p.x * pr, p.y * pr);
        ctx.lineTo(q.x * pr, q.y * pr);
      }
      ctx.stroke();
    }

    for (const l of layout.price) {
      ctx.strokeStyle = l.level.color;
      ctx.beginPath();
      ctx.moveTo(left * pr, crisp(l.pos));
      ctx.lineTo(right * pr, crisp(l.pos));
      ctx.stroke();
    }
    for (const l of layout.time) {
      ctx.strokeStyle = l.level.color;
      ctx.beginPath();
      ctx.moveTo(crisp(l.pos), top * pr);
      ctx.lineTo(crisp(l.pos), bottom * pr);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.font = `${(o.fontSize ?? 12) * pr}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    for (const { text, color, side, rect } of drawing.labelRects(layout)) {
      ctx.fillStyle = color;
      ctx.textAlign = side === 'left' ? 'right' : side === 'right' ? 'left' : 'center';
      const x = side === 'left' ? rect.x + rect.w : side === 'right' ? rect.x : rect.x + rect.w / 2;
      ctx.fillText(text, x * pr, (rect.y + rect.h / 2) * pr);
    }
    ctx.restore();
  }
}
