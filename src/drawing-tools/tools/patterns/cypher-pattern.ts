import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { distanceBetweenPoints } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { PatternDrawing } from './pattern-base';
import { CypherPatternPaneView } from './cypher-pattern-pane-view';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline, formatRatio, isPointInPolygon, safeRatio, segmentLabelPosition } from './pattern-utils';

export interface CypherPatternOptions extends DrawingOptions {
  filled?: boolean;
  showLabels?: boolean;
}

export class CypherPattern extends PatternDrawing<CypherPatternOptions> {
  readonly type = 'cypher-pattern';
  readonly anchorLabels = ['X', 'A', 'B', 'C', 'D'] as const;

  protected _patternOptions: CypherPatternOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<CypherPatternOptions> = {}
  ) {
    const { filled, showLabels, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._patternOptions = {
      ...this._options,
      filled: filled ?? true,
      showLabels: showLabels ?? true,
    };
  }

  get cypherPatternOptions(): CypherPatternOptions {
    return this._patternOptions;
  }

  setCypherPatternOptions(options: Partial<CypherPatternOptions>): void {
    this.updatePatternOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= 5;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new CypherPatternPaneView(this)];
  }

  getPatternPoints(viewport: Viewport): Point[] {
    if (!this.isValid()) return [];

    return this._anchors
      .map((anchor) => this.anchorToPixel(anchor, viewport))
      .filter((point): point is Point => point !== null);
  }

  getGuideLines(viewport: Viewport): Array<[Point, Point]> {
    const points = this.getPatternPoints(viewport);
    if (points.length < 5) return [];

    return [
      [points[0], points[2]],
      [points[1], points[3]],
      [points[0], points[4]],
      [points[2], points[4]],
    ];
  }

  getFilledPolygons(viewport: Viewport): Point[][] {
    const points = this.getPatternPoints(viewport);
    if (points.length < 5) return [];
    return [
      [points[0], points[1], points[2]],
      [points[2], points[3], points[4]],
    ];
  }

  getRatioLabels(viewport: Viewport): Array<{ text: string; position: Point }> {
    const points = this.getPatternPoints(viewport);
    if (points.length < 5) return [];

    const xa = distanceBetweenPoints(points[0], points[1]);
    const ab = distanceBetweenPoints(points[1], points[2]);
    const bc = distanceBetweenPoints(points[2], points[3]);
    const cd = distanceBetweenPoints(points[3], points[4]);
    const xc = distanceBetweenPoints(points[0], points[3]);

    return [
      { text: formatRatio(safeRatio(ab, xa)), position: segmentLabelPosition(points[1], points[2]) },
      { text: formatRatio(safeRatio(bc, xa)), position: segmentLabelPosition(points[2], points[3]) },
      { text: formatRatio(safeRatio(cd, xc)), position: segmentLabelPosition(points[3], points[4]) },
      { text: formatRatio(safeRatio(distanceBetweenPoints(points[0], points[4]), xc)), position: segmentLabelPosition(points[0], points[4], 18) },
    ];
  }

  override computeGeometry(): never[] {
    return [];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getPatternPoints(viewport);
    if (points.length < 5) return false;

    if (distanceToPolyline(point, points) <= PATTERN_HIT_THRESHOLD) return true;

    for (const [start, end] of this.getGuideLines(viewport)) {
      if (distanceToPolyline(point, [start, end]) <= PATTERN_HIT_THRESHOLD) return true;
    }

    return this._patternOptions.filled
      ? this.getFilledPolygons(viewport).some((polygon) => isPointInPolygon(point, polygon))
      : false;
  }

  override clone(newId: string): IDrawing {
    return new CypherPattern(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }
}
