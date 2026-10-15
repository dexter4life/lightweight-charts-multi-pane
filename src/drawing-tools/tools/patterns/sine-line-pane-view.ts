import { DrawingPaneView } from '../../rendering/drawing-pane-view';

import type { SineLine } from './sine-line';

export class SineLinePaneView extends DrawingPaneView {
  constructor(drawing: SineLine) {
    super(drawing);
  }
}
