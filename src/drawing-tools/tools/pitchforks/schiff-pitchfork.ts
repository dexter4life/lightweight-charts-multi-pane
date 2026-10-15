import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { Pitchfork, type PitchforkOptions } from './pitchfork';

export type SchiffPitchforkOptions = PitchforkOptions;

/** Schiff Pitchfork: the median starts at the middle price of A–B, at the time of A. */
export class SchiffPitchfork extends Pitchfork {
  override readonly type: string = 'schiff-pitchfork';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<SchiffPitchforkOptions> = {}
  ) {
    super(id, anchors, style, options, 'schiff');
  }

  override clone(newId: string): IDrawing {
    return new SchiffPitchfork(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._pitchforkOptions });
  }

  static create(
    id: string,
    pivot: Anchor,
    swing1: Anchor,
    swing2: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<SchiffPitchforkOptions>
  ): SchiffPitchfork {
    return new SchiffPitchfork(id, [pivot, swing1, swing2], style, options);
  }
}
