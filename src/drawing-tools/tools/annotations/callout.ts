import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, ControlPoint, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { CalloutPaneView } from './callout-pane-view';
import { TEXT_FONT_FAMILY } from './text-annotation';

export interface CalloutOptions extends DrawingOptions {
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  wordWrap?: boolean;
  wordWrapWidth?: number;
  visibility?: VisibilityMap;
}

export const CALLOUT_GEOMETRY = {
  padX: 10,
  padY: 10,
  radius: 6,
  /** Width of the tail where it leaves a straight edge. */
  tailBase: 16,
  handleRadius: 4.75,
} as const;

export type CalloutSide = 'top' | 'right' | 'bottom' | 'left';
export type CalloutCorner = 'tl' | 'tr' | 'br' | 'bl';

export type CalloutTail =
  | { kind: 'edge'; side: CalloutSide; apex: Point }
  | { kind: 'corner'; corner: CalloutCorner; apex: Point };

export interface CalloutLayout {
  /** Text box in pane pixels. */
  box: { x: number; y: number; w: number; h: number };
  apex: Point;
  tail: CalloutTail | null;
  lines: string[];
  font: string;
  lineHeight: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/**
 * Callout - a text box with a tail pointing at a price/time. The first anchor is the tail tip, the second is the centre
 * of the box. The tail leaves the nearest edge, or replaces the nearest corner when the tip lies diagonally off the box.
 */
export class Callout extends Drawing {
  readonly type = 'callout';

  protected static readonly REQUIRED_ANCHORS = 2;

  private _calloutOptions: CalloutOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<CalloutOptions> = {}) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: '#0097A7', ...style }, base);

    this._calloutOptions = {
      ...this._options,
      text: options.text ?? 'Text',
      fontSize: options.fontSize ?? 14,
      bold: options.bold ?? false,
      italic: options.italic ?? false,
      textColor: options.textColor ?? '#FFFFFF',
      backgroundColor: options.backgroundColor ?? 'rgba(0, 151, 167, 0.7)',
      borderColor: options.borderColor ?? '#0097A7',
      borderWidth: options.borderWidth ?? 1,
      wordWrap: options.wordWrap ?? false,
      wordWrapWidth: options.wordWrapWidth ?? 200,
      visibility: options.visibility,
    };
  }

  get calloutOptions(): CalloutOptions {
    return this._calloutOptions;
  }

  setCalloutOptions(options: Partial<CalloutOptions>): void {
    this._calloutOptions = { ...this._calloutOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  setText(text: string): void {
    this.setCalloutOptions({ text });
  }

  getText(): string {
    return this._calloutOptions.text ?? '';
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._calloutOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override showsAxisTags(): boolean {
    return false;
  }

  isValid(): boolean {
    return this._anchors.length >= Callout.REQUIRED_ANCHORS;
  }

  /** Wraps and measures the text in CSS pixels. */
  private textBlock(): { lines: string[]; font: string; lineHeight: number; width: number } {
    const o = this._calloutOptions;
    const fontSize = o.fontSize ?? 14;
    const font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${fontSize}px ${TEXT_FONT_FAMILY}`;
    const ctx = measurer();
    const measure = (s: string) => (ctx ? ((ctx.font = font), ctx.measureText(s).width) : s.length * fontSize * 0.55);
    const wrapAt = o.wordWrap ? Math.max(20, o.wordWrapWidth ?? 200) : Infinity;
    const lines: string[] = [];
    for (const para of (o.text ?? '').split('\n')) {
      if (wrapAt === Infinity) {
        lines.push(para);
        continue;
      }
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
    const width = o.wordWrap ? wrapAt : Math.max(...lines.map(measure), 0);
    return { lines, font, lineHeight: fontSize, width };
  }

  layout(viewport: Viewport): CalloutLayout | null {
    if (!this.isValid()) return null;
    const tip = this.anchorToPixel(this._anchors[0], viewport);
    const centre = this.anchorToPixel(this._anchors[1], viewport);
    if (!tip || !centre) return null;

    const g = CALLOUT_GEOMETRY;
    const block = this.textBlock();
    const w = block.width + g.padX * 2;
    const h = block.lines.length * block.lineHeight + g.padY * 2;
    const box = { x: centre.x - w / 2, y: centre.y - h / 2, w, h };

    const dx = tip.x - centre.x;
    const dy = tip.y - centre.y;
    const outX = Math.abs(dx) > w / 2;
    const outY = Math.abs(dy) > h / 2;
    let tail: CalloutTail | null = null;
    if (outX && outY) tail = { kind: 'corner', corner: `${dy < 0 ? 't' : 'b'}${dx < 0 ? 'l' : 'r'}` as CalloutCorner, apex: tip };
    else if (outX) tail = { kind: 'edge', side: dx < 0 ? 'left' : 'right', apex: tip };
    else if (outY) tail = { kind: 'edge', side: dy < 0 ? 'top' : 'bottom', apex: tip };

    return { box, apex: tip, tail, lines: block.lines, font: block.font, lineHeight: block.lineHeight };
  }

  /** The two points where the tail joins the outline. */
  static tailBase(l: CalloutLayout): [Point, Point] | null {
    const t = l.tail;
    if (!t) return null;
    const { x, y, w, h } = l.box;
    const g = CALLOUT_GEOMETRY;
    const half = g.tailBase / 2;
    const cx = x + w / 2;
    const cy = y + h / 2;
    if (t.kind === 'edge') {
      switch (t.side) {
        case 'top':
          return [{ x: cx - half, y }, { x: cx + half, y }];
        case 'right':
          return [{ x: x + w, y: cy - half }, { x: x + w, y: cy + half }];
        case 'bottom':
          return [{ x: cx + half, y: y + h }, { x: cx - half, y: y + h }];
        default:
          return [{ x, y: cy + half }, { x, y: cy - half }];
      }
    }
    const r = g.radius;
    switch (t.corner) {
      case 'tl':
        return [{ x, y: y + r }, { x: x + r, y }];
      case 'tr':
        return [{ x: x + w - r, y }, { x: x + w, y: y + r }];
      case 'br':
        return [{ x: x + w, y: y + h - r }, { x: x + w - r, y: y + h }];
      default:
        return [{ x: x + r, y: y + h }, { x, y: y + h - r }];
    }
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const tip = this.isValid() ? this.anchorToPixel(this._anchors[0], viewport) : null;
    return tip ? [{ index: 0, x: tip.x, y: tip.y, radius: 7 }] : [];
  }

  /** Dragging the box moves only the box; the tail tip stays on its price. */
  override bodyDragOrigin(viewport: Viewport): Point[] | null {
    const p = this.isValid() ? this.anchorToPixel(this._anchors[1], viewport) : null;
    return p ? [p] : null;
  }

  override bodyDragAnchors(origin: Point[], dx: number, dy: number, viewport: Viewport): Anchor[] | null {
    const time = viewport.timeScale.coordinateToTime(origin[0].x + dx);
    const price = viewport.priceScale.coordinateToPrice(origin[0].y + dy);
    if (time === null || price === null) return null;
    return [{ ...this._anchors[0] }, { time, price }];
  }

  paneViews(): IPrimitivePaneView[] {
    return [new CalloutPaneView(this)];
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
    const base = Callout.tailBase(l);
    if (!base) return false;
    return inTriangle(point, l.apex, base[0], base[1], 3);
  }

  override toJSON() {
    const { visible, locked } = this._options;
    return { ...super.toJSON(), options: { ...this._calloutOptions, visible, locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._calloutOptions = { ...this._calloutOptions, ...data.options };
  }

  clone(newId: string): IDrawing {
    return new Callout(newId, [...this._anchors], { ...this._style }, { ...this._calloutOptions });
  }

  static create(id: string, target: Anchor, boxCentre: Anchor, text: string, style?: Partial<DrawingStyle>, options?: Partial<CalloutOptions>): Callout {
    return new Callout(id, [target, boxCentre], style, { ...options, text });
  }
}

/** True when p lies within `slop` pixels of the triangle abc. */
function inTriangle(p: Point, a: Point, b: Point, c: Point, slop: number): boolean {
  const sign = (p1: Point, p2: Point, p3: Point) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  if (!(neg && pos)) return true;
  const segDist = (s: Point, e: Point) => {
    const vx = e.x - s.x;
    const vy = e.y - s.y;
    const t = Math.max(0, Math.min(1, ((p.x - s.x) * vx + (p.y - s.y) * vy) / (vx * vx + vy * vy || 1)));
    return Math.hypot(p.x - (s.x + t * vx), p.y - (s.y + t * vy));
  };
  return Math.min(segDist(a, b), segDist(b, c), segDist(c, a)) <= slop;
}
