import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Sector } from './sector';
import { drawControlPoints } from '../../rendering/canvas-utils';

export class SectorPaneView implements IPrimitivePaneView {
  private _renderer: SectorPaneRenderer;

  constructor(drawing: Sector) {
    this._renderer = new SectorPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class SectorPaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: Sector;

  constructor(drawing: Sector) {
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

    if (!viewport || !this._drawing.options.visible || !this._drawing.isValid()) {
      return;
    }

    const sector = this._drawing.getSectorGeometry(viewport);
    if (!sector) {
      return;
    }

    const options = this._drawing.sectorOptions;
    const fillColor = this._drawing.style.fillColor ?? 'rgba(41, 98, 255, 0.16)';
    const centerX = sector.center.x * pixelRatio;
    const centerY = sector.center.y * pixelRatio;
    const radius = sector.radius * pixelRatio;

    ctx.save();
    ctx.strokeStyle = this._drawing.style.lineColor;
    ctx.lineWidth = this._drawing.style.lineWidth * pixelRatio;
    ctx.fillStyle = fillColor;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, sector.startAngle, sector.endAngle, Boolean(options.clockwise));
    ctx.closePath();

    if (options.filled) {
      ctx.fill();
    }
    ctx.stroke();

    ctx.restore();

    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      drawControlPoints(ctx, this._drawing.getControlPoints(viewport), null, pixelRatio);
    }
  }
}
