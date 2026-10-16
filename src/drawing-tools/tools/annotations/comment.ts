import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, ControlPoint, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { CommentPaneView } from './comment-pane-view';
import { TEXT_FONT_FAMILY } from './text-annotation';

export interface CommentOptions extends DrawingOptions {
  text?: string;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  visibility?: VisibilityMap;
}

export const COMMENT_GEOMETRY = {
  padX: 13.5,
  /** Corner radius at the anchor (bottom-left). */
  anchorRadius: 2.5,
  borderWidth: 1.5,
  handleRadius: 4.75,
} as const;

export interface CommentLayout {
  /** Bubble in pane pixels; its bottom-left corner is the anchor. */
  box: { x: number; y: number; w: number; h: number };
  anchor: Point;
  text: string;
  font: string;
  fontSize: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/** Comment - a single-line pill whose bottom-left corner sits on the anchor. */
export class Comment extends Drawing {
  readonly type = 'comment';

  protected static readonly REQUIRED_ANCHORS = 1;

  private _commentOptions: CommentOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<CommentOptions> = {}) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: '#2962FF', ...style }, base);

    this._commentOptions = {
      ...this._options,
      text: options.text ?? 'Comment',
      fontSize: options.fontSize ?? 16,
      textColor: options.textColor ?? '#FFFFFF',
      backgroundColor: options.backgroundColor ?? '#2962FF',
      borderColor: options.borderColor ?? '#2962FF',
      visibility: options.visibility,
    };
  }

  get commentOptions(): CommentOptions {
    return this._commentOptions;
  }

  setCommentOptions(options: Partial<CommentOptions>): void {
    this._commentOptions = { ...this._commentOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  setText(text: string): void {
    this.setCommentOptions({ text });
  }

  getText(): string {
    return this._commentOptions.text ?? '';
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._commentOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override showsAxisTags(): boolean {
    return false;
  }

  isValid(): boolean {
    return this._anchors.length >= Comment.REQUIRED_ANCHORS;
  }

  layout(viewport: Viewport): CommentLayout | null {
    if (!this.isValid()) return null;
    const p = this.anchorToPixel(this._anchors[0], viewport);
    if (!p) return null;
    const o = this._commentOptions;
    const fontSize = o.fontSize ?? 16;
    const font = `${fontSize}px ${TEXT_FONT_FAMILY}`;
    const text = (o.text ?? '').replace(/\s*\n\s*/g, ' ');
    const ctx = measurer();
    const tw = ctx ? ((ctx.font = font), ctx.measureText(text).width) : text.length * fontSize * 0.55;
    const w = tw + COMMENT_GEOMETRY.padX * 2;
    const h = fontSize * 2.43 + 3.2;
    return { box: { x: p.x, y: p.y - h, w, h }, anchor: p, text, font, fontSize };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const p = this.isValid() ? this.anchorToPixel(this._anchors[0], viewport) : null;
    return p ? [{ index: 0, x: p.x, y: p.y, radius: 7 }] : [];
  }

  paneViews(): IPrimitivePaneView[] {
    return [new CommentPaneView(this)];
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;
    const l = this.layout(viewport);
    if (!l) return false;
    const { x, y, w, h } = l.box;
    return point.x >= x - 2 && point.x <= x + w + 2 && point.y >= y - 2 && point.y <= y + h + 2;
  }

  override toJSON() {
    const { visible, locked } = this._options;
    return { ...super.toJSON(), options: { ...this._commentOptions, visible, locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._commentOptions = { ...this._commentOptions, ...data.options };
  }

  clone(newId: string): IDrawing {
    return new Comment(newId, [...this._anchors], { ...this._style }, { ...this._commentOptions });
  }

  static create(id: string, position: Anchor, text: string, style?: Partial<DrawingStyle>, options?: Partial<CommentOptions>): Comment {
    return new Comment(id, [position], style, { ...options, text });
  }
}
