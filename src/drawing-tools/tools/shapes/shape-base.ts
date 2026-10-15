import type { Drawing as DrawingType } from '../../core/drawing';
import { Drawing } from '../../core/drawing';
import type { Anchor, DrawingOptions, DrawingStyle, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import type { IPrimitivePaneView } from '../../../model/ipane-primitive';
import { ShapePaneView } from './shape-pane-view';

/** Options shared by the closed shapes (circle, ellipse, triangle, ...). */
export interface ShapeOptions extends DrawingOptions {
  /** Background fill; the colour and opacity live in `style.fillColor`. */
  filled?: boolean;
  showText?: boolean;
  text?: string;
  textColor?: string;
  textSize?: number;
  textBold?: boolean;
  textItalic?: boolean;
  visibility?: VisibilityMap;
}

export const DEFAULT_SHAPE_OPTIONS = {
  filled: true,
  showText: false,
  text: '',
  textSize: 14,
  textBold: false,
  textItalic: false,
};

/**
 * Base for the closed shapes: shared options, interval visibility, JSON, and the generic pane view.
 * Subclasses trace their outline and say where the text goes.
 */
export abstract class ShapeBase extends Drawing {
  protected _shapeOptions: ShapeOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[],
    style: Partial<DrawingStyle>,
    options: Partial<ShapeOptions>,
    defaultStyle: Partial<DrawingStyle>,
    defaultOptions: Partial<ShapeOptions> = {}
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(id, anchors, { ...defaultStyle, ...style }, base);
    this._shapeOptions = { ...DEFAULT_SHAPE_OPTIONS, ...defaultOptions, ...options };
  }

  get shapeOptions(): ShapeOptions {
    return this._shapeOptions;
  }

  setShapeOptions(options: Partial<ShapeOptions>): void {
    this._shapeOptions = { ...this._shapeOptions, ...options };
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._shapeOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  /** Adds the outline to the current path, in bitmap pixels. */
  abstract tracePath(ctx: CanvasRenderingContext2D, pr: number, viewport: Viewport): boolean;

  /** Where the text is centred, in CSS pixels. */
  abstract textCenter(viewport: Viewport): Point | null;

  paneViews(): IPrimitivePaneView[] {
    return [new ShapePaneView(this as unknown as ShapeBase & DrawingType, 'body'), new ShapePaneView(this as unknown as ShapeBase & DrawingType, 'handles')];
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._shapeOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setShapeOptions(data.options);
  }
}
