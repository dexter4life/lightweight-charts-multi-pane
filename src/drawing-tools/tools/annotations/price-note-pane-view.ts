import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { PriceNote } from './price-note';
import { PRICE_NOTE_FONT, PRICE_NOTE_GEOMETRY } from './price-note';

const TEXT_GAP = 4;

export class PriceNotePaneView implements IPrimitivePaneView {
  private _renderer: PriceNotePaneRenderer;

  constructor(private _drawing: PriceNote) {
    this._renderer = new PriceNotePaneRenderer(_drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._drawing.state === 'selected' || this._drawing.state === 'editing' ? 'top' : 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class PriceNotePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _drawing: PriceNote) {}

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

    const g = PRICE_NOTE_GEOMETRY;
    const o = d.priceNoteOptions;
    const color = d.style.lineColor;
    const active = d.state === 'selected' || d.state === 'editing';
    const placing = d.placedCount !== null && d.placedCount < 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, Math.round(pr * d.style.lineWidth));
    ctx.beginPath();
    ctx.moveTo(l.p1.x * pr, l.p1.y * pr);
    ctx.lineTo(l.p2.x * pr, l.p2.y * pr);
    ctx.stroke();

    if (o.showText && o.text) this.drawCaption(ctx, l.p1, l.p2, pr);

    const L = Math.round(l.box.x * pr);
    const T = Math.round(l.box.y * pr);
    const R = Math.round((l.box.x + l.box.w) * pr);
    const B = Math.round((l.box.y + l.box.h) * pr);
    const r = g.radius * pr;
    ctx.beginPath();
    ctx.moveTo(L + r, T);
    ctx.arcTo(R, T, R, B, r);
    ctx.arcTo(R, B, L, B, r);
    ctx.arcTo(L, B, L, T, r);
    ctx.arcTo(L, T, R, T, r);
    ctx.closePath();
    ctx.fillStyle = o.priceLabelBackgroundColor ?? '#2962FF';
    ctx.fill();
    ctx.strokeStyle = o.priceLabelBorderColor ?? '#2962FF';
    ctx.lineWidth = pr;
    ctx.stroke();

    ctx.font = l.font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${Number(n) * pr}px`);
    ctx.fillStyle = o.priceLabelTextColor ?? '#FFFFFF';
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
    ctx.restore();

    if (active || placing) {
      drawControlPoints(ctx, d.getControlPoints(viewport), null, pr, color);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(l.p1.x * pr, l.p1.y * pr, g.dotRadius * pr, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCaption(ctx: CanvasRenderingContext2D, p1: { x: number; y: number }, p2: { x: number; y: number }, pr: number): void {
    const o = this._drawing.priceNoteOptions;
    const left = p1.x <= p2.x ? p1 : p2;
    const right = left === p1 ? p2 : p1;
    const angle = Math.atan2(right.y - left.y, right.x - left.x);
    const hAlign = o.textHAlign ?? 'center';
    const vAlign = o.textVAlign ?? 'bottom';
    const anchor = hAlign === 'left' ? left : hAlign === 'right' ? right : { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    const size = o.textSize ?? 14;

    ctx.save();
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.translate(anchor.x, anchor.y);
    ctx.rotate(angle);
    ctx.font = `${o.textItalic ? 'italic ' : ''}${o.textBold ? 'bold ' : ''}${size}px ${PRICE_NOTE_FONT}`;
    ctx.fillStyle = o.textColor ?? this._drawing.style.lineColor;
    ctx.textAlign = hAlign;
    const lines = (o.text ?? '').split('\n');
    const lh = size * 1.2;
    // The reference lists the caption above the line for 'Bottom' and below it for 'Top'
    const above = vAlign === 'bottom';
    const below = vAlign === 'top';
    ctx.textBaseline = above ? 'bottom' : below ? 'top' : 'middle';
    const start = above ? -TEXT_GAP - (lines.length - 1) * lh : below ? TEXT_GAP : -((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => ctx.fillText(line, 0, start + i * lh));
    ctx.restore();
  }
}
