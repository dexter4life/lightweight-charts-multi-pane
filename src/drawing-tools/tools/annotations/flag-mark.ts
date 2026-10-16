import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { FlagMarkPaneView } from './flag-mark-pane-view';

export type FlagColor = string;

export const FLAG_MARK_DEFAULT_COLOR = '#2962FF';
export const FLAG_MARK_POLE_COLOR = '#434651';

/** Dimensions in css px relative to the anchor, which sits at the bottom of the pole. */
export const FLAG_MARK_GEOMETRY = {
  poleHeight: 22,
  poleWidth: 2,
  clothLeft: 2.5,
  clothRight: 19.5,
  clothTop: -22.25,
  clothBottom: -10,
} as const;

export interface FlagMarkOptions extends DrawingOptions {
  flagColor?: FlagColor;
  visibility?: VisibilityMap;
}

/** A single-point flag marking a bar. */
export class FlagMark extends Drawing {
  readonly type = 'flag-mark';

  protected static readonly REQUIRED_ANCHORS = 1;

  private _flagOptions: FlagMarkOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<FlagMarkOptions> = {}) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    const flagColor = options.flagColor ?? FLAG_MARK_DEFAULT_COLOR;
    super(id, anchors, { lineColor: flagColor, lineWidth: 1, ...style }, base);
    this._flagOptions = { ...this._options, flagColor, visibility: options.visibility };
  }

  get flagMarkOptions(): FlagMarkOptions {
    return this._flagOptions;
  }

  setFlagMarkOptions(options: Partial<FlagMarkOptions>): void {
    this._flagOptions = { ...this._flagOptions, ...options };
    if (options.flagColor) this.updateStyle({ lineColor: options.flagColor });
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._flagOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  isValid(): boolean {
    return this._anchors.length >= FlagMark.REQUIRED_ANCHORS;
  }

  layout(viewport: Viewport): { anchor: Point } | null {
    if (!this.isValid()) return null;
    const anchor = this.anchorToPixel(this._anchors[0], viewport);
    return anchor ? { anchor } : null;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new FlagMarkPaneView(this)];
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;
    const l = this.layout(viewport);
    if (!l) return false;
    const g = FLAG_MARK_GEOMETRY;
    const pad = 3;
    return (
      point.x >= l.anchor.x - g.poleWidth / 2 - pad &&
      point.x <= l.anchor.x + g.clothRight + pad &&
      point.y >= l.anchor.y + g.clothTop - pad &&
      point.y <= l.anchor.y + pad
    );
  }

  clone(newId: string): IDrawing {
    return new FlagMark(newId, [...this._anchors], { ...this._style }, { ...this._flagOptions });
  }

  override toJSON() {
    const { visible, locked } = this._options;
    return { ...super.toJSON(), options: { ...this._flagOptions, visible, locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._flagOptions = { ...this._flagOptions, ...data.options };
  }
}
