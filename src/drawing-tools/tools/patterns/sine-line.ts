import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Geometry, PolygonGeometry } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { PatternDrawing } from './pattern-base';
import { SineLinePaneView } from './sine-line-pane-view';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline, sampleSinePoints } from './pattern-utils';

export interface SineLineOptions extends DrawingOptions {
  showLabels?: boolean;
}

export class SineLine extends PatternDrawing<SineLineOptions> {
  readonly type = 'sine-line';

  protected _patternOptions: SineLineOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<SineLineOptions> = {}
  ) {
    const { showLabels, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._patternOptions = {
      ...this._options,
      showLabels: showLabels ?? false,
    };
  }

  get sineLineOptions(): SineLineOptions {
    return this._patternOptions;
  }

  setSineLineOptions(options: Partial<SineLineOptions>): void {
    this.updatePatternOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= 2;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new SineLinePaneView(this)];
  }

  getWavePoints(viewport: Viewport): Point[] {
    if (!this.isValid()) return [];

    const p0 = this.anchorToPixel(this._anchors[0], viewport);
    const p1 = this.anchorToPixel(this._anchors[1], viewport);
    if (!p0 || !p1) return [];

    const [start, control] = p0.x <= p1.x ? [p0, p1] : [p1, p0];
    return sampleSinePoints(start, control, viewport.width);
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const points = this.getWavePoints(viewport);
    if (points.length < 2) return [];

    return [{
      type: 'polygon',
      points,
      closed: false,
    } as PolygonGeometry];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getWavePoints(viewport);
    return distanceToPolyline(point, points) <= PATTERN_HIT_THRESHOLD;
  }

  override clone(newId: string): IDrawing {
    return new SineLine(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }
}
