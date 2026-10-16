import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { FlagMark } from './flag-mark';
import { FLAG_MARK_GEOMETRY, FLAG_MARK_POLE_COLOR } from './flag-mark';

export class FlagMarkPaneView implements IPrimitivePaneView {
  private _renderer: FlagMarkPaneRenderer;

  constructor(private _drawing: FlagMark) {
    this._renderer = new FlagMarkPaneRenderer(_drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._drawing.state === 'selected' || this._drawing.state === 'editing' || this._drawing.placedCount !== null ? 'top' : 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FlagMarkPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _drawing: FlagMark) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._drawing;
    const viewport = d.getViewport();
    if (!viewport || !d.isValid() || !d.options.visible || !d.isDisplayed()) return;
    const l = d.layout(viewport);
    if (!l) return;
    const color = d.flagMarkOptions.flagColor ?? d.style.lineColor;
    const g = FLAG_MARK_GEOMETRY;
    const { x, y } = l.anchor;

    ctx.save();
    ctx.setTransform(pr, 0, 0, pr, 0, 0);

    // The round caps add 1px at each end, so the stroke is inset by that amount.
    ctx.strokeStyle = FLAG_MARK_POLE_COLOR;
    ctx.lineWidth = g.poleWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - g.poleHeight + 1);
    ctx.lineTo(x, y - 2);
    ctx.stroke();

    const left = x + g.clothLeft;
    const right = x + g.clothRight;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(left, y + g.clothTop);
    ctx.bezierCurveTo(left + 5.5, y + g.clothTop - 1.75, left + 10.5, y + g.clothTop + 2.75, right, y + g.clothTop + 1.25);
    ctx.lineTo(right, y + g.clothBottom + 0.75);
    ctx.bezierCurveTo(right - 5.5, y + g.clothBottom + 3, left + 5.5, y + g.clothBottom - 1.5, left, y + g.clothBottom);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const active = d.state === 'selected' || d.state === 'editing';
    const placing = d.placedCount !== null && d.placedCount < 1;
    if (active || placing) drawControlPoints(ctx, d.getControlPoints(viewport), null, pr, color);
  }
}
