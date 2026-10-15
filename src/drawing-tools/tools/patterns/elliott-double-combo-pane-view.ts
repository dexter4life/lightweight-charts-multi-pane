import { ElliottWavePaneViewBase } from './elliott-wave-pane-view-base';
import type { ElliottDoubleCombo } from './elliott-double-combo';

export class ElliottDoubleComboPaneView extends ElliottWavePaneViewBase {
  constructor(drawing: ElliottDoubleCombo) {
    super(drawing);
  }
}
