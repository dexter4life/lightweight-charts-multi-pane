import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { GannSquare } from './gann-square';

const HANDLE_COLOR = '#2962FF';
const LABEL_COLOR = '#787B86';
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const LABEL_GAP_X = 15;
const LABEL_GAP_ABOVE = 14;
const LABEL_GAP_BELOW = 16;

/** The square sits behind the candles while the handles stay on top of them. */
export class GannSquarePaneView implements IPrimitivePaneView {
  private _renderer: GannSquarePaneRenderer;

  constructor(
    drawing: GannSquare,
    private readonly _layer: 'body' | 'handles' = 'body'
  ) {
    this._renderer = new GannSquarePaneRenderer(drawing, _layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._layer === 'body' ? 'bottom' : 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class GannSquarePaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: GannSquare,
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
    const { origin, left, right, top, bottom, ux, uy } = layout;
    const crisp = (v: number, w: number) => (w % 2 === 1 ? Math.round(v * pr - 0.5) + 0.5 : Math.round(v * pr));
    const lineWidth = (w: number) => Math.max(1, Math.round(w * pr));
    const ellipse = (rx: number, ry: number, ccw = false) =>
      ctx.ellipse(origin.x * pr, origin.y * pr, Math.max(rx, 0) * pr, Math.max(ry, 0) * pr, 0, 0, Math.PI * 2, ccw);

    ctx.beginPath();
    ctx.rect(left * pr, top * pr, (right - left) * pr, (bottom - top) * pr);
    ctx.clip();

    const arcs = (o.arcs ?? []).filter((a) => a.visible).sort((p, q) => drawing.arcRadii(layout, p).rho - drawing.arcRadii(layout, q).rho);

    // Each band takes the colour of the larger arc that closes it.
    if (o.arcsBackground !== false) {
      ctx.globalAlpha = o.arcsOpacity ?? 0.2;
      let inner: { rx: number; ry: number } | null = null;
      for (const arc of arcs) {
        const outer = drawing.arcRadii(layout, arc);
        ctx.fillStyle = arc.color;
        ctx.beginPath();
        ellipse(outer.rx, outer.ry);
        if (inner && inner.rx > 0) {
          ctx.moveTo(origin.x * pr + inner.rx * pr, origin.y * pr);
          ellipse(inner.rx, inner.ry, true);
        }
        ctx.fill('evenodd');
        inner = outer;
      }
      ctx.globalAlpha = 1;
    }

    (o.levels ?? []).forEach((l, i) => {
      if (!l.visible) return;
      const w = lineWidth(l.width);
      ctx.lineWidth = w;
      ctx.strokeStyle = l.color;
      const y = origin.y + uy * i;
      const x = origin.x + ux * i;
      ctx.beginPath();
      ctx.moveTo(left * pr, crisp(y, w));
      ctx.lineTo(right * pr, crisp(y, w));
      ctx.moveTo(crisp(x, w), top * pr);
      ctx.lineTo(crisp(x, w), bottom * pr);
      ctx.stroke();
    });

    for (const fan of o.fanlines ?? []) {
      if (!fan.visible) continue;
      const end = drawing.fanTip(layout, fan);
      ctx.lineWidth = lineWidth(fan.width);
      ctx.strokeStyle = fan.color;
      ctx.beginPath();
      ctx.moveTo(origin.x * pr, origin.y * pr);
      ctx.lineTo(end.x * pr, end.y * pr);
      ctx.stroke();
    }

    for (const arc of arcs) {
      const r = drawing.arcRadii(layout, arc);
      ctx.lineWidth = lineWidth(arc.width);
      ctx.strokeStyle = arc.color;
      ctx.beginPath();
      ellipse(r.rx, r.ry);
      ctx.stroke();
    }
    ctx.restore();

    if (drawing.squareOptions.showLabels !== false && drawing.squareOptions.scaleRatio !== undefined) {
      this.drawLabels(scope, layout);
    }
  }

  /** Bars sit at the corner above or below the far point's column, the price range at the origin's column, the ratio at the far point. */
  private drawLabels(scope: BitmapCoordinatesRenderingScope, layout: NonNullable<ReturnType<GannSquare['layout']>>): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const viewport = this._drawing.getViewport();
    if (!viewport) return;
    const style = this._drawing.labelsStyle;
    const texts = this._drawing.labelTexts(layout, viewport);
    const { origin, far, left, right, top, bottom } = layout;
    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;

    ctx.save();
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${style.fontSize * pr}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'alphabetic';
    const ascent = ctx.measureText('0').actualBoundingBoxAscent / pr;

    const put = (text: string, cx: number, cy: number) => {
      const onRight = cx >= midX;
      const onTop = cy <= midY;
      ctx.textAlign = onRight ? 'left' : 'right';
      const x = onRight ? cx + LABEL_GAP_X : cx - LABEL_GAP_X;
      const baseline = onTop ? cy - LABEL_GAP_ABOVE : cy + LABEL_GAP_BELOW + ascent;
      ctx.fillText(text, x * pr, baseline * pr);
    };
    put(texts.bars, far.x, origin.y);
    put(texts.price, origin.x, far.y);
    put(texts.ratio, far.x, far.y);
    ctx.restore();
  }
}
