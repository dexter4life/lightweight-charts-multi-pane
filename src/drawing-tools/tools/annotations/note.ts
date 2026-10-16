import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, ControlPoint, Point, Viewport, DrawingStyle, DrawingOptions, DrawingState, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { NotePaneView } from './note-pane-view';
import { TEXT_FONT_FAMILY } from './text-annotation';

export interface NoteOptions extends DrawingOptions {
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  visibility?: VisibilityMap;
  /** Position as a fraction of the pane size; only used by the pixel-anchored variant. */
  relative?: { fx: number; fy: number };
}

export const NOTE_COLOR = '#3861F6';
export const NOTE_BACKGROUND = 'rgba(56, 97, 246, 0.7)';

/** Geometry of the pin marker and the text box, in CSS pixels relative to the anchor. */
export const NOTE_GEOMETRY = {
  boxWidth: 300,
  padX: 10,
  padY: 7.5,
  /** The reference draws its glyphs this far below the line's midpoint. */
  textDy: 1.25,
  lineHeightRatio: 19 / 14,
  /** Distance from the anchor up to the bottom of the text box. */
  boxBottom: 40,
  pinRadius: 12,
  /** Distance from the anchor up to the centre of the pin head. */
  pinCenter: 19.25,
  /** Distance from the anchor up to the tip of the pin. */
  pinTip: 3.5,
  tail: { halfWidth: 7.5, height: 7 },
  handleRadius: 4,
} as const;

export interface NoteBox {
  width: number;
  height: number;
  lines: string[];
  lineHeight: number;
  font: string;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/**
 * Note - a pin marker at a price and time. The text box shows while the pin is hovered or the note is selected.
 */
export class Note extends Drawing {
  readonly type: string = 'note';

  protected _noteOptions: NoteOptions;
  protected _rel: { fx: number; fy: number } | null = null;
  protected _grab: Point | null = null;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  /** Pixel-anchored notes keep their spot on the pane while the chart is scrolled or zoomed. */
  protected readonly pixelAnchored: boolean = false;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<NoteOptions> = {}) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: NOTE_COLOR, ...style }, base);

    this._noteOptions = {
      ...this._options,
      text: options.text ?? 'Text',
      fontSize: options.fontSize ?? 14,
      bold: options.bold ?? false,
      italic: options.italic ?? false,
      textColor: options.textColor ?? '#FFFFFF',
      backgroundColor: options.backgroundColor ?? NOTE_BACKGROUND,
      borderColor: options.borderColor ?? NOTE_COLOR,
      visibility: options.visibility,
    };
    if (options.relative) this._rel = { ...options.relative };
  }

  get noteOptions(): NoteOptions {
    return this._noteOptions;
  }

  setNoteOptions(options: Partial<NoteOptions>): void {
    this._noteOptions = { ...this._noteOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  setText(text: string): void {
    this.setNoteOptions({ text });
  }

  getText(): string {
    return this._noteOptions.text ?? '';
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

  override showsAxisTags(): boolean {
    return false;
  }

  isValid(): boolean {
    return this._anchors.length >= 1;
  }

  /** True while the text box is visible. */
  get expanded(): boolean {
    const s: DrawingState = this.state;
    return s === 'hovered' || s === 'selected' || s === 'editing';
  }

  /** The anchor in pane pixels (the tip of the handle). */
  pinPoint(viewport: Viewport): Point | null {
    if (this.pixelAnchored) {
      if (!this._rel) {
        const p = this.anchorToPixel(this._anchors[0], viewport);
        if (!p) return null;
        this._rel = { fx: p.x / viewport.width, fy: p.y / viewport.height };
      }
      return { x: this._rel.fx * viewport.width, y: this._rel.fy * viewport.height };
    }
    return this.anchorToPixel(this._anchors[0], viewport);
  }

  layout(): NoteBox {
    const o = this._noteOptions;
    const fontSize = o.fontSize ?? 14;
    const font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${fontSize}px ${TEXT_FONT_FAMILY}`;
    const lineHeight = Math.round(fontSize * NOTE_GEOMETRY.lineHeightRatio);
    const ctx = measurer();
    const measure = (s: string) => (ctx ? ((ctx.font = font), ctx.measureText(s).width) : s.length * fontSize * 0.55);
    const wrapAt = NOTE_GEOMETRY.boxWidth - NOTE_GEOMETRY.padX * 2;

    const lines: string[] = [];
    for (const para of (o.text ?? '').split('\n')) {
      let cur = '';
      for (const word of para.split(' ')) {
        const next = cur ? `${cur} ${word}` : word;
        if (cur && measure(next) > wrapAt) {
          lines.push(cur);
          cur = word;
        } else {
          cur = next;
        }
      }
      lines.push(cur);
    }
    return { width: NOTE_GEOMETRY.boxWidth, height: lines.length * lineHeight + NOTE_GEOMETRY.padY * 2, lines, lineHeight, font };
  }

  /** Top-left of the text box in pane pixels. */
  boxOrigin(viewport: Viewport): Point | null {
    const p = this.pinPoint(viewport);
    if (!p) return null;
    const box = this.layout();
    return { x: p.x - box.width / 2, y: p.y - NOTE_GEOMETRY.boxBottom - box.height };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    if (!this.isValid()) return [];
    const p = this.pinPoint(viewport);
    return p ? [{ index: 0, x: p.x, y: p.y, radius: NOTE_GEOMETRY.handleRadius }] : [];
  }

  override setState(state: DrawingState): void {
    if (state !== 'editing') this._grab = null;
    super.setState(state);
  }

  override grabControlPoint(index: number, point: Point): void {
    const viewport = this.getViewport();
    const cp = viewport && index === 0 ? this.getControlPoints(viewport)[0] : undefined;
    this._grab = cp ? { x: point.x - cp.x, y: point.y - cp.y } : null;
  }

  /** The handle moves the pin by the pointer delta rather than snapping it to the pointer. */
  override updateAnchor(index: number, anchor: Anchor): void {
    const viewport = this.getViewport();
    if (!viewport || index !== 0) return super.updateAnchor(index, anchor);
    const pointer = this.anchorToPixel(anchor, viewport);
    if (!pointer) return super.updateAnchor(index, anchor);
    const grab = this._grab ?? { x: 0, y: 0 };
    const x = pointer.x - grab.x;
    const y = pointer.y - grab.y;
    if (this.pixelAnchored) {
      this._rel = { fx: x / viewport.width, fy: y / viewport.height };
      this.requestUpdate();
      return;
    }
    const time = viewport.timeScale.coordinateToTime(x);
    const price = viewport.priceScale.coordinateToPrice(y);
    if (time === null || price === null) return;
    super.updateAnchor(index, { ...anchor, time, price });
  }

  override bodyDragOrigin(viewport: Viewport): Point[] | null {
    if (!this.pixelAnchored) return super.bodyDragOrigin(viewport);
    const p = this.pinPoint(viewport);
    return p ? [p] : null;
  }

  override bodyDragAnchors(origin: Point[], dx: number, dy: number, viewport: Viewport): Anchor[] | null {
    if (!this.pixelAnchored) return super.bodyDragAnchors(origin, dx, dy, viewport);
    const o = origin[0];
    this._rel = { fx: (o.x + dx) / viewport.width, fy: (o.y + dy) / viewport.height };
    return [...this._anchors];
  }

  paneViews(): IPrimitivePaneView[] {
    return [new NotePaneView(this)];
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;
    const p = this.pinPoint(viewport);
    if (!p) return false;
    const g = NOTE_GEOMETRY;
    const cy = p.y - g.pinCenter;
    if (Math.hypot(point.x - p.x, point.y - cy) <= g.pinRadius + 2) return true;
    if (Math.abs(point.x - p.x) <= 6 && point.y >= cy && point.y <= p.y + 4) return true;
    if (!this.expanded) return false;
    const o = this.boxOrigin(viewport);
    if (!o) return false;
    const box = this.layout();
    return point.x >= o.x && point.x <= o.x + box.width && point.y >= o.y && point.y <= o.y + box.height + g.tail.height;
  }

  override toJSON() {
    const { visible, locked } = this._options;
    return { ...super.toJSON(), options: { ...this._noteOptions, visible, locked, relative: this._rel ?? undefined } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._noteOptions = { ...this._noteOptions, ...data.options };
    this._rel = data?.options?.relative ? { ...data.options.relative } : null;
  }

  clone(newId: string): IDrawing {
    return new (this.constructor as typeof Note)(newId, [...this._anchors], { ...this._style }, { ...this._noteOptions, relative: this._rel ?? undefined });
  }

  static create(id: string, position: Anchor, text: string, style?: Partial<DrawingStyle>, options?: Partial<NoteOptions>): Note {
    return new this(id, [position], style, { ...options, text });
  }
}
