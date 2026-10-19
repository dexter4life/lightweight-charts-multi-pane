import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import { defaultFontFamily as FONT_FAMILY } from '../../../helpers/make-font';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { GannFan } from './gann-fan';

const HANDLE_COLOR = '#2962FF';
const LABEL_OFFSET_X = 4;
const LABEL_OFFSET_Y = 1;
const FONT_SIZE = 12;

export class GannFanPaneView implements IPrimitivePaneView {
  private _renderer: GannFanPaneRenderer;

  constructor(
    drawing: GannFan,
    layer: 'body' | 'handles' = 'body'
  ) {
    this._renderer = new GannFanPaneRenderer(drawing, layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class GannFanPaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: GannFan,
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

    if (this._layer === 'handles') {
      const st = drawing.state;
      if (st === 'selected' || st === 'editing' || st === 'hovered') {
        ctx.save();
        drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, HANDLE_COLOR);
        ctx.restore();
      }
      return;
    }

    const r = drawing.rays(viewport);
    if (!r || r.rays.length === 0) return;
    const o = drawing.gannOptions;
    const { a, b } = r;
    const reach = (viewport.width + viewport.height) * 4;
    const tip = (ray: { dx: number; dy: number }) => {
      const len = Math.hypot(ray.dx, ray.dy) || 1;
      return { x: a.x + (ray.dx / len) * reach, y: a.y + (ray.dy / len) * reach };
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, viewport.width * pr, viewport.height * pr);
    ctx.clip();

    if (o.fillBackground !== false) {
      ctx.globalAlpha = o.backgroundOpacity ?? 0.2;
      for (const { from, to } of drawing.fills(r.rays)) {
        const p = tip(from);
        const q = tip(to);
        ctx.fillStyle = from.level.color;
        ctx.beginPath();
        ctx.moveTo(a.x * pr, a.y * pr);
        ctx.lineTo(p.x * pr, p.y * pr);
        ctx.lineTo(q.x * pr, q.y * pr);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.lineCap = 'butt';
    for (const ray of r.rays) {
      const end = tip(ray);
      ctx.lineWidth = Math.max(1, Math.round(ray.level.width * pr));
      ctx.strokeStyle = ray.level.color;
      ctx.setLineDash((ray.level.dash ?? []).map((d) => d * pr));
      ctx.beginPath();
      ctx.moveTo(a.x * pr, a.y * pr);
      ctx.lineTo(end.x * pr, end.y * pr);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (o.showLabels !== false) {
      ctx.font = `${FONT_SIZE * pr}px ${FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (const ray of r.rays) {
        const p = drawing.labelPoint(a, b, ray.level);
        ctx.fillStyle = ray.level.color;
        ctx.fillText(`${ray.level.coeff1}/${ray.level.coeff2}`, (p.x + LABEL_OFFSET_X) * pr, (p.y + LABEL_OFFSET_Y) * pr);
      }
    }
    ctx.restore();
  }
}
