import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle } from '../../rendering/canvas-utils';
import type { ShapeBase } from './shape-base';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const HANDLE_COLOR = '#2962FF';

/** The fill tints the candles, as in the reference, so both layers draw above the series. */
export class ShapePaneView implements IPrimitivePaneView {
  private _renderer: ShapePaneRenderer;

  constructor(drawing: ShapeBase, layer: 'body' | 'handles' = 'body') {
    this._renderer = new ShapePaneRenderer(drawing, layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class ShapePaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: ShapeBase,
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

    ctx.save();
    if (this._layer === 'handles') {
      const state = drawing.state;
      if (state === 'selected' || state === 'editing' || state === 'hovered') this.drawHandles(ctx, pr, viewport);
      ctx.restore();
      return;
    }

    applyStyle(ctx, drawing.style, pr);
    ctx.beginPath();
    if (!drawing.tracePath(ctx, pr, viewport)) {
      ctx.restore();
      return;
    }
    const o = drawing.shapeOptions;
    if (o.filled && drawing.style.fillColor) {
      ctx.fillStyle = drawing.style.fillColor;
      ctx.beginPath();
      if (drawing.traceFillPath(ctx, pr, viewport)) ctx.fill();
      else {
        ctx.beginPath();
        drawing.tracePath(ctx, pr, viewport);
        ctx.fill();
      }
      ctx.beginPath();
      drawing.tracePath(ctx, pr, viewport);
    }
    ctx.stroke();
    if (o.showText && o.text) this.drawText(ctx, pr, viewport);
    ctx.restore();
  }

  private drawText(ctx: CanvasRenderingContext2D, pr: number, viewport: Parameters<ShapeBase['textCenter']>[0]): void {
    const drawing = this._drawing;
    const c = drawing.textCenter(viewport);
    if (!c) return;
    const o = drawing.shapeOptions;
    const size = o.textSize ?? 14;
    ctx.setLineDash([]);
    ctx.fillStyle = o.textColor ?? drawing.style.lineColor;
    ctx.font = `${o.textItalic ? 'italic ' : ''}${o.textBold ? 'bold ' : ''}${size * pr}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = (o.text ?? '').split('\n');
    const lineHeight = size * 1.2;
    lines.forEach((line, i) => ctx.fillText(line, c.x * pr, (c.y + (i - (lines.length - 1) / 2) * lineHeight) * pr));
  }

  private drawHandles(ctx: CanvasRenderingContext2D, pr: number, viewport: Parameters<ShapeBase['textCenter']>[0]): void {
    ctx.setLineDash([]);
    ctx.strokeStyle = HANDLE_COLOR;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5 * pr;
    for (const p of this._drawing.getControlPoints(viewport)) {
      ctx.beginPath();
      ctx.arc(p.x * pr, p.y * pr, 5.25 * pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
