import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { distanceBetweenPoints } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { PatternDrawing } from './pattern-base';
import { ABCDPatternPaneView } from './abcd-pattern-pane-view';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline, formatRatio, safeRatio, segmentLabelPosition } from './pattern-utils';

export interface ABCDPatternOptions extends DrawingOptions {
  showLabels?: boolean;
}

export class ABCDPattern extends PatternDrawing<ABCDPatternOptions> {
  readonly type = 'abcd-pattern';
  readonly anchorLabels = ['A', 'B', 'C', 'D'] as const;

  protected _patternOptions: ABCDPatternOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<ABCDPatternOptions> = {}
  ) {
    const { showLabels, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._patternOptions = {
      ...this._options,
      showLabels: showLabels ?? true,
    };
  }

  get abcdPatternOptions(): ABCDPatternOptions {
    return this._patternOptions;
  }

  setABCDPatternOptions(options: Partial<ABCDPatternOptions>): void {
    this.updatePatternOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= 4;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new ABCDPatternPaneView(this)];
  }

  getPatternPoints(viewport: Viewport): Point[] {
    if (!this.isValid()) return [];

    return this._anchors
      .map((anchor) => this.anchorToPixel(anchor, viewport))
      .filter((point): point is Point => point !== null);
  }

  getGuideLines(viewport: Viewport): Array<[Point, Point]> {
    const points = this.getPatternPoints(viewport);
    if (points.length < 4) return [];

    return [
      [points[0], points[2]],
      [points[1], points[3]],
    ];
  }

  getRatioLabels(viewport: Viewport): Array<{ text: string; position: Point }> {
    const points = this.getPatternPoints(viewport);
    if (points.length < 4) return [];

    const ab = distanceBetweenPoints(points[0], points[1]);
    const bc = distanceBetweenPoints(points[1], points[2]);
    const cd = distanceBetweenPoints(points[2], points[3]);
    const ad = distanceBetweenPoints(points[0], points[3]);

    return [
      { text: formatRatio(safeRatio(bc, ab)), position: segmentLabelPosition(points[1], points[2]) },
      { text: formatRatio(safeRatio(cd, bc)), position: segmentLabelPosition(points[2], points[3]) },
      { text: formatRatio(safeRatio(ad, ab)), position: segmentLabelPosition(points[0], points[3], 18) },
    ];
  }

  override computeGeometry(): never[] {
    return [];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getPatternPoints(viewport);
    if (points.length < 4) return false;

    if (distanceToPolyline(point, points) <= PATTERN_HIT_THRESHOLD) return true;

    return this.getGuideLines(viewport).some(([start, end]) => distanceToPolyline(point, [start, end]) <= PATTERN_HIT_THRESHOLD);
  }

  override clone(newId: string): IDrawing {
    return new ABCDPattern(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }
}
