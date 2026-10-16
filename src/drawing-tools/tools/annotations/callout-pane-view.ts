import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { Callout } from './callout';
import { CALLOUT_GEOMETRY } from './callout';

export class CalloutPaneView implements IPrimitivePaneView {
  private _renderer: CalloutPaneRenderer;

  constructor(drawing: Callout) {
    this._renderer = new CalloutPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class CalloutPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _drawing: Callout) {}

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

    const g = CALLOUT_GEOMETRY;
    const o = d.calloutOptions;
    const bw = Math.max(1, Math.round((o.borderWidth ?? 1) * pr));
    const half = bw % 2 ? 0.5 : 0;
    const L = Math.round(l.box.x * pr) + half;
    const T = Math.round(l.box.y * pr) + half;
    const R = Math.round((l.box.x + l.box.w) * pr) + half;
    const B = Math.round((l.box.y + l.box.h) * pr) + half;
    const r = g.radius * pr;
    const tail = l.tail;
    const apex = tail ? { x: Math.round(tail.apex.x * pr) + half, y: Math.round(tail.apex.y * pr) + half } : null;
    const cx = (L + R) / 2;
    const cy = (T + B) / 2;
    const hb = (g.tailBase / 2) * pr;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(L + r, T);
    if (tail?.kind === 'edge' && tail.side === 'top' && apex) {
      ctx.lineTo(cx - hb, T);
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(cx + hb, T);
    }
    ctx.lineTo(R - r, T);
    if (tail?.kind === 'corner' && tail.corner === 'tr' && apex) {
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(R, T + r);
    } else {
      ctx.arcTo(R, T, R, T + r, r);
    }
    if (tail?.kind === 'edge' && tail.side === 'right' && apex) {
      ctx.lineTo(R, cy - hb);
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(R, cy + hb);
    }
    ctx.lineTo(R, B - r);
    if (tail?.kind === 'corner' && tail.corner === 'br' && apex) {
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(R - r, B);
    } else {
      ctx.arcTo(R, B, R - r, B, r);
    }
    if (tail?.kind === 'edge' && tail.side === 'bottom' && apex) {
      ctx.lineTo(cx + hb, B);
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(cx - hb, B);
    }
    ctx.lineTo(L + r, B);
    if (tail?.kind === 'corner' && tail.corner === 'bl' && apex) {
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(L, B - r);
    } else {
      ctx.arcTo(L, B, L, B - r, r);
    }
    if (tail?.kind === 'edge' && tail.side === 'left' && apex) {
      ctx.lineTo(L, cy + hb);
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(L, cy - hb);
    }
    ctx.lineTo(L, T + r);
    if (tail?.kind === 'corner' && tail.corner === 'tl' && apex) {
      ctx.lineTo(apex.x, apex.y);
      ctx.lineTo(L + r, T);
    } else {
      ctx.arcTo(L, T, L + r, T, r);
    }
    ctx.closePath();
    ctx.fillStyle = o.backgroundColor ?? 'rgba(0, 151, 167, 0.7)';
    ctx.fill();
    ctx.strokeStyle = o.borderColor ?? '#0097A7';
    ctx.lineWidth = bw;
    ctx.lineJoin = 'miter';
    ctx.stroke();

    ctx.font = l.font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${Number(n) * pr}px`);
    ctx.fillStyle = o.textColor ?? '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const textX = (l.box.x + g.padX) * pr;
    l.lines.forEach((line, i) => ctx.fillText(line, textX, (l.box.y + g.padY + l.lineHeight * (i + 0.5)) * pr));

    if (d.state === 'selected' || d.state === 'editing') {
      ctx.beginPath();
      ctx.arc(l.apex.x * pr, l.apex.y * pr, g.handleRadius * pr, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2 * pr;
      ctx.strokeStyle = '#2962FF';
      ctx.stroke();
    }
    ctx.restore();
  }
}
