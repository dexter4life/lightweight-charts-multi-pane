import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { applyStyle, drawControlPoints } from '../../rendering/canvas-utils';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PatternDrawing } from './pattern-base';

export interface CycleOptions extends DrawingOptions {
  visibility?: VisibilityMap;
  /** Time Cycles only: shades the arcs. */
  fillBackground?: boolean;
}

/** Shared base of the repeating-time tools (Cyclic Lines, Time Cycles, Sine Line): two anchors set the period. */
export abstract class CycleDrawing extends PatternDrawing<CycleOptions> {
  protected _patternOptions: CycleOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<CycleOptions> = {},
    defaults: Partial<DrawingStyle> = {}
  ) {
    const { visibility, fillBackground, ...baseOptions } = options;
    super(id, anchors, { lineWidth: 1, ...defaults, ...style }, baseOptions);
    this._patternOptions = { ...this._options, visibility, fillBackground: fillBackground ?? true };
  }

  get cycleOptions(): CycleOptions {
    return this._patternOptions;
  }

  setCycleOptions(options: Partial<CycleOptions>): void {
    this.updatePatternOptions(options);
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._patternOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._patternOptions, visible: this._options.visible, locked: this._options.locked } };
  }

  override isValid(): boolean {
    return this._anchors.length >= 2;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new CyclePaneView(this)];
  }

  override computeGeometry(): never[] {
    return [];
  }

  /** Pixel positions of the two anchors, or null while either is off-screen. */
  protected anchorPixels(viewport: Viewport): [Point, Point] | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    return a && b ? [a, b] : null;
  }

  /** Draws the shape in CSS pixels; the context is already scaled by the pixel ratio. */
  abstract paint(ctx: CanvasRenderingContext2D, viewport: Viewport): void;

  abstract override clone(newId: string): IDrawing;
}

class CyclePaneView implements IPrimitivePaneView {
  private readonly _renderer: CyclePaneRenderer;

  constructor(drawing: CycleDrawing) {
    this._renderer = new CyclePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class CyclePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: CycleDrawing) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;

    const { context: ctx, horizontalPixelRatio: pr } = scope;
    ctx.save();
    applyStyle(ctx, drawing.style, pr);
    ctx.scale(pr, pr);
    // The pixel-ratio scaling above would double the width and dash lengths set by applyStyle.
    ctx.lineWidth = drawing.style.lineWidth;
    if (drawing.style.lineDash?.length) ctx.setLineDash(drawing.style.lineDash);
    drawing.paint(ctx, viewport);
    ctx.restore();

    if (drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered') {
      drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, '#2962FF');
    }
  }
}
