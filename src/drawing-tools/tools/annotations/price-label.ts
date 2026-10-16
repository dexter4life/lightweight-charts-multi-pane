import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, ControlPoint, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PriceLabelPaneView } from './price-label-pane-view';
import { TEXT_FONT_FAMILY } from './text-annotation';

export interface PriceLabelOptions extends DrawingOptions {
  fontSize?: number;
  bold?: boolean;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  visibility?: VisibilityMap;
}

export const PRICE_LABEL_GEOMETRY = {
  /** Offset of the bubble's bottom-left corner from the anchor. */
  offsetX: 8.5,
  offsetY: 14,
  padX: 11.5,
  /** Extra tracking between glyphs, as a fraction of the font size. */
  tracking: 0.1,
  radius: 4,
  tailFrom: 2,
  tailTo: 12,
  handleRadius: 4.75,
} as const;

export interface PriceLabelLayout {
  box: { x: number; y: number; w: number; h: number };
  anchor: Point;
  text: string;
  font: string;
  tracking: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/** Price Label - a bubble showing the price at the anchor, joined to it by a short tail. */
export class PriceLabel extends Drawing {
  readonly type = 'price-label';

  protected static readonly REQUIRED_ANCHORS = 1;

  private _labelOptions: PriceLabelOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<PriceLabelOptions> = {}) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: '#2962FF', ...style }, base);

    this._labelOptions = {
      ...this._options,
      fontSize: options.fontSize ?? 14,
      bold: options.bold ?? true,
      textColor: options.textColor ?? '#FFFFFF',
      backgroundColor: options.backgroundColor ?? '#2962FF',
      borderColor: options.borderColor ?? '#2962FF',
      visibility: options.visibility,
    };
  }

  get labelOptions(): PriceLabelOptions {
    return this._labelOptions;
  }

  get priceLabelOptions(): PriceLabelOptions {
    return this._labelOptions;
  }

  setPriceLabelOptions(options: Partial<PriceLabelOptions>): void {
    this._labelOptions = { ...this._labelOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  setLabelOptions(options: Partial<PriceLabelOptions>): void {
    this.setPriceLabelOptions(options);
  }

  getPrice(): number {
    return this._anchors[0]?.price ?? 0;
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._labelOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override showsAxisTags(): boolean {
    return false;
  }

  isValid(): boolean {
    return this._anchors.length >= PriceLabel.REQUIRED_ANCHORS;
  }

  private priceText(): string {
    const price = this._anchors[0]?.price;
    if (price === undefined) return '';
    const series = this._series as unknown as { priceFormatter(): { format(p: number): string } } | null;
    return series ? series.priceFormatter().format(price) : price.toFixed(2);
  }

  layout(viewport: Viewport): PriceLabelLayout | null {
    if (!this.isValid()) return null;
    const p = this.anchorToPixel(this._anchors[0], viewport);
    if (!p) return null;
    const g = PRICE_LABEL_GEOMETRY;
    const o = this._labelOptions;
    const fontSize = o.fontSize ?? 14;
    const font = `${o.bold === false ? '' : 'bold '}${fontSize}px ${TEXT_FONT_FAMILY}`;
    const text = this.priceText();
    const ctx = measurer();
    const tracking = fontSize * g.tracking;
    const tw = (ctx ? ((ctx.font = font), ctx.measureText(text).width) : text.length * fontSize * 0.6) + Math.max(0, text.length - 1) * tracking;
    const w = tw + g.padX * 2;
    const h = fontSize * 1.83;
    return { box: { x: p.x + g.offsetX, y: p.y - g.offsetY - h, w, h }, anchor: p, text, font, tracking };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const p = this.isValid() ? this.anchorToPixel(this._anchors[0], viewport) : null;
    return p ? [{ index: 0, x: p.x, y: p.y, radius: 7 }] : [];
  }

  paneViews(): IPrimitivePaneView[] {
    return [new PriceLabelPaneView(this)];
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;
    const l = this.layout(viewport);
    if (!l) return false;
    const { x, y, w, h } = l.box;
    if (point.x >= x - 2 && point.x <= x + w + 2 && point.y >= y - 2 && point.y <= y + h + 2) return true;
    // tail: the strip between the anchor and the bubble's bottom-left
    return point.x >= l.anchor.x - 4 && point.x <= x + PRICE_LABEL_GEOMETRY.tailTo && point.y >= y + h - 1 && point.y <= l.anchor.y + 4;
  }

  override toJSON() {
    const { visible, locked } = this._options;
    return { ...super.toJSON(), options: { ...this._labelOptions, visible, locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._labelOptions = { ...this._labelOptions, ...data.options };
  }

  clone(newId: string): IDrawing {
    return new PriceLabel(newId, [...this._anchors], { ...this._style }, { ...this._labelOptions });
  }

  static create(id: string, position: Anchor, style?: Partial<DrawingStyle>, options?: Partial<PriceLabelOptions>): PriceLabel {
    return new PriceLabel(id, [position], style, options);
  }
}
