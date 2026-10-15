import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawLine } from '../../rendering/canvas-utils';
import type { Rectangle } from './rectangle';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const HANDLE_COLOR = '#2962FF';
const TEXT_GAP = 6;

/** The fill tints the candles, as in the reference, so both layers draw above the series. */
export class RectanglePaneView implements IPrimitivePaneView {
  private _renderer: RectanglePaneRenderer;

  constructor(drawing: Rectangle, layer: 'body' | 'handles' = 'body') {
    this._renderer = new RectanglePaneRenderer(drawing, layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class RectanglePaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: Rectangle,
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
    const l = drawing.layout(viewport);
    if (!l) return;

    ctx.save();
    if (this._layer === 'handles') {
      const state = drawing.state;
      if (state === 'selected' || state === 'editing' || state === 'hovered') this.drawHandles(ctx, pr);
      ctx.restore();
      return;
    }

    const o = drawing.rectangleOptions;
    const x0 = o.extendLeft ? 0 : l.left;
    const x1 = o.extendRight ? viewport.width : l.right;

    applyStyle(ctx, drawing.style, pr);
    ctx.lineCap = 'butt';
    if (o.filled && drawing.style.fillColor) {
      ctx.fillStyle = drawing.style.fillColor;
      ctx.fillRect(x0 * pr, l.top * pr, (x1 - x0) * pr, (l.bottom - l.top) * pr);
    }

    drawLine(ctx, { x: x0, y: l.top }, { x: x1, y: l.top }, pr);
    drawLine(ctx, { x: x0, y: l.bottom }, { x: x1, y: l.bottom }, pr);
    drawLine(ctx, { x: l.left, y: l.top }, { x: l.left, y: l.bottom }, pr);
    drawLine(ctx, { x: l.right, y: l.top }, { x: l.right, y: l.bottom }, pr);

    if (o.showText && o.text) this.drawText(ctx, pr);
    ctx.restore();
  }

  private drawText(ctx: CanvasRenderingContext2D, pr: number): void {
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    const l = viewport && drawing.layout(viewport);
    if (!l) return;
    const o = drawing.rectangleOptions;
    const size = o.textSize ?? 14;
    ctx.setLineDash([]);
    ctx.fillStyle = o.textColor ?? drawing.style.lineColor;
    ctx.font = `${o.textItalic ? 'italic ' : ''}${o.textBold ? 'bold ' : ''}${size * pr}px ${FONT_FAMILY}`;
    const h = o.textHAlign ?? 'left';
    ctx.textAlign = h;
    const x = h === 'left' ? l.left : h === 'right' ? l.right : (l.left + l.right) / 2;
    const v = o.textVAlign ?? 'top';
    let y: number;
    if (v === 'top') {
      ctx.textBaseline = 'bottom';
      y = l.top - TEXT_GAP;
    } else if (v === 'bottom') {
      ctx.textBaseline = 'top';
      y = l.bottom + TEXT_GAP;
    } else {
      ctx.textBaseline = 'middle';
      y = (l.top + l.bottom) / 2;
    }
    const lines = (o.text ?? '').split('\n');
    const lineHeight = size * 1.2;
    lines.forEach((line, i) => {
      const dy = v === 'top' ? -(lines.length - 1 - i) * lineHeight : v === 'bottom' ? i * lineHeight : (i - (lines.length - 1) / 2) * lineHeight;
      ctx.fillText(line, x * pr, (y + dy) * pr);
    });
  }

  private drawHandles(ctx: CanvasRenderingContext2D, pr: number): void {
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport) return;
    ctx.setLineDash([]);
    ctx.strokeStyle = HANDLE_COLOR;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5 * pr;
    for (const p of drawing.getControlPoints(viewport)) {
      const x = p.x * pr;
      const y = p.y * pr;
      ctx.beginPath();
      if (p.index < 4) {
        ctx.arc(x, y, 5.75 * pr, 0, Math.PI * 2);
      } else {
        const half = 4.75 * pr;
        ctx.roundRect(x - half, y - half, half * 2, half * 2, 3 * pr);
      }
      ctx.fill();
      ctx.stroke();
    }
  }
}
