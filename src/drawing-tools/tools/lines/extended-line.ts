import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { TrendLine, type TrendLineOptions } from './trend-line';

/** Extended Line: a trend line that extends past both points. */
export class ExtendedLine extends TrendLine {
  override readonly type: string = 'extended-line';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TrendLineOptions> = {}
  ) {
    super(id, anchors, style, { extendLeft: true, extendRight: true, ...options });
  }

  override clone(newId: string): IDrawing {
    return new ExtendedLine(newId, [...this._anchors], { ...this._style }, { ...this.trendLineOptions });
  }

  static override create(
    id: string,
    startAnchor: Anchor,
    endAnchor: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<TrendLineOptions>
  ): ExtendedLine {
    return new ExtendedLine(id, [startAnchor, endAnchor], style, options);
  }
}
