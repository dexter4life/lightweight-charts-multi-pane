import { DrawingPaneView } from '../../rendering/drawing-pane-view';

import type { HeadAndShouldersPattern } from './head-and-shoulders';

export class HeadAndShouldersPaneView extends DrawingPaneView {
  constructor(drawing: HeadAndShouldersPattern) {
    super(drawing);
  }
}
