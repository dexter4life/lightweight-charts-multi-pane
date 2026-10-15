import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Geometry, LineGeometry, PolygonGeometry } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { PatternDrawing } from './pattern-base';
import { TrianglePatternPaneView } from './triangle-pattern-pane-view';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline, isPointInPolygon } from './pattern-utils';

export interface TrianglePatternOptions extends DrawingOptions {
  filled?: boolean;
}

export class TrianglePattern extends PatternDrawing<TrianglePatternOptions> {
  readonly type = 'triangle-pattern';

  protected _patternOptions: TrianglePatternOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TrianglePatternOptions> = {}
  ) {
    const { filled, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._patternOptions = {
      ...this._options,
      filled: filled ?? true,
    };
  }

  get trianglePatternOptions(): TrianglePatternOptions {
    return this._patternOptions;
  }

  setTrianglePatternOptions(options: Partial<TrianglePatternOptions>): void {
    this.updatePatternOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= 4;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new TrianglePatternPaneView(this)];
  }

  getPatternPoints(viewport: Viewport): Point[] {
    if (!this.isValid()) return [];

    return this._anchors
      .map((anchor) => this.anchorToPixel(anchor, viewport))
      .filter((point): point is Point => point !== null);
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const points = this.getPatternPoints(viewport);
    if (points.length < 4) return [];

    const [a, b, c, d] = points;
    const geometries: Geometry[] = [
      {
        type: 'line',
        start: a,
        end: c,
      } as LineGeometry,
      {
        type: 'line',
        start: b,
        end: d,
      } as LineGeometry,
    ];

    if (this._patternOptions.filled) {
      geometries.unshift({
        type: 'polygon',
        points: [a, b, d, c],
        closed: true,
      } as PolygonGeometry);
    }

    return geometries;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getPatternPoints(viewport);
    if (points.length < 4) return false;

    const [a, b, c, d] = points;
    if (distanceToPolyline(point, [a, c]) <= PATTERN_HIT_THRESHOLD) return true;
    if (distanceToPolyline(point, [b, d]) <= PATTERN_HIT_THRESHOLD) return true;

    return this._patternOptions.filled ? isPointInPolygon(point, [a, b, d, c]) : false;
  }

  override clone(newId: string): IDrawing {
    return new TrianglePattern(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }
}
