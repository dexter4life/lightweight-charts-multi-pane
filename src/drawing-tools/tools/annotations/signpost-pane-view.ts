import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { SIGNPOST_GEOMETRY, type Signpost } from './signpost';

export class SignpostPaneView implements IPrimitivePaneView {
  private _renderer: SignpostPaneRenderer;

  constructor(drawing: Signpost) {
    this._renderer = new SignpostPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class SignpostPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _drawing: Signpost) {}

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

    const g = SIGNPOST_GEOMETRY;
    const o = d.signpostOptions;
    ctx.save();

    // Stem from the label to the bar.
    if (l.stem) {
      const sx = Math.round(l.x * pr) + 0.5;
      ctx.strokeStyle = g.stemColor;
      ctx.lineWidth = pr;
      ctx.beginPath();
      ctx.moveTo(sx, l.stem.from * pr);
      ctx.lineTo(sx, Math.round(l.stem.to * pr) + 0.5);
      ctx.stroke();
    }

    if (l.emoji) {
      const cx = l.emoji.cx * pr;
      const cy = l.emoji.cy * pr;
      ctx.beginPath();
      ctx.arc(cx, cy, g.emojiRadius * pr, 0, Math.PI * 2);
      ctx.fillStyle = o.pinColor ?? '#3861F6';
      ctx.fill();
      ctx.font = `${g.emojiSize * pr}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000';
      ctx.fillText(o.emoji ?? '🙂', cx, cy + pr);
    }

    // Label: a rounded box whose 1px border stays crisp on device pixels.
    const L = Math.round(l.box.x * pr);
    const T = Math.round(l.box.y * pr);
    const W = Math.round(l.box.w * pr);
    const H = Math.round(l.box.h * pr);
    const r = g.radius * pr;
    ctx.beginPath();
    ctx.roundRect(L + 0.5, T + 0.5, W, H, r);
    ctx.fillStyle = o.backgroundColor ?? '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = o.borderColor ?? '#E1E3EA';
    ctx.lineWidth = 1;
    ctx.stroke();

    const { font } = d.textMetrics();
    ctx.font = font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${Number(n) * pr}px`);
    ctx.fillStyle = o.textColor ?? '#1F1F1F';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.text ?? '', l.box.x * pr + (l.box.w * pr) / 2, (l.box.y + l.box.h / 2 + g.textDy) * pr);

    if (d.state === 'selected' || d.state === 'editing') {
      const hh = g.handleHalf * pr;
      const hx = Math.round(l.x * pr);
      const hy = Math.round(l.anchorY * pr);
      ctx.beginPath();
      ctx.roundRect(hx - hh, hy - hh, hh * 2, hh * 2, 3 * pr);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2 * pr;
      ctx.strokeStyle = '#2962FF';
      ctx.stroke();
    }
    ctx.restore();
  }
}
