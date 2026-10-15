import type { Time } from '../../../model/horz-scale-behavior-time/types';
import { convertTime } from '../../../model/horz-scale-behavior-time/time-utils';

export interface SeriesDatumLike {
  time: Time;
  value?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  [key: string]: unknown;
}

export interface ResolvedSeriesBar {
  time: Time;
  index: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  hasExplicitVolume: boolean;
}

export interface VolumeProfileBucket {
  low: number;
  high: number;
  upVolume: number;
  downVolume: number;
  totalVolume: number;
}

export interface VolumeProfileData {
  minPrice: number;
  maxPrice: number;
  bucketSize: number;
  buckets: VolumeProfileBucket[];
  pocIndex: number;
  pocPrice: number;
  maxVolume: number;
}

export function timeToKey(time: Time): number {
  return Number((convertTime(time) as unknown as { timestamp: number }).timestamp);
}

export function resolveSeriesBars(data: readonly SeriesDatumLike[]): ResolvedSeriesBar[] {
  const bars: ResolvedSeriesBar[] = [];
  let previousClose: number | null = null;

  for (let index = 0; index < data.length; index += 1) {
    const item = data[index];
    const value = typeof item.value === 'number' ? item.value : null;
    const hasOhlc =
      typeof item.open === 'number' &&
      typeof item.high === 'number' &&
      typeof item.low === 'number' &&
      typeof item.close === 'number';

    if (!hasOhlc && value === null) {
      continue;
    }

    const open = hasOhlc ? item.open! : previousClose ?? value!;
    const close = hasOhlc ? item.close! : value!;
    const high = hasOhlc ? item.high! : Math.max(open, close);
    const low = hasOhlc ? item.low! : Math.min(open, close);
    const explicitVolume = typeof item.volume === 'number' && Number.isFinite(item.volume)
      ? Math.max(item.volume, 0)
      : null;
    const proxyVolume = Math.max(Math.abs(high - low), 1);

    bars.push({
      time: item.time,
      index,
      open,
      high,
      low,
      close,
      volume: explicitVolume ?? proxyVolume,
      hasExplicitVolume: explicitVolume !== null,
    });

    previousClose = close;
  }

  return bars;
}

export function findNearestBarIndex(bars: readonly ResolvedSeriesBar[], time: Time): number {
  if (bars.length === 0) {
    return -1;
  }

  const target = timeToKey(time);
  let left = 0;
  let right = bars.length - 1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const value = timeToKey(bars[middle].time);

    if (value === target) {
      return middle;
    }

    if (value < target) {
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  if (left <= 0) {
    return 0;
  }

  if (left >= bars.length) {
    return bars.length - 1;
  }

  const previous = timeToKey(bars[left - 1].time);
  const next = timeToKey(bars[left].time);
  return Math.abs(previous - target) <= Math.abs(next - target) ? left - 1 : left;
}

export function sliceBarsInRange(
  bars: readonly ResolvedSeriesBar[],
  startTime: Time,
  endTime: Time
): ResolvedSeriesBar[] {
  if (bars.length === 0) {
    return [];
  }

  const minKey = Math.min(timeToKey(startTime), timeToKey(endTime));
  const maxKey = Math.max(timeToKey(startTime), timeToKey(endTime));

  return bars.filter((bar) => {
    const key = timeToKey(bar.time);
    return key >= minKey && key <= maxKey;
  });
}

export function buildVolumeProfile(
  bars: readonly ResolvedSeriesBar[],
  requestedBucketCount: number
): VolumeProfileData | null {
  if (bars.length === 0) {
    return null;
  }

  const bucketCount = Math.max(1, Math.floor(requestedBucketCount));
  const minPrice = Math.min(...bars.map((bar) => bar.low));
  const rawMaxPrice = Math.max(...bars.map((bar) => bar.high));
  const maxPrice = rawMaxPrice === minPrice ? minPrice + 1 : rawMaxPrice;
  const bucketSize = (maxPrice - minPrice) / bucketCount;

  const buckets: VolumeProfileBucket[] = Array.from({ length: bucketCount }, (_, index) => ({
    low: minPrice + index * bucketSize,
    high: minPrice + (index + 1) * bucketSize,
    upVolume: 0,
    downVolume: 0,
    totalVolume: 0,
  }));

  for (const bar of bars) {
    const isUp = bar.close >= bar.open;
    const low = Math.max(bar.low, minPrice);
    const high = Math.min(bar.high, maxPrice);

    if (high <= low) {
      const bucketIndex = clampBucketIndex(Math.floor((bar.close - minPrice) / bucketSize), bucketCount);
      applyVolumeContribution(buckets[bucketIndex], bar.volume, isUp);
      continue;
    }

    const span = high - low;
    for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
      const bucket = buckets[bucketIndex];
      const overlapLow = Math.max(low, bucket.low);
      const overlapHigh = Math.min(high, bucket.high);
      const overlap = overlapHigh - overlapLow;

      if (overlap <= 0) {
        continue;
      }

      applyVolumeContribution(bucket, bar.volume * (overlap / span), isUp);
    }
  }

  let pocIndex = 0;
  let maxVolume = 0;
  buckets.forEach((bucket, index) => {
    if (bucket.totalVolume > maxVolume) {
      maxVolume = bucket.totalVolume;
      pocIndex = index;
    }
  });

  const pocBucket = buckets[pocIndex];
  const pocPrice = (pocBucket.low + pocBucket.high) / 2;

  return {
    minPrice,
    maxPrice,
    bucketSize,
    buckets,
    pocIndex,
    pocPrice,
    maxVolume,
  };
}

export function typicalPrice(bar: ResolvedSeriesBar): number {
  return (bar.high + bar.low + bar.close) / 3;
}

export function estimateSpacingFromBars(
  bars: readonly ResolvedSeriesBar[],
  toCoordinate: (time: Time) => number | null,
  fallback: number = 12
): number {
  const spacings: number[] = [];

  for (let index = 1; index < bars.length; index += 1) {
    const previous = toCoordinate(bars[index - 1].time);
    const current = toCoordinate(bars[index].time);

    if (previous !== null && current !== null) {
      const spacing = Math.abs(current - previous);
      if (spacing > 0) {
        spacings.push(spacing);
      }
    }
  }

  if (spacings.length === 0) {
    return fallback;
  }

  const sum = spacings.reduce((accumulator, value) => accumulator + value, 0);
  return sum / spacings.length;
}

function applyVolumeContribution(bucket: VolumeProfileBucket, volume: number, isUp: boolean): void {
  if (isUp) {
    bucket.upVolume += volume;
  } else {
    bucket.downVolume += volume;
  }
  bucket.totalVolume += volume;
}

function clampBucketIndex(index: number, bucketCount: number): number {
  if (index < 0) {
    return 0;
  }

  if (index >= bucketCount) {
    return bucketCount - 1;
  }

  return index;
}
