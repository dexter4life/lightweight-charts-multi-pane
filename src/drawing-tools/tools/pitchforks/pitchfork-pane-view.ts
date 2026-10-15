import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { Pitchfork, PitchforkRay } from './pitchfork';

const HANDLE_COLOR = '#2962FF';

/** The lines and bands sit behind the candles while the handles stay on top of them. */
export class PitchforkPaneView implements IPrimitivePaneView {
  private _renderer: PitchforkPaneRenderer;

  constructor(
    drawing: Pitchfork,
    private readonly _layer: 'body' | 'handles' = 'body'
  ) {
    this._renderer = new PitchforkPaneRenderer(drawing, _layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._layer === 'body' ? 'bottom' : 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

const tail = (r: PitchforkRay) => ({ x: r.start.x - r.dir.x * r.back, y: r.start.y - r.dir.y * r.back });
const head = (r: PitchforkRay) => ({ x: r.start.x + r.dir.x * r.forward, y: r.start.y + r.dir.y * r.forward });

class PitchforkPaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: Pitchfork,
    private readonly _layer: 'body' | 'handles'
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private stroke(
    ctx: CanvasRenderingContext2D,
    pr: number,
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
    width: number,
    dash: number[]
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, Math.round(width * pr));
    ctx.setLineDash(dash.map((d) => d * pr));
    ctx.beginPath();
    ctx.moveTo(from.x * pr, from.y * pr);
    ctx.lineTo(to.x * pr, to.y * pr);
    ctx.stroke();
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isDisplayed()) return;

    const layout = drawing.layout(viewport);
    if (!layout) return;

    const o = drawing.pitchforkOptions;
    const { lineColor, lineWidth, lineDash } = drawing.style;
    const dash = lineDash ?? [];
    const state = drawing.state;

    ctx.save();
    ctx.lineCap = 'butt';

    if (this._layer === 'handles') {
      if (state === 'selected' || state === 'editing' || state === 'hovered') {
        drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, HANDLE_COLOR);
      }
      ctx.restore();
      return;
    }

    if (layout.partial) {
      const ray = drawing.partialRay(layout, viewport);
      if (ray) this.stroke(ctx, pr, tail(ray), head(ray), lineColor, lineWidth, dash);
    } else {
      for (const l of layout.levels) {
        this.stroke(ctx, pr, tail(l), head(l), l.level.color, l.level.width, l.level.dash);
      }
      if (layout.median) this.stroke(ctx, pr, tail(layout.median), head(layout.median), lineColor, lineWidth, dash);
      for (const [p, q] of layout.segments) this.stroke(ctx, pr, p, q, lineColor, lineWidth, dash);

      // Painted over the lines, which is how the reference tints them; each band takes the colour of the level farther from the median.
      if (o.backgroundVisible && layout.median) {
        // Bands begin on the B–C line, so the median edge starts there even when the median itself starts earlier.
        const m = layout.median;
        const bc = { x: (layout.b.x + layout.c.x) / 2, y: (layout.b.y + layout.c.y) / 2 };
        const medianEdge: PitchforkRay = layout.fan ? m : { start: bc, dir: m.dir, back: m.back > 0 ? m.forward : 0, forward: m.forward };
        const edges: Array<{ ray: PitchforkRay; signed: number; color: string }> = [
          ...layout.levels.map((l) => ({ ray: l as PitchforkRay, signed: l.signed, color: l.level.color })),
          { ray: medianEdge, signed: 0, color: lineColor },
        ].sort((p, q) => p.signed - q.signed);
        ctx.globalAlpha = o.backgroundOpacity ?? 0.2;
        for (let i = 1; i < edges.length; i++) {
          const p = edges[i - 1];
          const q = edges[i];
          const outer = Math.abs(p.signed) > Math.abs(q.signed) ? p : q;
          ctx.fillStyle = outer.color;
          ctx.beginPath();
          ctx.moveTo(tail(p.ray).x * pr, tail(p.ray).y * pr);
          ctx.lineTo(head(p.ray).x * pr, head(p.ray).y * pr);
          ctx.lineTo(head(q.ray).x * pr, head(q.ray).y * pr);
          ctx.lineTo(tail(q.ray).x * pr, tail(q.ray).y * pr);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
}
