import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import { drawControlPoints } from '../../rendering/canvas-utils';
import type { ArrowMarker } from './arrow-marker';
import { ARROW_MARKER_FONT, ARROW_MARKER_GEOMETRY } from './arrow-marker';

export class ArrowMarkerPaneView implements IPrimitivePaneView {
  private _renderer: ArrowMarkerPaneRenderer;

  constructor(private _drawing: ArrowMarker) {
    this._renderer = new ArrowMarkerPaneRenderer(_drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return this._drawing.state === 'selected' || this._drawing.state === 'editing' || this._drawing.placedCount !== null ? 'top' : 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class ArrowMarkerPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private _drawing: ArrowMarker) {}

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
    const o = d.arrowMarkerOptions;
    const color = o.backgroundColor ?? '#1E53E5';

    if (l.polygon.length) {
      ctx.save();
      ctx.beginPath();
      l.polygon.forEach((p, i) => (i ? ctx.lineTo(p.x * pr, p.y * pr) : ctx.moveTo(p.x * pr, p.y * pr)));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineJoin = 'round';
      ctx.lineWidth = ARROW_MARKER_GEOMETRY.outline * pr;
      ctx.stroke();
      ctx.restore();
    }

    if (o.showText && o.text) {
      const size = o.textSize ?? 16;
      const lines = o.text.split('\n');
      const lh = size * 1.2;
      ctx.save();
      ctx.font = `${o.textItalic ? 'italic ' : ''}${o.textBold ? 'bold ' : ''}${size * pr}px ${ARROW_MARKER_FONT}`;
      ctx.fillStyle = o.textColor ?? color;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const x = (l.p1.x - ARROW_MARKER_GEOMETRY.textGap) * pr;
      const top = l.p1.y - ((lines.length - 1) * lh) / 2;
      lines.forEach((line, i) => ctx.fillText(line, x, (top + i * lh) * pr));
      ctx.restore();
    }

    const active = d.state === 'selected' || d.state === 'editing';
    const placing = d.placedCount !== null && d.placedCount < 2;
    if (active || placing) drawControlPoints(ctx, d.getControlPoints(viewport), null, pr, color);
  }
}
