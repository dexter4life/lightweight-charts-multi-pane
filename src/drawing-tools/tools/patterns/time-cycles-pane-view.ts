import { DrawingPaneView } from '../../rendering/drawing-pane-view';

import type { TimeCycles } from './time-cycles';

export class TimeCyclesPaneView extends DrawingPaneView {
  constructor(drawing: TimeCycles) {
    super(drawing);
  }
}
