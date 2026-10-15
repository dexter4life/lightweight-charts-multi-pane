import type { Anchor, DrawingStyle, IDrawing, Viewport } from '../../core/types';
import {
  FibTimeZone,
  type FibTimeZoneLayout,
  type FibTimeZoneLevel,
  type FibTimeZoneOptions,
  DEFAULT_FIB_TIME_ZONE_OPTIONS,
} from './fib-time-zone';
import { FibTimeZonePaneView } from './fib-time-zone-pane-view';
import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

/** Fibonacci time extension levels (re-exported for public API compatibility). */
export { FIB_TIME_EXTENSION_LEVELS } from './constants';

export type FibTimeExtensionLevel = FibTimeZoneLevel;
export type FibTimeExtensionOptions = FibTimeZoneOptions;

const TREND_TIME_LEVELS: Array<[number, string]> = [
  [0, '#787B86'],
  [0.382, '#F23645'],
  [0.5, '#81c784'],
  [0.618, '#4caf50'],
  [1, '#089981'],
  [1.382, '#00bcd4'],
  [1.618, '#787B86'],
  [2, '#2962FF'],
  [2.382, '#e91e63'],
  [2.618, '#9c27b0'],
  [3, '#673ab7'],
];

export const defaultFibTimeExtensionLevels = (): FibTimeExtensionLevel[] =>
  TREND_TIME_LEVELS.map(([value, color]) => ({
    value,
    enabled: value !== 0.5,
    color,
    width: 1,
    dash: [],
  }));

export const DEFAULT_FIB_TIME_EXTENSION_OPTIONS = {
  ...DEFAULT_FIB_TIME_ZONE_OPTIONS,
  backgroundVisible: true,
};

/**
 * Trend-Based Fib Time: the A→B distance is the unit and the third point is level 0, so every
 * enabled level draws a full-height vertical line at `C + value × (B − A)`.
 */
export class FibTimeExtension extends FibTimeZone {
  override readonly type: string = 'fib-time-extension';

  protected static override readonly REQUIRED_ANCHORS: number = 3;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FibTimeExtensionOptions> = {}
  ) {
    super(
      id,
      anchors,
      { lineColor: '#787B86', lineWidth: 1, lineDash: [6, 6], ...style },
      {
        ...DEFAULT_FIB_TIME_EXTENSION_OPTIONS,
        ...options,
        levels: (options.levels ?? defaultFibTimeExtensionLevels()).map((l) => ({ ...l })),
      }
    );
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new FibTimeZonePaneView(this, 'body'), new FibTimeZonePaneView(this, 'handles')];
  }

  override layout(viewport: Viewport): FibTimeZoneLayout | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    const c = this.anchorToPixel(this._anchors[2], viewport);
    if (!a || !b || !c) return null;

    const unit = b.x - a.x;
    const all = (this._fibOptions.levels ?? [])
      .filter((l) => l.enabled)
      .map((level) => ({ level, x: c.x + level.value * unit }))
      .sort((p, q) => p.level.value - q.level.value);
    const lines = all.filter((l) => l.x >= -1 && l.x <= viewport.width + 1);
    return { a, b, trend: [a, b, c], lines, all };
  }

  override clone(newId: string): IDrawing {
    return new FibTimeExtension(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._fibOptions });
  }
}

export { FibTimeZonePaneView as FibTimeExtensionPaneView };

