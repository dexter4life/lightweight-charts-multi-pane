import type { VolumeProfileRenderData } from './fixed-range-volume-profile';

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
