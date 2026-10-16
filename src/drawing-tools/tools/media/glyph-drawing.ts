import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Geometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { GlyphPaneView } from './glyph-pane-view';

export interface GlyphOptions extends DrawingOptions {
  size?: number;
  /** Direction of the lower handle, in radians; π/2 is upright. */
  angle?: number;
  visibility?: VisibilityMap;
}

export const GLYPH_DEFAULT_SIZE = 40;
export const GLYPH_UPRIGHT = Math.PI / 2;
export const GLYPH_MIN_SIZE = 18;
const HANDLE_MIN_REACH = 40;
const HANDLE_GRAB = 8;

/** Handle indices: lower and upper turn the glyph, left and right resize it. */
export const GLYPH_HANDLE = { bottom: 0, top: 1, left: 2, right: 3 } as const;

/** Sizes step through the odd multiples of six. */
export function quantizeGlyphSize(raw: number): number {
  return Math.max(GLYPH_MIN_SIZE, Math.round((raw - 6) / 12) * 12 + 6);
}

const TAU = Math.PI * 2;
const normalizeAngle = (a: number) => ((a % TAU) + TAU) % TAU;

/** One-point drawing that shows a glyph centred on its anchor, with turn and resize handles. */
export abstract class GlyphDrawing extends Drawing {
  protected _glyphOptions: GlyphOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[], style: Partial<DrawingStyle>, options: Partial<GlyphOptions>) {
    const { size, angle, visibility, ...base } = options;
    super(id, anchors, style, base);
    this._glyphOptions = {
      ...this._options,
      size: size ?? GLYPH_DEFAULT_SIZE,
      angle: angle ?? GLYPH_UPRIGHT,
      visibility,
    };
  }

  /** Fraction of the size box that the glyph's longest side fills. */
  abstract fill(): number;
  /** The text drawn for this glyph. */
  abstract glyph(): string;
  /** Fill colour, or null for glyphs that bring their own colours. */
  abstract tint(): string | null;
  /** A picture drawn in place of the text, when the glyph is an image. */
  image(): CanvasImageSource | null {
    return null;
  }

  get glyphOptions(): GlyphOptions {
    return this._glyphOptions;
  }

  get size(): number {
    return this._glyphOptions.size ?? GLYPH_DEFAULT_SIZE;
  }

  get angle(): number {
    return this._glyphOptions.angle ?? GLYPH_UPRIGHT;
  }

  setGlyphOptions(options: Partial<GlyphOptions>): void {
    this._glyphOptions = { ...this._glyphOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  override updateOptions(options: Partial<GlyphOptions>): void {
    this.setGlyphOptions(options);
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._glyphOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  isValid(): boolean {
    return this._anchors.length >= 1;
  }

  center(viewport: Viewport): Point | null {
    return this.isValid() ? this.anchorToPixel(this._anchors[0], viewport) : null;
  }

  private reach(): number {
    return Math.max(this.size / 2, HANDLE_MIN_REACH);
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const c = this.center(viewport);
    if (!c) return [];
    const r = this.reach();
    const a = this.angle;
    const at = (index: number, theta: number): ControlPoint => ({
      index,
      x: c.x + r * Math.cos(theta),
      y: c.y + r * Math.sin(theta),
      radius: 6,
    });
    return [
      at(GLYPH_HANDLE.bottom, a),
      at(GLYPH_HANDLE.top, a + Math.PI),
      at(GLYPH_HANDLE.left, a + Math.PI / 2),
      at(GLYPH_HANDLE.right, a - Math.PI / 2),
    ];
  }

  override hitTestAnchor(point: Point, viewport: Viewport): number | null {
    for (const cp of this.getControlPoints(viewport)) {
      if (Math.hypot(point.x - cp.x, point.y - cp.y) <= HANDLE_GRAB) return cp.index;
    }
    return null;
  }

  override dragControlPoint(index: number, point: Point, _anchor: Anchor | null, viewport: Viewport): void {
    const c = this.center(viewport);
    if (!c) return;
    const dx = point.x - c.x;
    const dy = point.y - c.y;
    if (index === GLYPH_HANDLE.bottom) {
      this._glyphOptions = { ...this._glyphOptions, angle: normalizeAngle(Math.atan2(dy, dx)) };
    } else if (index === GLYPH_HANDLE.top) {
      this._glyphOptions = { ...this._glyphOptions, angle: normalizeAngle(Math.atan2(-dy, -dx)) };
    } else {
      this._glyphOptions = { ...this._glyphOptions, size: quantizeGlyphSize(2 * Math.hypot(dx, dy)) };
    }
    this.requestUpdate();
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const c = this.center(viewport);
    if (!c) return false;
    const turn = this.angle - GLYPH_UPRIGHT;
    const dx = point.x - c.x;
    const dy = point.y - c.y;
    const lx = dx * Math.cos(turn) + dy * Math.sin(turn);
    const ly = -dx * Math.sin(turn) + dy * Math.cos(turn);
    const half = this.size / 2 + 2;
    return Math.abs(lx) <= half && Math.abs(ly) <= half;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new GlyphPaneView(this)];
  }

  override computeGeometry(_viewport: Viewport): Geometry[] {
    return [];
  }

  override toJSON(): SerializedDrawing {
    return { ...super.toJSON(), options: { ...this._glyphOptions, visible: this._options.visible, locked: this._options.locked } };
  }

  override fromJSON(data: SerializedDrawing): void {
    super.fromJSON(data);
    this._glyphOptions = { ...this._glyphOptions, ...data.options };
  }
}
