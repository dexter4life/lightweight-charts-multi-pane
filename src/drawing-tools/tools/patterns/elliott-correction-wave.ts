import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';

export type ElliottCorrectionWaveOptions = ElliottWaveOptions;

export const ELLIOTT_CORRECTION_COLOR = '#3d85c6';

export class ElliottCorrectionWave extends ElliottWaveDrawing {
  readonly type = 'elliott-correction-wave';
  protected readonly _requiredAnchors = 4;
  protected readonly _labels = ['0','A','B','C'] as const;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ElliottWaveOptions> = {}) {
    super(id, anchors, style, options, ELLIOTT_CORRECTION_COLOR);
  }

  override clone(newId: string): IDrawing {
    return new ElliottCorrectionWave(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<ElliottCorrectionWaveOptions>): ElliottCorrectionWave {
    return new ElliottCorrectionWave(id, anchors, style, options);
  }
}
