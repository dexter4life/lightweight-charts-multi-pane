import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';

export type ElliottImpulseWaveOptions = ElliottWaveOptions;

export const ELLIOTT_IMPULSE_COLOR = '#3d85c6';

export class ElliottImpulseWave extends ElliottWaveDrawing {
  readonly type = 'elliott-impulse-wave';
  protected readonly _requiredAnchors = 6;
  protected readonly _labels = ['0','1','2','3','4','5'] as const;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ElliottWaveOptions> = {}) {
    super(id, anchors, style, options, ELLIOTT_IMPULSE_COLOR);
  }

  override clone(newId: string): IDrawing {
    return new ElliottImpulseWave(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<ElliottImpulseWaveOptions>): ElliottImpulseWave {
    return new ElliottImpulseWave(id, anchors, style, options);
  }
}
