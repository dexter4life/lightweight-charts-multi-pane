import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';

export type ElliottDoubleComboOptions = ElliottWaveOptions;

export const ELLIOTT_DOUBLE_COLOR = '#6aa84f';

export class ElliottDoubleCombo extends ElliottWaveDrawing {
  readonly type = 'elliott-double-combo';
  protected readonly _requiredAnchors = 4;
  protected readonly _labels = ['0','W','X','Y'] as const;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ElliottWaveOptions> = {}) {
    super(id, anchors, style, options, ELLIOTT_DOUBLE_COLOR);
  }

  override clone(newId: string): IDrawing {
    return new ElliottDoubleCombo(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<ElliottDoubleComboOptions>): ElliottDoubleCombo {
    return new ElliottDoubleCombo(id, anchors, style, options);
  }
}
