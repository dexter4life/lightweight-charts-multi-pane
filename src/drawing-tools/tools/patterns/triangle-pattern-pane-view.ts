import { DrawingPaneView } from '../../rendering/drawing-pane-view';

import type { TrianglePattern } from './triangle-pattern';

export class TrianglePatternPaneView extends DrawingPaneView {
  constructor(drawing: TrianglePattern) {
    super(drawing);
  }
}
