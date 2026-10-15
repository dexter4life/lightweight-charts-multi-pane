import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';
import { ElliottImpulseWavePaneView } from './elliott-impulse-wave-pane-view';

export type ElliottImpulseWaveOptions = ElliottWaveOptions;

export class ElliottImpulseWave extends ElliottWaveDrawing {
  readonly type = 'elliott-impulse-wave';
  protected readonly _requiredAnchors = 6;
  protected readonly _labels = ['0', '(1)', '(2)', '(3)', '(4)', '(5)'] as const;

  override paneViews(): IPrimitivePaneView[] {
    return [new ElliottImpulseWavePaneView(this)];
  }

  override clone(newId: string): IDrawing {
    return new ElliottImpulseWave(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(
    id: string,
    anchors: Anchor[],
    style?: Partial<DrawingStyle>,
    options?: Partial<ElliottImpulseWaveOptions>
  ): ElliottImpulseWave {
    return new ElliottImpulseWave(id, anchors, style, options);
  }
}
