import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { TextAnnotation } from './text-annotation';

export class TextAnnotationPaneView implements IPrimitivePaneView {
  private _renderer: TextAnnotationPaneRenderer;

  constructor(drawing: TextAnnotation) {
    this._renderer = new TextAnnotationPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class TextAnnotationPaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: TextAnnotation;

  constructor(drawing: TextAnnotation) {
    this._drawing = drawing;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      this.drawImpl(scope);
    });
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._drawing;

    const viewport = d.getViewport();
    if (!viewport || !d.isValid()) return;
    if (!d.options.visible || !d.isDisplayed()) return;

    const origin = d.boxOrigin(viewport);
    if (!origin) return;

    const o = d.textOptions;
    const box = d.layout();
    const x = origin.x * pr;
    const y = origin.y * pr;
    const w = box.width * pr;
    const h = box.height * pr;

    ctx.save();
    if (o.fillBackground) {
      ctx.fillStyle = o.backgroundColor ?? 'rgba(91, 133, 191, 0.3)';
      ctx.fillRect(x, y, w, h);
    }
    if (o.drawBorder) {
      ctx.strokeStyle = o.borderColor ?? '#667b8b';
      ctx.lineWidth = pr;
      ctx.strokeRect(x + pr / 2, y + pr / 2, w - pr, h - pr);
    }

    ctx.font = box.font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${Number(n) * pr}px`);
    ctx.fillStyle = d.style.lineColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    box.lines.forEach((line, i) => {
      ctx.fillText(line, x + 4 * pr, y + (1.5 + box.lineHeight * (i + 0.5)) * pr);
    });
    ctx.restore();

    const state = d.state;
    if (state === 'selected' || state === 'editing') {
      for (const cp of d.getControlPoints(viewport)) this.drawHandle(ctx, cp.x * pr, cp.y * pr, pr);
    }
  }

  /** 8px handle: white fill, 1px blue ring, 1px white halo. */
  private drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, pr: number): void {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, 3.5 * pr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = pr;
    ctx.strokeStyle = '#2962FF';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4.5 * pr, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}
