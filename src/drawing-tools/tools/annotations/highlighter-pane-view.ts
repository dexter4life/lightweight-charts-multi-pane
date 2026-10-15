import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { Highlighter } from './highlighter';
import type { Point } from '../../core/types';

export class HighlighterPaneView implements IPrimitivePaneView {
  private _renderer: HighlighterPaneRenderer;

  constructor(drawing: Highlighter) {
    this._renderer = new HighlighterPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class HighlighterPaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: Highlighter;

  constructor(drawing: Highlighter) {
    this._drawing = drawing;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      this.drawImpl(scope);
    });
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio } = scope;
    const pixelRatio = horizontalPixelRatio;

    const viewport = this._drawing.getViewport();
    if (!viewport) return;
    if (!this._drawing.options.visible || !this._drawing.isDisplayed()) return;
    if (!this._drawing.isValid()) return;

    const options = this._drawing.highlighterOptions;
    const highlighterWidth = options.highlighterWidth ?? 20;

    // Get all points
    const points: Point[] = [];
    for (const anchor of this._drawing.anchors) {
      const p = this._drawing.anchorToPixel(anchor, viewport);
      if (p) points.push(p);
    }

    if (points.length < 2) return;

    // Draw the highlighter stroke
    ctx.save();
    ctx.strokeStyle = this._drawing.style.lineColor;
    ctx.lineWidth = highlighterWidth * pixelRatio;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x * pixelRatio, points[0].y * pixelRatio);

    for (let i = 1; i < points.length - 1; i++) {
      ctx.quadraticCurveTo(
        points[i].x * pixelRatio,
        points[i].y * pixelRatio,
        ((points[i].x + points[i + 1].x) / 2) * pixelRatio,
        ((points[i].y + points[i + 1].y) / 2) * pixelRatio
      );
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x * pixelRatio, last.y * pixelRatio);

    ctx.stroke();
    ctx.restore();

    // Draw control points if selected
    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      const controlPoints = this._drawing.getControlPoints(viewport);
      for (const cp of controlPoints) this.drawHandle(ctx, cp.x * pixelRatio, cp.y * pixelRatio, pixelRatio);
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
