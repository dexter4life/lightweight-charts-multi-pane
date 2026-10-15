import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { AnchoredVolumeProfile } from './anchored-volume-profile';
import { renderVolumeProfile } from './fixed-range-volume-profile-pane-view';
import { drawControlPoints } from '../../rendering/canvas-utils';

export class AnchoredVolumeProfilePaneView implements IPrimitivePaneView {
  private _renderer: AnchoredVolumeProfilePaneRenderer;

  constructor(drawing: AnchoredVolumeProfile) {
    this._renderer = new AnchoredVolumeProfilePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class AnchoredVolumeProfilePaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: AnchoredVolumeProfile;

  constructor(drawing: AnchoredVolumeProfile) {
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

    const data = this._drawing.getProfileRenderData(viewport);
    if (!data) {
      return;
    }

    renderVolumeProfile(ctx, this._drawing.anchoredVolumeProfileOptions, data, pixelRatio, viewport);

    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      drawControlPoints(ctx, this._drawing.getControlPoints(viewport), null, pixelRatio);
    }
  }
}
