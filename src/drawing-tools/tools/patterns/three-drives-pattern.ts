import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { distanceBetweenPoints } from '../../core/geometry';
import type { Geometry, PolygonGeometry, TextGeometry } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { PatternDrawing } from './pattern-base';
import { ThreeDrivesPatternPaneView } from './three-drives-pattern-pane-view';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline, formatRatio, isPointInPolygon, safeRatio, segmentLabelPosition } from './pattern-utils';

export interface ThreeDrivesPatternOptions extends DrawingOptions {
  filled?: boolean;
  showLabels?: boolean;
}

export class ThreeDrivesPattern extends PatternDrawing<ThreeDrivesPatternOptions> {
  readonly type = 'three-drives-pattern';

  protected _patternOptions: ThreeDrivesPatternOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<ThreeDrivesPatternOptions> = {}
  ) {
    const { filled, showLabels, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._patternOptions = {
      ...this._options,
      filled: filled ?? false,
      showLabels: showLabels ?? true,
    };
  }

  get threeDrivesPatternOptions(): ThreeDrivesPatternOptions {
    return this._patternOptions;
  }

  setThreeDrivesPatternOptions(options: Partial<ThreeDrivesPatternOptions>): void {
    this.updatePatternOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= 7;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new ThreeDrivesPatternPaneView(this)];
  }

  getPatternPoints(viewport: Viewport): Point[] {
    if (!this.isValid()) return [];

    return this._anchors
      .map((anchor) => this.anchorToPixel(anchor, viewport))
      .filter((point): point is Point => point !== null);
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const points = this.getPatternPoints(viewport);
    if (points.length < 7) return [];

    const geometries: Geometry[] = [];

    if (this._patternOptions.filled) {
      geometries.push({
        type: 'polygon',
        points,
        closed: true,
      } as PolygonGeometry);
    }

    geometries.push({
      type: 'polygon',
      points,
      closed: false,
    } as PolygonGeometry);

    if (this._patternOptions.showLabels) {
      const retracements = [
        formatRatio(safeRatio(distanceBetweenPoints(points[1], points[2]), distanceBetweenPoints(points[0], points[1]))),
        formatRatio(safeRatio(distanceBetweenPoints(points[3], points[4]), distanceBetweenPoints(points[2], points[3]))),
        formatRatio(safeRatio(distanceBetweenPoints(points[5], points[6]), distanceBetweenPoints(points[4], points[5]))),
      ];

      geometries.push(
        {
          type: 'text',
          position: segmentLabelPosition(points[0], points[1]),
          text: '1',
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'center',
          baseline: 'middle',
        } as TextGeometry,
        {
          type: 'text',
          position: segmentLabelPosition(points[2], points[3]),
          text: '2',
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'center',
          baseline: 'middle',
        } as TextGeometry,
        {
          type: 'text',
          position: segmentLabelPosition(points[4], points[5]),
          text: '3',
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'center',
          baseline: 'middle',
        } as TextGeometry,
        {
          type: 'text',
          position: segmentLabelPosition(points[1], points[2]),
          text: retracements[0],
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'center',
          baseline: 'middle',
        } as TextGeometry,
        {
          type: 'text',
          position: segmentLabelPosition(points[3], points[4]),
          text: retracements[1],
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'center',
          baseline: 'middle',
        } as TextGeometry,
        {
          type: 'text',
          position: segmentLabelPosition(points[5], points[6]),
          text: retracements[2],
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'center',
          baseline: 'middle',
        } as TextGeometry
      );
    }

    return geometries;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getPatternPoints(viewport);
    if (points.length < 7) return false;

    if (distanceToPolyline(point, points) <= PATTERN_HIT_THRESHOLD) return true;
    return this._patternOptions.filled ? isPointInPolygon(point, points) : false;
  }

  override clone(newId: string): IDrawing {
    return new ThreeDrivesPattern(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }
}
