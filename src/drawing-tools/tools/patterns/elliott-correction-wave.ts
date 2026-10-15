import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';
import { ElliottCorrectionWavePaneView } from './elliott-correction-wave-pane-view';

export type ElliottCorrectionWaveOptions = ElliottWaveOptions;

export class ElliottCorrectionWave extends ElliottWaveDrawing {
  readonly type = 'elliott-correction-wave';
  protected readonly _requiredAnchors = 4;
  protected readonly _labels = ['0', '(A)', '(B)', '(C)'] as const;

  override paneViews(): IPrimitivePaneView[] {
    return [new ElliottCorrectionWavePaneView(this)];
  }

  override clone(newId: string): IDrawing {
    return new ElliottCorrectionWave(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(
    id: string,
    anchors: Anchor[],
    style?: Partial<DrawingStyle>,
    options?: Partial<ElliottCorrectionWaveOptions>
  ): ElliottCorrectionWave {
    return new ElliottCorrectionWave(id, anchors, style, options);
  }
}
