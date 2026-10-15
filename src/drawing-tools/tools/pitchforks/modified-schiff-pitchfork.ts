import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { Pitchfork, type PitchforkOptions } from './pitchfork';

export type ModifiedSchiffPitchforkOptions = PitchforkOptions;

/** Modified Schiff Pitchfork: the median starts at the middle of A–B. */
export class ModifiedSchiffPitchfork extends Pitchfork {
  override readonly type: string = 'modified-schiff-pitchfork';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<ModifiedSchiffPitchforkOptions> = {}
  ) {
    super(id, anchors, style, options, 'modified-schiff');
  }

  override clone(newId: string): IDrawing {
    return new ModifiedSchiffPitchfork(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._pitchforkOptions });
  }

  static create(
    id: string,
    pivot: Anchor,
    swing1: Anchor,
    swing2: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<ModifiedSchiffPitchforkOptions>
  ): ModifiedSchiffPitchfork {
    return new ModifiedSchiffPitchfork(id, [pivot, swing1, swing2], style, options);
  }
}
