import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { ArrowMark } from './arrow-mark';
import { ARROW_MARK_FONT, ARROW_MARK_GEOMETRY } from './arrow-mark';

export class ArrowMarkPaneView implements IPrimitivePaneView {
  private _renderer: ArrowMarkPaneRenderer;

  constructor(private _drawing: ArrowMark) {
    this._renderer = new ArrowMarkPaneRenderer(_drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._drawing.state === 'selected' || this._drawing.state === 'editing' || this._drawing.placedCount !== null ? 'top' : 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class ArrowMarkPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _drawing: ArrowMark) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._drawing;
    const viewport = d.getViewport();
    if (!viewport || !d.isValid() || !d.options.visible || !d.isDisplayed()) return;
    const l = d.layout(viewport);
    if (!l) return;
    const o = d.arrowMarkOptions;
    const color = o.arrowColor ?? d.style.lineColor;

    ctx.save();
    ctx.beginPath();
    l.polygon.forEach((p, i) => (i ? ctx.lineTo(p.x * pr, p.y * pr) : ctx.moveTo(p.x * pr, p.y * pr)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    if (o.showText && o.text) this.drawLabel(ctx, l.anchor, pr);

    const active = d.state === 'selected' || d.state === 'editing';
    const placing = d.placedCount !== null && d.placedCount < 1;
    if (active || placing) drawControlPoints(ctx, d.getControlPoints(viewport), null, pr, color);
  }

  private drawLabel(ctx: CanvasRenderingContext2D, anchor: { x: number; y: number }, pr: number): void {
    const d = this._drawing;
    const o = d.arrowMarkOptions;
    const g = ARROW_MARK_GEOMETRY;
    const size = o.textSize ?? 14;
    const lines = (o.text ?? '').split('\n');
    const lh = size * 1.2;
    const total = g.headLength + g.shaftLength;
    const baselineShift = size * 0.35;

    ctx.save();
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.font = `${o.textItalic ? 'italic ' : ''}${o.textBold ? 'bold ' : ''}${size}px ${ARROW_MARK_FONT}`;
    ctx.fillStyle = o.textColor ?? o.arrowColor ?? d.style.lineColor;
    ctx.textBaseline = 'alphabetic';
    let x = anchor.x;
    let first = anchor.y;
    ctx.textAlign = 'center';
    switch (d.direction) {
      case 'up':
        first = anchor.y + total + g.textGap + size * 0.68;
        break;
      case 'down':
        first = anchor.y - total - g.textGap - (lines.length - 1) * lh;
        break;
      case 'left':
        ctx.textAlign = 'left';
        x = anchor.x + total + g.textGap;
        first = anchor.y + baselineShift - ((lines.length - 1) * lh) / 2;
        break;
      default:
        ctx.textAlign = 'right';
        x = anchor.x - total - g.textGap;
        first = anchor.y + baselineShift - ((lines.length - 1) * lh) / 2;
    }
    lines.forEach((line, i) => ctx.fillText(line, x, first + i * lh));
    ctx.restore();
  }
}
