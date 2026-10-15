import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';
import { ElliottTripleComboPaneView } from './elliott-triple-combo-pane-view';

export type ElliottTripleComboOptions = ElliottWaveOptions;

export class ElliottTripleCombo extends ElliottWaveDrawing {
  readonly type = 'elliott-triple-combo';
  protected readonly _requiredAnchors = 6;
  protected readonly _labels = ['0', '(W)', '(X)', '(Y)', '(X)', '(Z)'] as const;

  override paneViews(): IPrimitivePaneView[] {
    return [new ElliottTripleComboPaneView(this)];
  }

  override clone(newId: string): IDrawing {
    return new ElliottTripleCombo(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(
    id: string,
    anchors: Anchor[],
    style?: Partial<DrawingStyle>,
    options?: Partial<ElliottTripleComboOptions>
  ): ElliottTripleCombo {
    return new ElliottTripleCombo(id, anchors, style, options);
  }
}
