import { ElliottWavePaneViewBase } from './elliott-wave-pane-view-base';
import type { ElliottImpulseWave } from './elliott-impulse-wave';

export class ElliottImpulseWavePaneView extends ElliottWavePaneViewBase {
  constructor(drawing: ElliottImpulseWave) {
    super(drawing);
  }
}
