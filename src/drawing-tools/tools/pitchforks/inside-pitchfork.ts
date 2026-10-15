import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { Pitchfork, type PitchforkOptions } from './pitchfork';

export type InsidePitchforkOptions = PitchforkOptions;

/** Inside Pitchfork: the median starts on B–C and runs parallel to the line from the middle of A–B to C. */
export class InsidePitchfork extends Pitchfork {
  override readonly type: string = 'inside-pitchfork';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<InsidePitchforkOptions> = {}
  ) {
    super(id, anchors, style, options, 'inside');
  }

  override clone(newId: string): IDrawing {
    return new InsidePitchfork(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._pitchforkOptions });
  }

  static create(
    id: string,
    pivot: Anchor,
    swing1: Anchor,
    swing2: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<InsidePitchforkOptions>
  ): InsidePitchfork {
    return new InsidePitchfork(id, [pivot, swing1, swing2], style, options);
  }
}
