import { DrawingPaneView } from '../../rendering/drawing-pane-view';

import type { ThreeDrivesPattern } from './three-drives-pattern';

export class ThreeDrivesPatternPaneView extends DrawingPaneView {
  constructor(drawing: ThreeDrivesPattern) {
    super(drawing);
  }
}
