import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { Brush } from './brush';
import type { Point } from '../../core/types';
import { applyStyle } from '../../rendering/canvas-utils';

export class BrushPaneView implements IPrimitivePaneView {
  private _renderer: BrushPaneRenderer;

  constructor(drawing: Brush) {
    this._renderer = new BrushPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class BrushPaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: Brush;

  constructor(drawing: Brush) {
    this._drawing = drawing;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      this.drawImpl(scope);
    });
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;

    const viewport = this._drawing.getViewport();
    if (!viewport) return;
    const drawing = this._drawing;
    if (!drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;

    const points: Point[] = [];
    for (const anchor of drawing.anchors) {
      const p = drawing.anchorToPixel(anchor, viewport);
      if (p) points.push(p);
    }
    if (points.length < 2) return;

    const o = drawing.brushOptions;
    const style = drawing.style;
    ctx.save();
    applyStyle(ctx, style, pr);

    const trace = (): void => {
      ctx.beginPath();
      ctx.moveTo(points[0].x * pr, points[0].y * pr);
      // Quadratic curves through segment midpoints smooth the freehand path.
      for (let i = 1; i < points.length - 1; i++) {
        ctx.quadraticCurveTo(
          points[i].x * pr,
          points[i].y * pr,
          ((points[i].x + points[i + 1].x) / 2) * pr,
          ((points[i].y + points[i + 1].y) / 2) * pr
        );
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x * pr, last.y * pr);
    };

    if (o.backgroundVisible && style.fillColor) {
      trace();
      ctx.closePath();
      ctx.fillStyle = style.fillColor;
      ctx.fill();
    }

    trace();
    ctx.stroke();

    const first = points[0];
    const last = points[points.length - 1];
    if (o.leftEnd === 'arrow') this.drawArrowCap(ctx, first, points.slice(1), pr);
    if (o.rightEnd === 'arrow') this.drawArrowCap(ctx, last, points.slice(0, -1).reverse(), pr);

    const state = drawing.state;
    if (state === 'selected' || state === 'editing') {
      for (const cp of drawing.getControlPoints(viewport)) this.drawHandle(ctx, cp.x * pr, cp.y * pr, pr);
    }
    ctx.restore();
  }

  /** `path` runs away from the tip; the cap direction uses the first point far enough from it. */
  private drawArrowCap(ctx: CanvasRenderingContext2D, tip: Point, path: Point[], pr: number): void {
    const size = 7 * Math.max(1, this._drawing.style.lineWidth);
    let other = path[0];
    for (const p of path) {
      other = p;
      if (Math.hypot(p.x - tip.x, p.y - tip.y) >= size) break;
    }
    const dx = other.x - tip.x;
    const dy = other.y - tip.y;
    if (dx === 0 && dy === 0) return;
    const base = Math.atan2(dy, dx);
    const spread = Math.PI / 4;
    ctx.beginPath();
    for (const sign of [-1, 1]) {
      ctx.moveTo(tip.x * pr, tip.y * pr);
      ctx.lineTo((tip.x + Math.cos(base + sign * spread) * size) * pr, (tip.y + Math.sin(base + sign * spread) * size) * pr);
    }
    ctx.stroke();
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
