import type { IDrawing } from '../../core/types';
import { PositionDrawing, type PositionOptions } from './position-base';

export type ShortPositionOptions = PositionOptions;

/** Short Position: one click places an entry with a take-profit below and a stop above it, sized in ticks. */
export class ShortPosition extends PositionDrawing {
  readonly type = 'short-position';
  protected readonly direction = -1;

  override clone(newId: string): IDrawing {
    return new ShortPosition(newId, [...this._anchors], { ...this._style }, { ...this._positionOptions });
  }
}
