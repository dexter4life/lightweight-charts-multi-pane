import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { FixedRangeVolumeProfile, VolumeProfileRenderData } from './fixed-range-volume-profile';
import { drawControlPoints } from '../../rendering/canvas-utils';

export class FixedRangeVolumeProfilePaneView implements IPrimitivePaneView {
  private _renderer: FixedRangeVolumeProfilePaneRenderer;

  constructor(drawing: FixedRangeVolumeProfile) {
    this._renderer = new FixedRangeVolumeProfilePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FixedRangeVolumeProfilePaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: FixedRangeVolumeProfile;

  constructor(drawing: FixedRangeVolumeProfile) {
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

    renderVolumeProfile(ctx, this._drawing.fixedRangeVolumeProfileOptions, data, pixelRatio, viewport);

    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      drawControlPoints(ctx, this._drawing.getControlPoints(viewport), null, pixelRatio);
    }
  }
}

export function renderVolumeProfile(
  ctx: CanvasRenderingContext2D,
  options: {
    side?: 'left' | 'right';
    profileWidth?: number;
    upColor?: string;
    downColor?: string;
    showPoc?: boolean;
    rangeFillColor?: string;
  },
  data: VolumeProfileRenderData,
  pixelRatio: number,
  viewport: { priceScale: { priceToCoordinate(price: number): number | null } }
): void {
  const profileWidth = options.profileWidth ?? 72;
  const side = options.side ?? 'right';
  const upColor = options.upColor ?? 'rgba(38, 166, 154, 0.65)';
  const downColor = options.downColor ?? 'rgba(239, 83, 80, 0.65)';
  const rangeFillColor = options.rangeFillColor ?? 'rgba(41, 98, 255, 0.08)';

  ctx.save();
  ctx.fillStyle = rangeFillColor;
  ctx.fillRect(
    data.left * pixelRatio,
    data.top * pixelRatio,
    (data.right - data.left) * pixelRatio,
    (data.bottom - data.top) * pixelRatio
  );

  data.profile.buckets.forEach((bucket) => {
    const topY = viewport.priceScale.priceToCoordinate(bucket.high);
    const bottomY = viewport.priceScale.priceToCoordinate(bucket.low);
    if (topY === null || bottomY === null || data.profile.maxVolume <= 0) {
      return;
    }

    const height = Math.max(1, Math.abs(bottomY - topY));
    const totalWidth = (bucket.totalVolume / data.profile.maxVolume) * profileWidth;
    const upWidth = bucket.totalVolume > 0 ? totalWidth * (bucket.upVolume / bucket.totalVolume) : 0;
    const downWidth = totalWidth - upWidth;
    const xBase = side === 'right' ? data.right : data.left;
    const xStart = side === 'right' ? xBase - totalWidth : xBase;
    const yStart = Math.min(topY, bottomY);

    ctx.fillStyle = downColor;
    ctx.fillRect(xStart * pixelRatio, yStart * pixelRatio, downWidth * pixelRatio, height * pixelRatio);
    ctx.fillStyle = upColor;
    ctx.fillRect((xStart + downWidth) * pixelRatio, yStart * pixelRatio, upWidth * pixelRatio, height * pixelRatio);
  });

  if (options.showPoc && data.profile.maxVolume > 0) {
    const pocY = viewport.priceScale.priceToCoordinate(data.profile.pocPrice);
    if (pocY !== null) {
      ctx.strokeStyle = '#ffb74d';
      ctx.lineWidth = 1.5 * pixelRatio;
      ctx.beginPath();
      ctx.moveTo(data.left * pixelRatio, pocY * pixelRatio);
      ctx.lineTo(data.right * pixelRatio, pocY * pixelRatio);
      ctx.stroke();
    }
  }

  ctx.restore();
}
