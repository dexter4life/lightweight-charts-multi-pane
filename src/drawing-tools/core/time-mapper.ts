import type { Time } from '../../model/horz-scale-behavior-time/types';
import { createFractionalMapper } from './fractional-logical';

interface Scale {
  logicalToCoordinate(logical: never): number | null;
}

/**
 * Fractional bar index of a timestamp: interpolated between bars and extrapolated past either end.
 * Lets a drawing keep its time position after the series is reloaded at another resolution.
 */
export function timeToFractionalLogical(times: readonly number[], time: number): number | null {
  const n = times.length;
  if (n < 2) return null;
  if (time <= times[0]) return (time - times[0]) / (times[1] - times[0]);
  if (time >= times[n - 1]) return n - 1 + (time - times[n - 1]) / (times[n - 1] - times[n - 2]);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) lo = mid;
    else hi = mid;
  }
  return lo + (time - times[lo]) / (times[lo + 1] - times[lo]);
}

/** Time → pixel for timestamps that have no bar of their own. */
export function createTimeMapper(
  scale: Scale,
  getTimes: () => readonly number[],
): (time: Time) => number | null {
  let cached: { times: readonly number[]; mapper: ReturnType<typeof createFractionalMapper> } | null = null;
  return (time) => {
    if (typeof time !== 'number') return null;
    if (!cached) {
      cached = { times: getTimes(), mapper: createFractionalMapper(scale as never) };
    }
    const logical = timeToFractionalLogical(cached.times, time);
    return logical === null ? null : (cached.mapper?.toX(logical) ?? null);
  };
}
