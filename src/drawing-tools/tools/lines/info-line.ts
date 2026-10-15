import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { TrendLine, type TrendLineOptions } from './trend-line';

/** Info Line: a trend line that shows its price, bar, distance and angle statistics by default. */
export class InfoLine extends TrendLine {
  override readonly type: string = 'info-line';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TrendLineOptions> = {}
  ) {
    super(id, anchors, style, { ...InfoLine.DEFAULTS, ...options });
  }

  static readonly DEFAULTS: Partial<TrendLineOptions> = {
    statsPrice: true,
    statsBars: true,
    statsDate: true,
    statsDistance: true,
    statsAngle: true,
    alwaysShowStats: true,
    statsPosition: 'center',
  };

  override clone(newId: string): IDrawing {
    return new InfoLine(newId, [...this._anchors], { ...this._style }, { ...this.trendLineOptions });
  }

  static override create(
    id: string,
    startAnchor: Anchor,
    endAnchor: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<TrendLineOptions>
  ): InfoLine {
    return new InfoLine(id, [startAnchor, endAnchor], style, options);
  }
}
