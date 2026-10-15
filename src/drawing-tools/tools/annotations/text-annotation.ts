import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, ControlPoint, Point, Viewport, DrawingStyle, DrawingOptions, DrawingState, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { TextAnnotationPaneView } from './text-annotation-pane-view';

/**
 * TextAnnotation options
 */
export interface TextAnnotationOptions extends DrawingOptions {
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  wordWrap?: boolean;
  wordWrapWidth?: number;
  fillBackground?: boolean;
  backgroundColor?: string;
  drawBorder?: boolean;
  borderColor?: string;
  visibility?: VisibilityMap;
}

export const TEXT_COLOR = '#2962FF';
export const TEXT_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const PAD_X = 4;
const PAD_Y = 1.5;
const HANDLE_RADIUS = 4;

export interface TextBox {
  /** Box size in CSS pixels. */
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
 * TextAnnotation - a text label placed on the chart.
 *
 * The anchor is the top-left corner of the text box. The single handle is at the bottom-centre of the box and
 * dragging it translates the text (the box does not jump to the pointer).
 */
export class TextAnnotation extends Drawing {
  readonly type = 'text-annotation';

  protected static readonly REQUIRED_ANCHORS = 1;

  private _textOptions: TextAnnotationOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;
  private _grab: Point | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<TextAnnotationOptions> = {}
  ) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: TEXT_COLOR, ...style }, base);

    this._textOptions = {
      ...this._options,
      text: options.text ?? 'Text',
      fontSize: options.fontSize ?? 14,
      bold: options.bold ?? false,
      italic: options.italic ?? false,
      wordWrap: options.wordWrap ?? false,
      wordWrapWidth: options.wordWrapWidth ?? 200,
      fillBackground: options.fillBackground ?? false,
      backgroundColor: options.backgroundColor ?? 'rgba(91, 133, 191, 0.3)',
      drawBorder: options.drawBorder ?? false,
      borderColor: options.borderColor ?? '#667b8b',
      visibility: options.visibility,
    };
  }

  get textOptions(): TextAnnotationOptions {
    return this._textOptions;
  }

  setTextOptions(options: Partial<TextAnnotationOptions>): void {
    this._textOptions = { ...this._textOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  setText(text: string): void {
    this.setTextOptions({ text });
  }

  getText(): string {
    return this._textOptions.text ?? '';
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._textOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override showsAxisTags(): boolean {
    return false;
  }

  isValid(): boolean {
    return this._anchors.length >= TextAnnotation.REQUIRED_ANCHORS;
  }

  /** Lays the text out (wrapping, size) in CSS pixels. */
  layout(): TextBox {
    const o = this._textOptions;
    const fontSize = o.fontSize ?? 14;
    const font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${fontSize}px ${TEXT_FONT_FAMILY}`;
    const lineHeight = Math.round(fontSize * 1.2);
    const ctx = measurer();
    const width = (s: string) => (ctx ? ((ctx.font = font), ctx.measureText(s).width) : s.length * fontSize * 0.55);

    const lines: string[] = [];
    const wrapAt = o.wordWrap ? Math.max(20, (o.wordWrapWidth ?? 200) - PAD_X * 2) : Infinity;
    for (const para of (o.text ?? '').split('\n')) {
      if (wrapAt === Infinity) {
        lines.push(para);
        continue;
      }
      let cur = '';
      for (const word of para.split(' ')) {
        const next = cur ? `${cur} ${word}` : word;
        if (cur && width(next) > wrapAt) {
          lines.push(cur);
          cur = word;
        } else {
          cur = next;
        }
      }
      lines.push(cur);
    }

    const textW = o.wordWrap ? wrapAt : Math.max(...lines.map(width), 0);
    return { width: textW + PAD_X * 2, height: lines.length * lineHeight + PAD_Y * 2, lines, lineHeight, font };
  }

  /** Top-left of the box in pane pixels. */
  boxOrigin(viewport: Viewport): Point | null {
    const p = this.anchorToPixel(this._anchors[0], viewport);
    return p ? { x: p.x, y: p.y - 1 } : null;
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    if (!this.isValid()) return [];
    const o = this.boxOrigin(viewport);
    if (!o) return [];
    const box = this.layout();
    return [{ index: 0, x: o.x + box.width / 2, y: o.y + box.height, radius: HANDLE_RADIUS }];
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

  /** The handle drags the whole text by the pointer delta instead of snapping the anchor to the pointer. */
  override updateAnchor(index: number, anchor: Anchor): void {
    const viewport = this.getViewport();
    if (!viewport || index !== 0) return super.updateAnchor(index, anchor);
    const pointer = this.anchorToPixel(anchor, viewport);
    const cp = this.getControlPoints(viewport)[0];
    if (!pointer || !cp) return super.updateAnchor(index, anchor);
    if (!this._grab) this._grab = { x: 0, y: 0 };
    const box = this.layout();
    const x = pointer.x - this._grab.x - box.width / 2;
    const y = pointer.y - this._grab.y - box.height + 1;
    const time = viewport.timeScale.coordinateToTime(x);
    const price = viewport.priceScale.coordinateToPrice(y);
    if (time === null || price === null) return;
    super.updateAnchor(index, { ...anchor, time, price });
  }

  paneViews(): IPrimitivePaneView[] {
    return [new TextAnnotationPaneView(this)];
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;
    const o = this.boxOrigin(viewport);
    if (!o) return false;
    const box = this.layout();
    return point.x >= o.x - 2 && point.x <= o.x + box.width + 2 && point.y >= o.y - 2 && point.y <= o.y + box.height + 2;
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._textOptions, visible: this._options.visible, locked: this._options.locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) {
      this._textOptions = { ...this._textOptions, ...data.options };
    }
  }

  clone(newId: string): IDrawing {
    return new TextAnnotation(newId, [...this._anchors], { ...this._style }, { ...this._textOptions });
  }

  static create(
    id: string,
    position: Anchor,
    text: string,
    style?: Partial<DrawingStyle>,
    options?: Partial<TextAnnotationOptions>
  ): TextAnnotation {
    return new TextAnnotation(id, [position], style, { ...options, text });
  }
}
