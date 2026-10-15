import { ElliottWavePaneViewBase } from './elliott-wave-pane-view-base';
import type { ElliottTriangleWave } from './elliott-triangle-wave';

export class ElliottTriangleWavePaneView extends ElliottWavePaneViewBase {
  constructor(drawing: ElliottTriangleWave) {
    super(drawing);
  }
}
