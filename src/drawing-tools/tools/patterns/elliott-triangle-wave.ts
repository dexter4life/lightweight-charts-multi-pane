import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';
import { ElliottTriangleWavePaneView } from './elliott-triangle-wave-pane-view';

export type ElliottTriangleWaveOptions = ElliottWaveOptions;

export class ElliottTriangleWave extends ElliottWaveDrawing {
  readonly type = 'elliott-triangle-wave';
  protected readonly _requiredAnchors = 6;
  protected readonly _labels = ['0', '(A)', '(B)', '(C)', '(D)', '(E)'] as const;

  override paneViews(): IPrimitivePaneView[] {
    return [new ElliottTriangleWavePaneView(this)];
  }

  override clone(newId: string): IDrawing {
    return new ElliottTriangleWave(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(
    id: string,
    anchors: Anchor[],
    style?: Partial<DrawingStyle>,
    options?: Partial<ElliottTriangleWaveOptions>
  ): ElliottTriangleWave {
    return new ElliottTriangleWave(id, anchors, style, options);
  }
}
