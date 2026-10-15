import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { FibSpeedFan } from './fib-speed-fan';

const HANDLE_COLOR = '#2962FF';
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const FONT_SIZE = 12;
const LABEL_GAP = 10;

const fmt = (v: number) => String(+v.toFixed(3));

export class FibSpeedFanPaneView implements IPrimitivePaneView {
  private _renderer: FibSpeedFanPaneRenderer;

  constructor(
    drawing: FibSpeedFan,
    layer: 'body' | 'handles' = 'body'
  ) {
    this._renderer = new FibSpeedFanPaneRenderer(drawing, layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FibSpeedFanPaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: FibSpeedFan,
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

    const box = drawing.box(viewport);
    if (!box) return;
    const o = drawing.fibOptions;
    const style = drawing.style;
    const rays = drawing.rays(box);
    const { a } = box;
    const reach = (viewport.width + viewport.height) * 4;
    const tip = (ray: { dx: number; dy: number }) => {
      const len = Math.hypot(ray.dx, ray.dy) || 1;
      return { x: a.x + (ray.dx / len) * reach, y: a.y + (ray.dy / len) * reach };
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, viewport.width * pr, viewport.height * pr);
    ctx.clip();

    const grid = o.grid;
    if (grid?.visible) {
      ctx.strokeStyle = grid.color;
      ctx.lineWidth = Math.max(1, Math.round(grid.width * pr));
      ctx.setLineDash((grid.dash ?? []).map((d) => d * pr));
      const hair = (v: number) => Math.round(v * pr) + 0.5 * (ctx.lineWidth % 2);
      ctx.beginPath();
      for (const l of o.hlevels ?? []) {
        if (!l.enabled) continue;
        const y = hair(drawing.levelY(box, l.value));
        ctx.moveTo(Math.round(box.left * pr), y);
        ctx.lineTo(Math.round(box.right * pr), y);
      }
      for (const l of o.vlevels ?? []) {
        if (!l.enabled) continue;
        const x = hair(drawing.levelX(box, l.value));
        ctx.moveTo(x, Math.round(box.top * pr));
        ctx.lineTo(x, Math.round(box.bottom * pr));
      }
      ctx.stroke();
    }

    if (o.fillBackground !== false) {
      ctx.globalAlpha = o.backgroundOpacity ?? 0.2;
      for (const { from, to, color } of drawing.fills(rays)) {
        const p = tip(from);
        const q = tip(to);
        ctx.fillStyle = color;
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
    ctx.lineWidth = Math.max(1, Math.round((style.lineWidth || 1) * pr));
    ctx.setLineDash((style.lineDash ?? []).map((d) => d * pr));
    for (const ray of rays) {
      const end = tip(ray);
      ctx.strokeStyle = ray.level.color;
      ctx.beginPath();
      ctx.moveTo(a.x * pr, a.y * pr);
      ctx.lineTo(end.x * pr, end.y * pr);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.font = `${FONT_SIZE * pr}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    const text = (s: string, x: number, y: number, align: CanvasTextAlign, color: string) => {
      ctx.textAlign = align;
      ctx.fillStyle = color;
      ctx.fillText(s, x * pr, y * pr);
    };
    for (const l of o.hlevels ?? []) {
      if (!l.enabled) continue;
      const y = drawing.levelY(box, l.value);
      if (o.showLeftLabels !== false) text(fmt(l.value), box.left - LABEL_GAP, y, 'right', l.color);
      if (o.showRightLabels !== false) text(fmt(l.value), box.right + LABEL_GAP, y, 'left', l.color);
    }
    for (const l of o.vlevels ?? []) {
      if (!l.enabled) continue;
      const x = drawing.levelX(box, l.value);
      if (o.showTopLabels !== false) text(fmt(l.value), x, box.top - LABEL_GAP - 5, 'center', l.color);
      if (o.showBottomLabels !== false) text(fmt(l.value), x, box.bottom + LABEL_GAP + 5, 'center', l.color);
    }
    ctx.restore();
  }
}
