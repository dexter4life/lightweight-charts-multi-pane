import type { Logical } from '../../model/time-data';

interface LogicalScale {
  logicalToCoordinate(logical: Logical): number | null;
}

export interface FractionalMapper {
  toX(logical: number): number | null;
  toLogical(x: number): number | null;
}

const FAR = 5000;

/**
 * The time scale only maps whole bar indices to pixels. Two far-apart samples give the
 * (almost exact) linear mapping, so fractional positions can be placed between bars.
 */
export function createFractionalMapper(scale: LogicalScale): FractionalMapper | null {
  const a = scale.logicalToCoordinate(-FAR as Logical);
  const b = scale.logicalToCoordinate(FAR as Logical);
  if (a === null || b === null || a === b) return null;
  const spacing = (b - a) / (2 * FAR);
  const origin = (a + b) / 2;
  return {
    toX: (logical) => origin + logical * spacing,
    toLogical: (x) => (x - origin) / spacing,
  };
}
