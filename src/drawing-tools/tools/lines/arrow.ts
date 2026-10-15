import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { TrendLine, type TrendLineOptions } from './trend-line';

/** Arrow: a trend line that starts with an arrowhead on its end point. */
export class Arrow extends TrendLine {
  override readonly type: string = 'arrow';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TrendLineOptions> = {}
  ) {
    super(id, anchors, style, { rightEnd: 'arrow', ...options });
  }

  override clone(newId: string): IDrawing {
    return new Arrow(newId, [...this._anchors], { ...this._style }, { ...this.trendLineOptions });
  }

  static override create(
    id: string,
    startAnchor: Anchor,
    endAnchor: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<TrendLineOptions>
  ): Arrow {
    return new Arrow(id, [startAnchor, endAnchor], style, options);
  }
}
