import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { GannSquareFixed } from './gann-square-fixed';

const HANDLE_COLOR = '#2962FF';

/** The square sits behind the candles while the handles stay on top of them. */
export class GannSquareFixedPaneView implements IPrimitivePaneView {
  private _renderer: GannSquareFixedPaneRenderer;

  constructor(
    drawing: GannSquareFixed,
    private readonly _layer: 'body' | 'handles' = 'body'
  ) {
    this._renderer = new GannSquareFixedPaneRenderer(drawing, _layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._layer === 'body' ? 'bottom' : 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class GannSquareFixedPaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: GannSquareFixed,
    private readonly _layer: 'body' | 'handles'
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isDisplayed()) return;
    const layout = drawing.layout(viewport);
    if (!layout) return;

    ctx.save();
    ctx.lineCap = 'butt';

    if (this._layer === 'handles') {
      const st = drawing.state;
      if (st === 'selected' || st === 'editing' || st === 'hovered') {
        drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, HANDLE_COLOR);
      }
      ctx.restore();
      return;
    }

    const o = drawing.gannOptions;
    const { origin, left, right, top, bottom, sx, sy } = layout;
    const crisp = (v: number, w: number) => (w % 2 === 1 ? Math.round(v * pr - 0.5) + 0.5 : Math.round(v * pr));
    const lineWidth = (w: number) => Math.max(1, Math.round(w * pr));

    ctx.beginPath();
    ctx.rect(left * pr, top * pr, (right - left) * pr, (bottom - top) * pr);
    ctx.clip();

    const arcs = (o.arcs ?? []).filter((a) => a.visible).sort((p, q) => drawing.arcRadius(layout, p) - drawing.arcRadius(layout, q));

    // Each band takes the colour of the larger arc that closes it.
    if (o.arcsBackground !== false) {
      ctx.globalAlpha = o.arcsOpacity ?? 0.2;
      let inner = 0;
      for (const arc of arcs) {
        const outer = drawing.arcRadius(layout, arc);
        ctx.fillStyle = arc.color;
        ctx.beginPath();
        ctx.arc(origin.x * pr, origin.y * pr, outer * pr, 0, Math.PI * 2);
        if (inner > 0) {
          ctx.moveTo(origin.x * pr + inner * pr, origin.y * pr);
          ctx.arc(origin.x * pr, origin.y * pr, inner * pr, 0, Math.PI * 2, true);
        }
        ctx.fill('evenodd');
        inner = outer;
      }
      ctx.globalAlpha = 1;
    }

    (o.levels ?? []).forEach((l, i) => {
      if (!l.visible) return;
      const d = drawing.levelOffset(layout, i);
      const w = lineWidth(l.width);
      ctx.lineWidth = w;
      ctx.strokeStyle = l.color;
      const y = origin.y + sy * d;
      const x = origin.x + sx * d;
      ctx.beginPath();
      ctx.moveTo(left * pr, crisp(y, w));
      ctx.lineTo(right * pr, crisp(y, w));
      ctx.moveTo(crisp(x, w), top * pr);
      ctx.lineTo(crisp(x, w), bottom * pr);
      ctx.stroke();
    });

    for (const fan of o.fanlines ?? []) {
      if (!fan.visible) continue;
      const end = drawing.fanEnd(layout, fan);
      ctx.lineWidth = lineWidth(fan.width);
      ctx.strokeStyle = fan.color;
      ctx.beginPath();
      ctx.moveTo(origin.x * pr, origin.y * pr);
      ctx.lineTo(end.x * pr, end.y * pr);
      ctx.stroke();
    }

    for (const arc of arcs) {
      ctx.lineWidth = lineWidth(arc.width);
      ctx.strokeStyle = arc.color;
      ctx.beginPath();
      ctx.arc(origin.x * pr, origin.y * pr, drawing.arcRadius(layout, arc) * pr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
