import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { ArcGeometry, Geometry } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { PatternDrawing } from './pattern-base';
import { TimeCyclesPaneView } from './time-cycles-pane-view';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline, sampleSemicirclePoints } from './pattern-utils';

export interface TimeCyclesOptions extends DrawingOptions {
  showLabels?: boolean;
}

export class TimeCycles extends PatternDrawing<TimeCyclesOptions> {
  readonly type = 'time-cycles';

  protected _patternOptions: TimeCyclesOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TimeCyclesOptions> = {}
  ) {
    const { showLabels, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._patternOptions = {
      ...this._options,
      showLabels: showLabels ?? false,
    };
  }

  get timeCyclesOptions(): TimeCyclesOptions {
    return this._patternOptions;
  }

  setTimeCyclesOptions(options: Partial<TimeCyclesOptions>): void {
    this.updatePatternOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= 2;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new TimeCyclesPaneView(this)];
  }

  getArcData(viewport: Viewport): Array<{ startX: number; diameter: number; baselineY: number }> {
    if (!this.isValid()) return [];

    const p0 = this.anchorToPixel(this._anchors[0], viewport);
    const p1 = this.anchorToPixel(this._anchors[1], viewport);
    if (!p0 || !p1) return [];

    const startX = Math.min(p0.x, p1.x);
    const endX = Math.max(p0.x, p1.x);
    const diameter = endX - startX;

    if (diameter < 2) return [];

    const baselineY = (p0.y + p1.y) / 2;
    const arcs: Array<{ startX: number; diameter: number; baselineY: number }> = [];

    for (let x = startX; x <= viewport.width; x += diameter) {
      if (x + diameter >= 0) {
        arcs.push({ startX: x, diameter, baselineY });
      }
    }

    return arcs;
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    return this.getArcData(viewport).map((arc) => ({
      type: 'arc',
      center: { x: arc.startX + arc.diameter / 2, y: arc.baselineY },
      radius: arc.diameter / 2,
      startAngle: Math.PI,
      endAngle: 0,
      counterClockwise: false,
    } as ArcGeometry));
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    return this.getArcData(viewport).some((arc) => {
      const sampled = sampleSemicirclePoints(arc.startX, arc.diameter, arc.baselineY);
      return distanceToPolyline(point, sampled) <= PATTERN_HIT_THRESHOLD;
    });
  }

  override clone(newId: string): IDrawing {
    return new TimeCycles(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }
}
