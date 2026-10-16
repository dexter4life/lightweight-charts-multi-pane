import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';

export type ElliottTripleComboOptions = ElliottWaveOptions;

export const ELLIOTT_TRIPLE_COLOR = '#6aa84f';

export class ElliottTripleCombo extends ElliottWaveDrawing {
  readonly type = 'elliott-triple-combo';
  protected readonly _requiredAnchors = 6;
  protected readonly _labels = ['0','W','X','Y','X','Z'] as const;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ElliottWaveOptions> = {}) {
    super(id, anchors, style, options, ELLIOTT_TRIPLE_COLOR);
  }

  override clone(newId: string): IDrawing {
    return new ElliottTripleCombo(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<ElliottTripleComboOptions>): ElliottTripleCombo {
    return new ElliottTripleCombo(id, anchors, style, options);
  }
}
