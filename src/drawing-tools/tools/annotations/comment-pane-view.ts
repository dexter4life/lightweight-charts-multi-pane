import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { Comment } from './comment';
import { COMMENT_GEOMETRY } from './comment';

export class CommentPaneView implements IPrimitivePaneView {
  private _renderer: CommentPaneRenderer;

  constructor(drawing: Comment) {
    this._renderer = new CommentPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class CommentPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _drawing: Comment) {}

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

    const g = COMMENT_GEOMETRY;
    const o = d.commentOptions;
    const inset = (g.borderWidth * pr) / 2;
    const L = Math.round(l.box.x * pr) + inset;
    const T = Math.round(l.box.y * pr) + inset;
    const R = Math.round((l.box.x + l.box.w) * pr) - inset;
    const B = Math.round((l.box.y + l.box.h) * pr) - inset;
    const big = Math.min((B - T) / 2, (R - L) / 2);
    const small = g.anchorRadius * pr;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(L + big, T);
    ctx.lineTo(R - big, T);
    ctx.arcTo(R, T, R, T + big, big);
    ctx.lineTo(R, B - big);
    ctx.arcTo(R, B, R - big, B, big);
    ctx.lineTo(L + small, B);
    ctx.arcTo(L, B, L, B - small, small);
    ctx.lineTo(L, T + big);
    ctx.arcTo(L, T, L + big, T, big);
    ctx.closePath();
    ctx.fillStyle = o.backgroundColor ?? '#2962FF';
    ctx.fill();
    ctx.strokeStyle = o.borderColor ?? '#2962FF';
    ctx.lineWidth = g.borderWidth * pr;
    ctx.stroke();

    ctx.font = l.font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${Number(n) * pr}px`);
    ctx.fillStyle = o.textColor ?? '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(l.text, (l.box.x + g.padX) * pr, (l.box.y + l.box.h * 0.618) * pr);

    if (d.state === 'selected' || d.state === 'editing') {
      ctx.beginPath();
      ctx.arc(l.anchor.x * pr, l.anchor.y * pr, g.handleRadius * pr, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2 * pr;
      ctx.strokeStyle = '#2962FF';
      ctx.stroke();
    }
    ctx.restore();
  }
}
