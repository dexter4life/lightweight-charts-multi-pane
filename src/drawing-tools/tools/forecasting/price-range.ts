import type { Anchor, DrawingStyle } from '../../core/types';
import { RangeDrawing, type RangeKind, type RangeOptions } from './range-drawing';

export type PriceRangeOptions = RangeOptions;

export class PriceRange extends RangeDrawing {
  readonly type = 'price-range';
  protected readonly kind: RangeKind = 'price';

  protected create(id: string, anchors: Anchor[], style: Partial<DrawingStyle>, options: Partial<RangeOptions>): PriceRange {
    return new PriceRange(id, anchors, style, options);
  }
}
