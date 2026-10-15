import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { TrendLine, type TrendLineOptions } from './trend-line';

/** Ray: a trend line that extends past its second point. */
export class Ray extends TrendLine {
  override readonly type: string = 'ray';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TrendLineOptions> = {}
  ) {
    super(id, anchors, style, { extendRight: true, ...options });
  }

  override clone(newId: string): IDrawing {
    return new Ray(newId, [...this._anchors], { ...this._style }, { ...this.trendLineOptions });
  }

  static override create(
    id: string,
    startAnchor: Anchor,
    endAnchor: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<TrendLineOptions>
  ): Ray {
    return new Ray(id, [startAnchor, endAnchor], style, options);
  }
}
