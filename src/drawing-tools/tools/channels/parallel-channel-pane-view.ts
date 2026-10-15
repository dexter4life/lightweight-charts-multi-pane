import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { ParallelChannel } from './parallel-channel';
import { PC_BOTTOM_MID, PC_TOP_MID } from './parallel-channel';
import { applyStyle, drawLine } from '../../rendering/canvas-utils';

export class ParallelChannelPaneView implements IPrimitivePaneView {
  private _renderer: ParallelChannelPaneRenderer;

  constructor(drawing: ParallelChannel) {
    this._renderer = new ParallelChannelPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class ParallelChannelPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: ParallelChannel) {}

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
      ctx.moveTo(l.top[0].x * pr, l.top[0].y * pr);
      ctx.lineTo(l.top[1].x * pr, l.top[1].y * pr);
      ctx.lineTo(l.bottom[1].x * pr, l.bottom[1].y * pr);
      ctx.lineTo(l.bottom[0].x * pr, l.bottom[0].y * pr);
      ctx.closePath();
      ctx.fill();
    }

    applyStyle(ctx, d.style, pr);
    ctx.lineCap = 'butt';
    drawLine(ctx, l.top[0], l.top[1], pr);
    drawLine(ctx, l.bottom[0], l.bottom[1], pr);

    if (o.showMiddleLine) {
      ctx.strokeStyle = o.middleColor ?? d.style.lineColor;
      ctx.lineWidth = (o.middleWidth ?? 1) * pr;
      ctx.setLineDash((o.middleDash ?? [6, 6]).map((v) => v * pr));
      drawLine(ctx, l.mid[0], l.mid[1], pr);
    }
    ctx.restore();

    if (d.state === 'selected' || d.state === 'editing') {
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = d.style.lineColor;
      ctx.lineWidth = 2 * pr;
      for (const c of d.getControlPoints(viewport)) {
        ctx.beginPath();
        if (c.index === PC_BOTTOM_MID || c.index === PC_TOP_MID) {
          const half = 4.9 * pr;
          ctx.roundRect((c.x * pr) - half, (c.y * pr) - half, half * 2, half * 2, 3 * pr);
        } else {
          ctx.arc(c.x * pr, c.y * pr, 4.75 * pr, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
