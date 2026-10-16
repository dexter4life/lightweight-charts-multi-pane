import type { Anchor, DrawingStyle } from '../../core/types';
import { RangeDrawing, type RangeKind, type RangeOptions } from './range-drawing';

export type DateRangeOptions = RangeOptions;

export class DateRange extends RangeDrawing {
  readonly type = 'date-range';
  protected readonly kind: RangeKind = 'date';

  protected create(id: string, anchors: Anchor[], style: Partial<DrawingStyle>, options: Partial<RangeOptions>): DateRange {
    return new DateRange(id, anchors, style, options);
  }
}
