import type { Geometry, PolygonGeometry, TextGeometry } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { PatternDrawing } from './pattern-base';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline, isPointInPolygon } from './pattern-utils';

export interface ElliottWaveOptions extends DrawingOptions {
  filled?: boolean;
  showLabels?: boolean;
}

export abstract class ElliottWaveDrawing extends PatternDrawing<ElliottWaveOptions> {
  protected abstract readonly _requiredAnchors: number;
  protected abstract readonly _labels: readonly string[];
  protected _patternOptions: ElliottWaveOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<ElliottWaveOptions> = {}
  ) {
    const { filled, showLabels, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._patternOptions = {
      ...this._options,
      filled: filled ?? false,
      showLabels: showLabels ?? true,
    };
  }

  get waveOptions(): ElliottWaveOptions {
    return this._patternOptions;
  }

  setWaveOptions(options: Partial<ElliottWaveOptions>): void {
    this.updatePatternOptions(options);
  }

  get labels(): readonly string[] {
    return this._labels;
  }

  override isValid(): boolean {
    return this._anchors.length >= this._requiredAnchors;
  }

  getWavePoints(viewport: Viewport): Point[] {
    if (!this.isValid()) return [];

    return this._anchors
      .map((anchor) => this.anchorToPixel(anchor, viewport))
      .filter((point): point is Point => point !== null);
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const points = this.getWavePoints(viewport);
    if (points.length < this._requiredAnchors) return [];

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
      for (let i = 0; i < points.length; i++) {
        geometries.push({
          type: 'text',
          position: { x: points[i].x + 8, y: points[i].y - 12 },
          text: this._labels[i] ?? `${i}`,
          font: this._style.labelFont,
          color: this._style.labelColor,
          align: 'left',
          baseline: 'bottom',
        } as TextGeometry);
      }
    }

    return geometries;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getWavePoints(viewport);
    if (points.length < this._requiredAnchors) return false;

    if (distanceToPolyline(point, points) <= PATTERN_HIT_THRESHOLD) return true;
    return this._patternOptions.filled ? isPointInPolygon(point, points) : false;
  }

  abstract override clone(newId: string): IDrawing;
}
