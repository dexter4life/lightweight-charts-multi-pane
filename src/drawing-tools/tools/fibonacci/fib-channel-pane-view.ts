import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawLine } from '../../rendering/canvas-utils';
import type { FibChannel } from './fib-channel';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const HANDLE_COLOR = '#2962FF';

export class FibChannelPaneView implements IPrimitivePaneView {
  private _renderer: FibChannelPaneRenderer;

  constructor(drawing: FibChannel) {
    this._renderer = new FibChannelPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FibChannelPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: FibChannel) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isDisplayed()) return;

    const layout = drawing.channelLayout(viewport);
    if (!layout) return;

    const o = drawing.fibOptions;
    const state = drawing.state;
    ctx.save();

    if (layout.guide) {
      applyStyle(ctx, { ...drawing.style, lineDash: [] }, pr);
      drawLine(ctx, layout.guide[0], layout.guide[1], pr);
    } else {
      const segs = layout.segments;
      // Each band takes the colour of the lower-valued level.
      if (o.backgroundVisible) {
        ctx.globalAlpha = o.backgroundOpacity ?? 0.2;
        for (let i = 1; i < segs.length; i++) {
          const a = segs[i - 1];
          const b = segs[i];
          ctx.fillStyle = a.level.color;
          ctx.beginPath();
          ctx.moveTo(a.a.x * pr, a.a.y * pr);
          ctx.lineTo(a.b.x * pr, a.b.y * pr);
          ctx.lineTo(b.b.x * pr, b.b.y * pr);
          ctx.lineTo(b.a.x * pr, b.a.y * pr);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.lineWidth = Math.max(1, Math.round((o.levelsWidth ?? 1) * pr));
      ctx.lineCap = 'butt';
      ctx.setLineDash((o.levelsDash ?? []).map((d) => d * pr));
      for (const s of segs) {
        ctx.strokeStyle = s.level.color;
        ctx.beginPath();
        ctx.moveTo(s.a.x * pr, s.a.y * pr);
        ctx.lineTo(s.b.x * pr, s.b.y * pr);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.font = `${(o.fontSize ?? 12) * pr}px ${FONT_FAMILY}`;
      for (const label of drawing.labelItems(layout, viewport.width)) {
        ctx.textAlign = label.align;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = label.color;
        ctx.fillText(label.text, label.x * pr, label.baseline * pr);
      }
    }

    if (state === 'selected' || state === 'editing' || state === 'hovered') {
      ctx.setLineDash([]);
      drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, HANDLE_COLOR);
    }
    ctx.restore();
  }
}
