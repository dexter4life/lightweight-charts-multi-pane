import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { PriceLabel } from './price-label';
import { PRICE_LABEL_GEOMETRY } from './price-label';

export class PriceLabelPaneView implements IPrimitivePaneView {
  private _renderer: PriceLabelPaneRenderer;

  constructor(private _drawing: PriceLabel) {
    const drawing = _drawing;
    this._renderer = new PriceLabelPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._drawing.state === 'selected' || this._drawing.state === 'editing' ? 'top' : 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class PriceLabelPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _drawing: PriceLabel) {}

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

    const g = PRICE_LABEL_GEOMETRY;
    const o = d.priceLabelOptions;
    const L = Math.round(l.box.x * pr);
    const T = Math.round(l.box.y * pr);
    const R = Math.round((l.box.x + l.box.w) * pr);
    const B = Math.round((l.box.y + l.box.h) * pr);
    const r = g.radius * pr;
    const ax = l.anchor.x * pr;
    const ay = l.anchor.y * pr;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(L + r, T);
    ctx.lineTo(R - r, T);
    ctx.arcTo(R, T, R, T + r, r);
    ctx.lineTo(R, B - r);
    ctx.arcTo(R, B, R - r, B, r);
    ctx.lineTo(L + g.tailTo * pr, B);
    ctx.lineTo(ax, ay);
    ctx.lineTo(L + g.tailFrom * pr, B);
    ctx.lineTo(L, B);
    ctx.lineTo(L, T + r);
    ctx.arcTo(L, T, L + r, T, r);
    ctx.closePath();
    ctx.fillStyle = o.backgroundColor ?? '#2962FF';
    ctx.fill();
    ctx.strokeStyle = o.borderColor ?? '#2962FF';
    ctx.lineWidth = pr;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.font = l.font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${Number(n) * pr}px`);
    ctx.fillStyle = o.textColor ?? '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const spacing = l.tracking * pr;
    const gap = Math.max(0, l.text.length - 1) * spacing;
    let x = (L + R) / 2 - (ctx.measureText(l.text).width + gap) / 2;
    const y = (T + B) / 2 + pr * 0.5;
    for (const ch of l.text) {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + spacing;
    }

    if (d.state === 'selected' || d.state === 'editing') {
      ctx.beginPath();
      ctx.arc(ax, ay, g.handleRadius * pr, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2 * pr;
      ctx.strokeStyle = '#2962FF';
      ctx.stroke();
    }
    ctx.restore();
  }
}
