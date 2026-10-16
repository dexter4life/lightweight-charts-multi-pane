import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { NOTE_GEOMETRY, type Note } from './note';

export class NotePaneView implements IPrimitivePaneView {
  private _renderer: NotePaneRenderer;

  constructor(drawing: Note) {
    this._renderer = new NotePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class NotePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _drawing: Note) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._drawing;
    const viewport = d.getViewport();
    if (!viewport || !d.isValid() || !d.options.visible || !d.isDisplayed()) return;
    const p = d.pinPoint(viewport);
    if (!p) return;

    const g = NOTE_GEOMETRY;
    ctx.save();

    if (d.expanded) this.drawBox(ctx, pr, p.x, p.y);

    // Pin: a circle joined to its tip by two tangent lines.
    const cx = p.x * pr;
    const cy = (p.y - g.pinCenter) * pr;
    const r = g.pinRadius * pr;
    const dist = (g.pinCenter - g.pinTip) * pr;
    const alpha = Math.acos(r / dist);
    ctx.beginPath();
    ctx.moveTo(cx, cy + dist);
    ctx.lineTo(cx + r * Math.sin(alpha), cy + r * Math.cos(alpha));
    ctx.arc(cx, cy, r, Math.PI / 2 - alpha, Math.PI / 2 + alpha, true);
    ctx.closePath();
    ctx.fillStyle = d.style.lineColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 7.4 * pr, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    if (d.state === 'selected' || d.state === 'editing') {
      const hx = p.x * pr;
      const hy = p.y * pr;
      ctx.beginPath();
      ctx.arc(hx, hy, 3.5 * pr, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = pr;
      ctx.strokeStyle = '#2962FF';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5 * pr, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBox(ctx: CanvasRenderingContext2D, pr: number, px: number, py: number): void {
    const d = this._drawing;
    const o = d.noteOptions;
    const g = NOTE_GEOMETRY;
    const box = d.layout();
    const x = (px - box.width / 2) * pr;
    const y = (py - g.boxBottom - box.height) * pr;
    const w = box.width * pr;
    const h = box.height * pr;
    const tipX = px * pr;
    const half = g.tail.halfWidth * pr;
    const tail = g.tail.height * pr;

    // Box and tail form one outline; the 1px border is kept crisp on device pixels.
    const L = Math.round(x);
    const T = Math.round(y);
    const R = L + Math.round(w);
    const B = T + Math.round(h);
    const tx = Math.round(tipX);
    ctx.beginPath();
    ctx.moveTo(L + 0.5, T + 0.5);
    ctx.lineTo(R + 0.5, T + 0.5);
    ctx.lineTo(R + 0.5, B + 0.5);
    ctx.lineTo(tx + half + 0.5, B + 0.5);
    ctx.lineTo(tx + 0.5, B + tail + 0.5);
    ctx.lineTo(tx - half + 0.5, B + 0.5);
    ctx.lineTo(L + 0.5, B + 0.5);
    ctx.closePath();
    ctx.fillStyle = o.backgroundColor ?? '';
    ctx.fill();
    ctx.strokeStyle = o.borderColor ?? '';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = box.font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${Number(n) * pr}px`);
    ctx.fillStyle = o.textColor ?? '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    box.lines.forEach((line, i) => {
      ctx.fillText(line, x + g.padX * pr, y + (g.padY + g.textDy + box.lineHeight * (i + 0.5)) * pr);
    });
  }
}
