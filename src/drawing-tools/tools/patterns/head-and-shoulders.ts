import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Geometry, LineGeometry, PolygonGeometry, TextGeometry } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { PatternDrawing } from './pattern-base';
import { HeadAndShouldersPaneView } from './head-and-shoulders-pane-view';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline, isPointInPolygon, segmentLabelPosition } from './pattern-utils';

export interface HeadAndShouldersOptions extends DrawingOptions {
  filled?: boolean;
  showLabels?: boolean;
}

export class HeadAndShouldersPattern extends PatternDrawing<HeadAndShouldersOptions> {
  readonly type = 'head-and-shoulders';

  protected _patternOptions: HeadAndShouldersOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<HeadAndShouldersOptions> = {}
  ) {
    const { filled, showLabels, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._patternOptions = {
      ...this._options,
      filled: filled ?? true,
      showLabels: showLabels ?? true,
    };
  }

  get headAndShouldersOptions(): HeadAndShouldersOptions {
    return this._patternOptions;
  }

  setHeadAndShouldersOptions(options: Partial<HeadAndShouldersOptions>): void {
    this.updatePatternOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= 7;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new HeadAndShouldersPaneView(this)];
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

    const [leftShoulder, leftTrough, head, rightTrough, rightShoulder, necklineStart, necklineEnd] = points;
    const geometries: Geometry[] = [];

    if (this._patternOptions.filled) {
      geometries.push({
        type: 'polygon',
        points: [leftShoulder, leftTrough, head, rightTrough, rightShoulder],
        closed: true,
      } as PolygonGeometry);
    }

    geometries.push({
      type: 'polygon',
      points: [leftShoulder, leftTrough, head, rightTrough, rightShoulder],
      closed: false,
    } as PolygonGeometry);

    geometries.push({
      type: 'line',
      start: necklineStart,
      end: necklineEnd,
    } as LineGeometry);

    if (this._patternOptions.showLabels) {
      geometries.push(
        {
          type: 'text',
          position: segmentLabelPosition(leftShoulder, leftShoulder, 18),
          text: 'Left Shoulder',
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'center',
          baseline: 'bottom',
        } as TextGeometry,
        {
          type: 'text',
          position: segmentLabelPosition(head, head, 18),
          text: 'Head',
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'center',
          baseline: 'bottom',
        } as TextGeometry,
        {
          type: 'text',
          position: segmentLabelPosition(rightShoulder, rightShoulder, 18),
          text: 'Right Shoulder',
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'center',
          baseline: 'bottom',
        } as TextGeometry
      );
    }

    return geometries;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getPatternPoints(viewport);
    if (points.length < 7) return false;

    const shoulderPath = points.slice(0, 5);
    const neckline = points.slice(5, 7);

    if (distanceToPolyline(point, shoulderPath) <= PATTERN_HIT_THRESHOLD) return true;
    if (distanceToPolyline(point, neckline) <= PATTERN_HIT_THRESHOLD) return true;

    return this._patternOptions.filled ? isPointInPolygon(point, shoulderPath) : false;
  }

  override clone(newId: string): IDrawing {
    return new HeadAndShouldersPattern(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }
}
