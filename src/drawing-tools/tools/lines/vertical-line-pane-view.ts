import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { VerticalLine } from './vertical-line';
import { applyStyle, drawLine } from '../../rendering/canvas-utils';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const CAP_HEIGHT = 0.714;
const SIDE_GAP_V = 7;
const SIDE_GAP_H = 9.5;
const EDGE_GAP_TOP = 4.5;
const EDGE_GAP_BOTTOM = 4.5;
const EDGE_GAP_H = 7;
const HANDLE = 10;

export class VerticalLinePaneView implements IPrimitivePaneView {
  private _renderer: VerticalLinePaneRenderer;

  constructor(drawing: VerticalLine) {
    this._renderer = new VerticalLinePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class VerticalLinePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: VerticalLine) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._drawing;
    const viewport = d.getViewport();
    if (!viewport || !d.options.visible || !d.isDisplayed()) return;
    const x = d.linePixelX(viewport);
    if (x === null) return;

    ctx.save();
    applyStyle(ctx, d.style, pr);
    ctx.lineCap = 'butt';
    drawLine(ctx, { x, y: 0 }, { x, y: viewport.height }, pr);
    ctx.restore();

    const o = d.trendLineOptions;
    if (o.showText && o.text) this.renderText(ctx, x, viewport.height, pr);

    if (d.state === 'selected' || d.state === 'editing') this.renderHandle(ctx, x, viewport.height / 2, pr);
  }

  private renderText(ctx: CanvasRenderingContext2D, lineX: number, height: number, pr: number): void {
    const d = this._drawing;
    const o = d.trendLineOptions;
    const hAlign = o.textHAlign ?? 'right';
    const vAlign = o.textVAlign ?? 'bottom';
    const size = o.textSize ?? 14;
    const cap = size * CAP_HEIGHT;
    const lines = (o.text ?? '').split('\n');
    const lh = size * 1.2;

    ctx.save();
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.font = `${o.textItalic ? 'italic ' : ''}${o.textBold ? 'bold ' : ''}${size}px ${FONT_FAMILY}`;
    ctx.fillStyle = o.textColor ?? d.style.lineColor;
    ctx.textBaseline = 'alphabetic';

    if (o.textOrientation === 'horizontal') {
      const x = hAlign === 'left' ? lineX - SIDE_GAP_H : hAlign === 'right' ? lineX + SIDE_GAP_H : lineX;
      ctx.textAlign = hAlign === 'left' ? 'right' : hAlign === 'right' ? 'left' : 'center';
      const block = cap + (lines.length - 1) * lh;
      const first =
        vAlign === 'top' ? EDGE_GAP_H + cap : vAlign === 'bottom' ? height - EDGE_GAP_H - (lines.length - 1) * lh : (height - block) / 2 + cap + 0.5;
      lines.forEach((line, i) => ctx.fillText(line, x, first + i * lh));
    } else {
      // Rotated to read bottom-to-top; the baseline side faces right.
      const baseline = hAlign === 'left' ? lineX - SIDE_GAP_V : hAlign === 'right' ? lineX + SIDE_GAP_V + cap : lineX + cap / 2;
      const along = vAlign === 'top' ? EDGE_GAP_TOP : vAlign === 'bottom' ? height - EDGE_GAP_BOTTOM : height / 2;
      ctx.translate(baseline, along);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = vAlign === 'top' ? 'right' : vAlign === 'bottom' ? 'left' : 'center';
      lines.forEach((line, i) => ctx.fillText(line, 0, i * lh));
    }
    ctx.restore();
  }

  private renderHandle(ctx: CanvasRenderingContext2D, cx: number, cy: number, pr: number): void {
    const half = HANDLE / 2;
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect((cx - half) * pr, (cy - half) * pr, HANDLE * pr, HANDLE * pr, 3 * pr);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = this._drawing.style.lineColor;
    ctx.lineWidth = 2 * pr;
    ctx.stroke();
    ctx.restore();
  }
}
