import type { IDrawing } from '../../core/types';
import { PositionDrawing, type PositionOptions } from './position-base';

export type LongPositionOptions = PositionOptions;

/** Long Position: one click places an entry with a take-profit above and a stop below it, sized in ticks. */
export class LongPosition extends PositionDrawing {
  readonly type = 'long-position';
  protected readonly direction = 1;

  override clone(newId: string): IDrawing {
    return new LongPosition(newId, [...this._anchors], { ...this._style }, { ...this._positionOptions });
  }
}
