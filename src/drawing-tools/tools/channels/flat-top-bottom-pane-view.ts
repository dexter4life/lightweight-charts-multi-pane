import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { Point } from '../../core/types';
import type { FlatTopBottom } from './flat-top-bottom';
import { applyStyle, drawLine } from '../../rendering/canvas-utils';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const HANDLE_STROKE = '#2962FF';
/** Gap between a line end and its price. */
const PRICE_GAP = 7;

export class FlatTopBottomPaneView implements IPrimitivePaneView {
  private _renderer: FlatTopBottomPaneRenderer;

  constructor(drawing: FlatTopBottom) {
    this._renderer = new FlatTopBottomPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FlatTopBottomPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: FlatTopBottom) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._drawing;
    const viewport = d.getViewport();
    if (!viewport || !d.options.visible || !d.isDisplayed()) return;
    const l = d.lines(viewport);
    const px = d.pixels(viewport);
    if (!l || !px) return;
    const o = d.channelOptions;

    ctx.save();
    if (o.filled && d.style.fillColor) {
      ctx.fillStyle = d.style.fillColor;
      ctx.beginPath();
      ctx.moveTo(l.slanted[0].x * pr, l.slanted[0].y * pr);
      ctx.lineTo(l.slanted[1].x * pr, l.slanted[1].y * pr);
      ctx.lineTo(l.flat[1].x * pr, l.flat[1].y * pr);
      ctx.lineTo(l.flat[0].x * pr, l.flat[0].y * pr);
      ctx.closePath();
      ctx.fill();
    }

    applyStyle(ctx, d.style, pr);
    ctx.lineCap = 'butt';
    drawLine(ctx, l.slanted[0], l.slanted[1], pr);
    drawLine(ctx, l.flat[0], l.flat[1], pr);

    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    if (o.leftEnd === 'arrow') {
      this.arrow(ctx, pr, px.start, px.end);
      this.arrow(ctx, pr, px.flatStart, px.flatEnd);
    }
    if (o.rightEnd === 'arrow') {
      this.arrow(ctx, pr, px.end, px.start);
      this.arrow(ctx, pr, px.flatEnd, px.flatStart);
    }
    ctx.restore();

    if (o.showPrices) this.prices(ctx, pr);

    if (d.state === 'selected' || d.state === 'editing') {
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = HANDLE_STROKE;
      ctx.lineWidth = 2 * pr;
      for (const c of d.getControlPoints(viewport)) {
        ctx.beginPath();
        if (d.isSquareHandle(c.index)) ctx.roundRect((c.x - 5) * pr, (c.y - 5) * pr, 10 * pr, 10 * pr, 3 * pr);
        else ctx.arc(c.x * pr, c.y * pr, 4.75 * pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private arrow(ctx: CanvasRenderingContext2D, pr: number, tip: Point, other: Point): void {
    const dx = other.x - tip.x;
    const dy = other.y - tip.y;
    if (dx === 0 && dy === 0) return;
    const base = Math.atan2(dy, dx);
    const size = 7 * this._drawing.style.lineWidth;
    ctx.beginPath();
    for (const sign of [-1, 1]) {
      const angle = base + (sign * Math.PI) / 4;
      ctx.moveTo(tip.x * pr, tip.y * pr);
      ctx.lineTo((tip.x + Math.cos(angle) * size) * pr, (tip.y + Math.sin(angle) * size) * pr);
    }
    ctx.stroke();
  }

  /** The price of each line end, set outside the drawing beside its end. */
  private prices(ctx: CanvasRenderingContext2D, pr: number): void {
    const d = this._drawing;
    const viewport = d.getViewport();
    const px = viewport && d.pixels(viewport);
    if (!px) return;
    const o = d.channelOptions;
    const prices = d.endPrices();
    ctx.save();
    ctx.setLineDash([]);
    ctx.font = `${o.textItalic ? 'italic ' : ''}${o.textBold ? 'bold ' : ''}${(o.textSize ?? 12) * pr}px ${FONT_FAMILY}`;
    ctx.fillStyle = o.textColor ?? d.style.lineColor;
    ctx.textBaseline = 'middle';
    const startIsLeft = px.start.x <= px.end.x;
    const put = (price: number, at: Point, outward: -1 | 1) => {
      ctx.textAlign = outward < 0 ? 'right' : 'left';
      ctx.fillText(d.formatPrice(price), (at.x + outward * PRICE_GAP) * pr, at.y * pr);
    };
    const first = startIsLeft ? -1 : 1;
    const last = startIsLeft ? 1 : -1;
    put(prices.start, px.start, first);
    put(prices.flatStart, px.flatStart, first);
    put(prices.end, px.end, last);
    put(prices.flatEnd, px.flatEnd, last);
    ctx.restore();
  }
}
