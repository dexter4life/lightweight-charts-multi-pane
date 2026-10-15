import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Geometry, LineGeometry } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { PatternDrawing } from './pattern-base';
import { CyclicLinesPaneView } from './cyclic-lines-pane-view';
import { PATTERN_HIT_THRESHOLD } from './pattern-utils';

export interface CyclicLinesOptions extends DrawingOptions {
  showLabels?: boolean;
}

export class CyclicLines extends PatternDrawing<CyclicLinesOptions> {
  readonly type = 'cyclic-lines';

  protected _patternOptions: CyclicLinesOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<CyclicLinesOptions> = {}
  ) {
    const { showLabels, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._patternOptions = {
      ...this._options,
      showLabels: showLabels ?? false,
    };
  }

  get cyclicLinesOptions(): CyclicLinesOptions {
    return this._patternOptions;
  }

  setCyclicLinesOptions(options: Partial<CyclicLinesOptions>): void {
    this.updatePatternOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= 2;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new CyclicLinesPaneView(this)];
  }

  getLineCoordinates(viewport: Viewport): number[] {
    if (!this.isValid()) return [];

    const p0 = this.anchorToPixel(this._anchors[0], viewport);
    const p1 = this.anchorToPixel(this._anchors[1], viewport);
    if (!p0 || !p1) return [];

    const left = Math.min(p0.x, p1.x);
    const right = Math.max(p0.x, p1.x);
    const spacing = right - left;

    if (spacing < 1) return [left];

    const xs: number[] = [];
    for (let x = left; x <= viewport.width; x += spacing) {
      if (x >= 0) xs.push(x);
    }

    return xs;
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    return this.getLineCoordinates(viewport).map((x) => ({
      type: 'line',
      start: { x, y: 0 },
      end: { x, y: viewport.height },
    } as LineGeometry));
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    return this.getLineCoordinates(viewport).some((x) => Math.abs(point.x - x) <= PATTERN_HIT_THRESHOLD);
  }

  override clone(newId: string): IDrawing {
    return new CyclicLines(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }
}
