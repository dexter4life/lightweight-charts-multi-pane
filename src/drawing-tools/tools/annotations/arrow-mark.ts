import { defaultFontFamily } from '../../../helpers/make-font';
import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { ArrowMarkPaneView } from './arrow-mark-pane-view';

export type ArrowMarkDirection = 'up' | 'down' | 'left' | 'right';

export const ARROW_MARK_FONT = defaultFontFamily;

export interface ArrowMarkOptions extends DrawingOptions {
  arrowColor?: string;
  showText?: boolean;
  text?: string;
  textColor?: string;
  textSize?: number;
  textBold?: boolean;
  textItalic?: boolean;
  visibility?: VisibilityMap;
}

/** Dimensions in css px; the tip sits on the anchor and the body extends away from it. */
export const ARROW_MARK_GEOMETRY = {
  headLength: 12,
  headHalf: 9,
  shaftLength: 10,
  shaftHalf: 5,
  /** Gap between the arrow and its label. */
  textGap: 5,
} as const;

export const ARROW_MARK_DEFAULT_COLORS: Record<ArrowMarkDirection, string> = {
  up: '#089981',
  down: '#CC2F3C',
  left: '#2962FF',
  right: '#2962FF',
};

export interface ArrowMarkLayout {
  anchor: Point;
  polygon: Point[];
  /** Unit vector from the tip towards the tail. */
  tail: Point;
}

/** A single-point arrow whose tip marks a bar, pointing up, down, left or right. */
export abstract class ArrowMark extends Drawing {
  abstract readonly direction: ArrowMarkDirection;

  protected static readonly REQUIRED_ANCHORS = 1;

  private _markOptions: ArrowMarkOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[], style: Partial<DrawingStyle>, options: Partial<ArrowMarkOptions>, defaultColor: string) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: defaultColor, lineWidth: 1, ...style }, base);

    const arrowColor = options.arrowColor ?? defaultColor;
    this._markOptions = {
      ...this._options,
      arrowColor,
      showText: options.showText ?? true,
      text: options.text ?? '',
      textColor: options.textColor ?? arrowColor,
      textSize: options.textSize ?? 14,
      textBold: options.textBold ?? false,
      textItalic: options.textItalic ?? false,
      visibility: options.visibility,
    };
  }

  get arrowMarkOptions(): ArrowMarkOptions {
    return this._markOptions;
  }

  setArrowMarkOptions(options: Partial<ArrowMarkOptions>): void {
    this._markOptions = { ...this._markOptions, ...options };
    if (options.arrowColor) this.updateStyle({ lineColor: options.arrowColor });
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
    const map = this._markOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  isValid(): boolean {
    return this._anchors.length >= ArrowMark.REQUIRED_ANCHORS;
  }

  /** Maps (distance from the tip, offset across the arrow) to pixels. */
  private place(anchor: Point, u: number, v: number): Point {
    switch (this.direction) {
      case 'up':
        return { x: anchor.x + v, y: anchor.y + u };
      case 'down':
        return { x: anchor.x + v, y: anchor.y - u };
      case 'left':
        return { x: anchor.x + u, y: anchor.y + v };
      default:
        return { x: anchor.x - u, y: anchor.y + v };
    }
  }

  layout(viewport: Viewport): ArrowMarkLayout | null {
    if (!this.isValid()) return null;
    const anchor = this.anchorToPixel(this._anchors[0], viewport);
    if (!anchor) return null;
    const g = ARROW_MARK_GEOMETRY;
    const total = g.headLength + g.shaftLength;
    const at = (u: number, v: number) => this.place(anchor, u, v);
    const polygon = [at(0, 0), at(g.headLength, g.headHalf), at(g.headLength, g.shaftHalf), at(total, g.shaftHalf), at(total, -g.shaftHalf), at(g.headLength, -g.shaftHalf), at(g.headLength, -g.headHalf)];
    const tailPoint = at(1, 0);
    return { anchor, polygon, tail: { x: tailPoint.x - anchor.x, y: tailPoint.y - anchor.y } };
  }

  paneViews(): IPrimitivePaneView[] {
    return [new ArrowMarkPaneView(this)];
  }

  computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;
    const l = this.layout(viewport);
    if (!l) return false;
    const pad = 3;
    const xs = l.polygon.map((p) => p.x);
    const ys = l.polygon.map((p) => p.y);
    return point.x >= Math.min(...xs) - pad && point.x <= Math.max(...xs) + pad && point.y >= Math.min(...ys) - pad && point.y <= Math.max(...ys) + pad;
  }

  override toJSON() {
    const { visible, locked } = this._options;
    return { ...super.toJSON(), options: { ...this._markOptions, visible, locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this._markOptions = { ...this._markOptions, ...data.options };
  }
}

export class ArrowMarkUp extends ArrowMark {
  readonly type = 'arrow-mark-up';
  readonly direction = 'up';
  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ArrowMarkOptions> = {}) {
    super(id, anchors, style, options, ARROW_MARK_DEFAULT_COLORS.up);
  }
  clone(newId: string): IDrawing {
    return new ArrowMarkUp(newId, [...this._anchors], { ...this._style }, { ...this.arrowMarkOptions });
  }
}

export class ArrowMarkDown extends ArrowMark {
  readonly type = 'arrow-mark-down';
  readonly direction = 'down';
  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ArrowMarkOptions> = {}) {
    super(id, anchors, style, options, ARROW_MARK_DEFAULT_COLORS.down);
  }
  clone(newId: string): IDrawing {
    return new ArrowMarkDown(newId, [...this._anchors], { ...this._style }, { ...this.arrowMarkOptions });
  }
}

export class ArrowMarkLeft extends ArrowMark {
  readonly type = 'arrow-mark-left';
  readonly direction = 'left';
  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ArrowMarkOptions> = {}) {
    super(id, anchors, style, options, ARROW_MARK_DEFAULT_COLORS.left);
  }
  clone(newId: string): IDrawing {
    return new ArrowMarkLeft(newId, [...this._anchors], { ...this._style }, { ...this.arrowMarkOptions });
  }
}

export class ArrowMarkRight extends ArrowMark {
  readonly type = 'arrow-mark-right';
  readonly direction = 'right';
  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ArrowMarkOptions> = {}) {
    super(id, anchors, style, options, ARROW_MARK_DEFAULT_COLORS.right);
  }
  clone(newId: string): IDrawing {
    return new ArrowMarkRight(newId, [...this._anchors], { ...this._style }, { ...this.arrowMarkOptions });
  }
}
