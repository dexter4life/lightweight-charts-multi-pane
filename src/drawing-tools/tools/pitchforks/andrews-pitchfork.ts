import type { Anchor, DrawingStyle, IDrawing } from '../../core/types';
import { Pitchfork, type PitchforkOptions } from './pitchfork';

export type AndrewsPitchforkOptions = PitchforkOptions;

/** Andrews' Pitchfork (the plain "Pitchfork") */
export class AndrewsPitchfork extends Pitchfork {
  override readonly type: string = 'andrews-pitchfork';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<AndrewsPitchforkOptions> = {}
  ) {
    super(id, anchors, style, options, 'original');
  }

  override clone(newId: string): IDrawing {
    return new AndrewsPitchfork(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._pitchforkOptions });
  }

  static create(
    id: string,
    pivot: Anchor,
    swing1: Anchor,
    swing2: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<AndrewsPitchforkOptions>
  ): AndrewsPitchfork {
    return new AndrewsPitchfork(id, [pivot, swing1, swing2], style, options);
  }
}
