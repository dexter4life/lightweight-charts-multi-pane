import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { ElliottWaveDrawing, type ElliottWaveOptions } from './elliott-wave-base';
import { ElliottDoubleComboPaneView } from './elliott-double-combo-pane-view';

export type ElliottDoubleComboOptions = ElliottWaveOptions;

export class ElliottDoubleCombo extends ElliottWaveDrawing {
  readonly type = 'elliott-double-combo';
  protected readonly _requiredAnchors = 4;
  protected readonly _labels = ['0', '(W)', '(X)', '(Y)'] as const;

  override paneViews(): IPrimitivePaneView[] {
    return [new ElliottDoubleComboPaneView(this)];
  }

  override clone(newId: string): IDrawing {
    return new ElliottDoubleCombo(newId, [...this.anchors], { ...this.style }, { ...this.waveOptions });
  }

  static create(
    id: string,
    anchors: Anchor[],
    style?: Partial<DrawingStyle>,
    options?: Partial<ElliottDoubleComboOptions>
  ): ElliottDoubleCombo {
    return new ElliottDoubleCombo(id, anchors, style, options);
  }
}
