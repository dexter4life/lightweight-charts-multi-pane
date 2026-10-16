import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PriceNotePaneView } from './price-note-pane-view';

export const PRICE_NOTE_FONT = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";

export interface PriceNoteOptions extends DrawingOptions {
  /** Optional caption drawn along the line. */
  showText?: boolean;
  text?: string;
  textColor?: string;
  textSize?: number;
  textBold?: boolean;
  textItalic?: boolean;
  textHAlign?: 'left' | 'center' | 'right';
  textVAlign?: 'top' | 'middle' | 'bottom';
  /** The price tag at the second point. */
  priceLabelBackgroundColor?: string;
  priceLabelBorderColor?: string;
  priceLabelTextColor?: string;
  priceLabelFontSize?: number;
  priceLabelBold?: boolean;
  priceLabelItalic?: boolean;
  visibility?: VisibilityMap;
}

export const PRICE_NOTE_GEOMETRY = {
  /** Label height as a multiple of its font size. */
  heightRatio: 2.08,
  padX: 8.75,
  /** Extra tracking between glyphs, as a fraction of the font size. */
  tracking: 0.035,
  radius: 4,
  dotRadius: 2,
} as const;

export interface PriceNoteLayout {
  p1: Point;
  p2: Point;
  box: { x: number; y: number; w: number; h: number };
  text: string;
  font: string;
  tracking: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/** Price Note - a line whose second end carries a tag showing the price of the first point. */
export class PriceNote extends Drawing {
  readonly type = 'price-note';

  protected static readonly REQUIRED_ANCHORS = 2;
  protected static readonly HIT_THRESHOLD = 6;

  private _noteOptions: PriceNoteOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<PriceNoteOptions> = {}) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: '#2962FF', lineWidth: 1, ...style }, base);

    this._noteOptions = {
      ...this._options,
      showText: options.showText ?? false,
      text: options.text ?? '',
      textColor: options.textColor ?? '#2962FF',
      textSize: options.textSize ?? 14,
      textBold: options.textBold ?? false,
      textItalic: options.textItalic ?? false,
      textHAlign: options.textHAlign ?? 'center',
      textVAlign: options.textVAlign ?? 'bottom',
      priceLabelBackgroundColor: options.priceLabelBackgroundColor ?? '#2962FF',
      priceLabelBorderColor: options.priceLabelBorderColor ?? '#2962FF',
      priceLabelTextColor: options.priceLabelTextColor ?? '#FFFFFF',
      priceLabelFontSize: options.priceLabelFontSize ?? 12,
      priceLabelBold: options.priceLabelBold ?? false,
      priceLabelItalic: options.priceLabelItalic ?? false,
      visibility: options.visibility,
    };
  }

  get priceNoteOptions(): PriceNoteOptions {
    return this._noteOptions;
  }

  setPriceNoteOptions(options: Partial<PriceNoteOptions>): void {
    this._noteOptions = { ...this._noteOptions, ...options };
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
    const map = this._noteOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  getPrice(): number {
    return this._anchors[0]?.price ?? 0;
  }

  isValid(): boolean {
    return this._anchors.length >= PriceNote.REQUIRED_ANCHORS;
  }

  private priceText(): string {
    const price = this._anchors[0]?.price;
    if (price === undefined) return '';
    const series = this._series as unknown as { priceFormatter(): { format(p: number): string } } | null;
    return series ? series.priceFormatter().format(price) : price.toFixed(2);
  }

  layout(viewport: Viewport): PriceNoteLayout | null {
    if (!this.isValid()) return null;
    const p1 = this.anchorToPixel(this._anchors[0], viewport);
    const p2 = this.anchorToPixel(this._anchors[1], viewport);
    if (!p1 || !p2) return null;
    const g = PRICE_NOTE_GEOMETRY;
    const o = this._noteOptions;
    const fontSize = o.priceLabelFontSize ?? 12;
    const font = `${o.priceLabelItalic ? 'italic ' : ''}${o.priceLabelBold ? 'bold ' : ''}${fontSize}px ${PRICE_NOTE_FONT}`;
    const text = this.priceText();
    const ctx = measurer();
    const tracking = fontSize * g.tracking;
    const tw = (ctx ? ((ctx.font = font), ctx.measureText(text).width) : text.length * fontSize * 0.6) + Math.max(0, text.length - 1) * tracking;
    const w = tw + g.padX * 2;
    const h = fontSize * g.heightRatio;
    return { p1, p2, box: { x: p2.x, y: p2.y - h / 2, w, h }, text, font, tracking };
  }

  paneViews(): IPrimitivePaneView[] {
    return [new PriceNotePaneView(this)];
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;
    const l = this.layout(viewport);
    if (!l) return false;
    const { x, y, w, h } = l.box;
    if (point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h) return true;
    const dx = l.p2.x - l.p1.x;
    const dy = l.p2.y - l.p1.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - l.p1.x) * dx + (point.y - l.p1.y) * dy) / len2));
    return Math.hypot(point.x - (l.p1.x + t * dx), point.y - (l.p1.y + t * dy)) <= PriceNote.HIT_THRESHOLD;
  }

  override toJSON() {
    const { visible, locked } = this._options;
    return { ...super.toJSON(), options: { ...this._noteOptions, visible, locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._noteOptions = { ...this._noteOptions, ...data.options };
  }

  clone(newId: string): IDrawing {
    return new PriceNote(newId, [...this._anchors], { ...this._style }, { ...this._noteOptions });
  }

  static create(id: string, p1: Anchor, p2: Anchor, style?: Partial<DrawingStyle>, options?: Partial<PriceNoteOptions>): PriceNote {
    return new PriceNote(id, [p1, p2], style, options);
  }
}
