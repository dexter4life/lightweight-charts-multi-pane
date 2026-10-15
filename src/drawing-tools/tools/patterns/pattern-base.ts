import { Drawing } from '../../core/drawing';
import type { DrawingOptions, SerializedDrawing } from '../../core/types';

export abstract class PatternDrawing<TOptions extends DrawingOptions> extends Drawing {
  protected abstract _patternOptions: TOptions;

  protected updatePatternOptions(options: Partial<TOptions>): void {
    this._patternOptions = { ...this._patternOptions, ...options };
    this.requestUpdate();
  }

  override toJSON(): SerializedDrawing & { options: TOptions } {
    const base = super.toJSON();
    return {
      ...base,
      options: { ...this._patternOptions },
    };
  }

  override fromJSON(data: SerializedDrawing & { options?: Partial<TOptions> }): void {
    super.fromJSON(data);
    if (data.options) {
      this._patternOptions = { ...this._patternOptions, ...data.options };
    }
  }
}
