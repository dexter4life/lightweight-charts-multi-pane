import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';

export type ElliottTriangleWaveOptions = ElliottWaveOptions;

export const ELLIOTT_TRIANGLE_COLOR = '#FF9800';

export class ElliottTriangleWave extends ElliottWaveDrawing {
  readonly type = 'elliott-triangle-wave';
  protected readonly _requiredAnchors = 6;
  protected readonly _labels = ['0','A','B','C','D','E'] as const;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ElliottWaveOptions> = {}) {
    super(id, anchors, style, options, ELLIOTT_TRIANGLE_COLOR);
  }

  override clone(newId: string): IDrawing {
    return new ElliottTriangleWave(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<ElliottTriangleWaveOptions>): ElliottTriangleWave {
    return new ElliottTriangleWave(id, anchors, style, options);
  }
}
