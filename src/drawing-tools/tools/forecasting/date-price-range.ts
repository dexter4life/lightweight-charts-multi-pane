import type { Anchor, DrawingStyle } from '../../core/types';
import { RangeDrawing, type RangeKind, type RangeOptions } from './range-drawing';

export type DatePriceRangeOptions = RangeOptions;

export class DatePriceRange extends RangeDrawing {
  readonly type = 'date-price-range';
  protected readonly kind: RangeKind = 'date-price';

  protected create(id: string, anchors: Anchor[], style: Partial<DrawingStyle>, options: Partial<RangeOptions>): DatePriceRange {
    return new DatePriceRange(id, anchors, style, options);
  }
}
