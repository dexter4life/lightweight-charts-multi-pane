import { DrawingPaneView } from '../../rendering/drawing-pane-view';

import type { CyclicLines } from './cyclic-lines';

export class CyclicLinesPaneView extends DrawingPaneView {
  constructor(drawing: CyclicLines) {
    super(drawing);
  }
}
