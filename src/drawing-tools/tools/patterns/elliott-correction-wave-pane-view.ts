import { ElliottWavePaneViewBase } from './elliott-wave-pane-view-base';
import type { ElliottCorrectionWave } from './elliott-correction-wave';

export class ElliottCorrectionWavePaneView extends ElliottWavePaneViewBase {
  constructor(drawing: ElliottCorrectionWave) {
    super(drawing);
  }
}
