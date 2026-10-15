import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { TrendLine, type TrendLineOptions } from './trend-line';

/** Trend Angle: a trend line that also shows its angle against a horizontal reference. */
export class TrendAngle extends TrendLine {
  override readonly type: string = 'trend-angle';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TrendLineOptions> = {}
  ) {
    super(id, anchors, style, options);
  }

  override get showsAngleArc(): boolean {
    return true;
  }

  override clone(newId: string): IDrawing {
    return new TrendAngle(newId, [...this._anchors], { ...this._style }, { ...this.trendLineOptions });
  }

  static override create(
    id: string,
    startAnchor: Anchor,
    endAnchor: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<TrendLineOptions>
  ): TrendAngle {
    return new TrendAngle(id, [startAnchor, endAnchor], style, options);
  }
}
