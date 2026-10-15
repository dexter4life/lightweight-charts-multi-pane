import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { HorizontalLine } from './horizontal-line';
import { applyStyle, drawLine } from '../../rendering/canvas-utils';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const TEXT_GAP = 4;
const TEXT_EDGE = 6;
const HANDLE = 10;

export class HorizontalLinePaneView implements IPrimitivePaneView {
  private _renderer: HorizontalLinePaneRenderer;

  constructor(drawing: HorizontalLine) {
    this._renderer = new HorizontalLinePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class HorizontalLinePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: HorizontalLine) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._drawing;
    const viewport = d.getViewport();
    if (!viewport || !d.options.visible || !d.isDisplayed()) return;
    const y = d.linePixelY(viewport);
    const span = d.lineSpan(viewport);
    if (y === null || !span) return;

    ctx.save();
    applyStyle(ctx, d.style, pr);
    ctx.lineCap = 'butt';
    drawLine(ctx, { x: span.x0, y }, { x: span.x1, y }, pr);
    ctx.restore();

    const o = d.trendLineOptions;
    if (o.showText && o.text) this.renderText(ctx, span, y, pr);

    const handle = d.handlePixel(viewport);
    if (handle && (d.state === 'selected' || d.state === 'editing')) this.renderHandle(ctx, handle.x, handle.y, pr);
  }

  private renderText(ctx: CanvasRenderingContext2D, span: { x0: number; x1: number }, y: number, pr: number): void {
    const d = this._drawing;
    const o = d.trendLineOptions;
    const hAlign = o.textHAlign ?? 'center';
    const vAlign = o.textVAlign ?? 'bottom';
    const size = o.textSize ?? 12;
    const x =
      hAlign === 'left' ? span.x0 + TEXT_EDGE : hAlign === 'right' ? span.x1 - TEXT_EDGE : (span.x0 + span.x1) / 2;

    ctx.save();
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.font = `${o.textItalic ? 'italic ' : ''}${o.textBold ? 'bold ' : ''}${size}px ${FONT_FAMILY}`;
    ctx.fillStyle = o.textColor ?? d.style.lineColor;
    ctx.textAlign = hAlign;
    const lines = (o.text ?? '').split('\n');
    const lh = size * 1.2;
    const total = lines.length * lh;
    ctx.textBaseline = 'top';
    const top = vAlign === 'top' ? y - TEXT_GAP - total : vAlign === 'bottom' ? y + TEXT_GAP : y - total / 2;
    lines.forEach((line, i) => ctx.fillText(line, x, top + i * lh));
    ctx.restore();
  }

  private renderHandle(ctx: CanvasRenderingContext2D, cx: number, cy: number, pr: number): void {
    const half = HANDLE / 2;
    ctx.save();
    ctx.setLineDash([]);
    ctx.beginPath();
    if (this._drawing.handleKind() === 'circle') ctx.arc(cx * pr, cy * pr, 5 * pr, 0, Math.PI * 2);
    else ctx.roundRect((cx - half) * pr, (cy - half) * pr, HANDLE * pr, HANDLE * pr, 3 * pr);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = this._drawing.style.lineColor;
    ctx.lineWidth = 2 * pr;
    ctx.stroke();
    ctx.restore();
  }
}
