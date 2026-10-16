import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { drawControlPoints } from '../../rendering/canvas-utils';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PatternDrawing } from '../patterns/pattern-base';

export interface ProjectionOptions extends DrawingOptions {
  visibility?: VisibilityMap;
  /** Fill colour next to the centre point. */
  color1: string;
  /** Fill colour at the arc. */
  color2: string;
}

export const PROJECTION_LINE = '#9598A1';

const DEFAULT_OPTIONS: ProjectionOptions = {
  color1: 'rgba(41, 98, 255, 0.2)',
  color2: 'rgba(156, 39, 176, 0.2)',
};

const HIT = 5;
/** The fill gradient starts this far left of the centre and ends just past the arc. */
const GRADIENT_LEAD = 50;
const GRADIENT_TAIL = 10;

interface Sector {
  c: Point;
  p2: Point;
  /** Third point pulled onto the circle through the second. */
  p3: Point;
  r: number;
  a2: number;
  a3: number;
  anticlockwise: boolean;
  /** Signed sweep from the second to the third point, in (-PI, PI]. */
  delta: number;
}

function wrapAngle(a: number): number {
  let v = a;
  while (v > Math.PI) v -= 2 * Math.PI;
  while (v <= -Math.PI) v += 2 * Math.PI;
  return v;
}

/** A pie slice: the second point sets the radius, the third only sets where the arc stops. */
export class Projection extends PatternDrawing<ProjectionOptions> {
  readonly type = 'projection';
  protected _patternOptions: ProjectionOptions;

  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<ProjectionOptions> = {}) {
    super(id, anchors, { lineColor: PROJECTION_LINE, lineWidth: 1, ...style }, {
      ...(options.visible !== undefined ? { visible: options.visible } : {}),
      ...(options.locked !== undefined ? { locked: options.locked } : {}),
    });
    this._patternOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  get projectionOptions(): ProjectionOptions {
    return this._patternOptions;
  }

  setProjectionOptions(options: Partial<ProjectionOptions>): void {
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
    return this._anchors.length >= 3;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new ProjectionPaneView(this)];
  }

  override computeGeometry(): never[] {
    return [];
  }

  override autoscaleInfo(): null {
    return null;
  }

  sector(viewport: Viewport): Sector | null {
    if (this._anchors.length < 3) return null;
    const c = this.anchorToPixel(this._anchors[0], viewport);
    const p2 = this.anchorToPixel(this._anchors[1], viewport);
    const q = this.anchorToPixel(this._anchors[2], viewport);
    if (!c || !p2 || !q) return null;
    const r = Math.hypot(p2.x - c.x, p2.y - c.y);
    const a2 = Math.atan2(p2.y - c.y, p2.x - c.x);
    const a3 = Math.atan2(q.y - c.y, q.x - c.x);
    const delta = wrapAngle(a3 - a2);
    return { c, p2, p3: { x: c.x + r * Math.cos(a3), y: c.y + r * Math.sin(a3) }, r, a2, a3, anticlockwise: delta < 0, delta };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const s = this.sector(viewport);
    if (!s) return [];
    const placed = this._placedCount ?? 3;
    const pts = [s.c, s.p2, s.p3];
    return pts.slice(0, Math.min(placed, 3)).map((p, index) => ({ index, x: p.x, y: p.y, radius: 6 }));
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const s = this.sector(viewport);
    if (!s) return false;
    const dx = point.x - s.c.x;
    const dy = point.y - s.c.y;
    if (Math.hypot(dx, dy) > s.r + HIT) return false;
    const d = wrapAngle(Math.atan2(dy, dx) - s.a2);
    return s.anticlockwise ? d <= 1e-9 && d >= s.delta - 1e-9 : d >= -1e-9 && d <= s.delta + 1e-9;
  }

  override clone(newId: string): IDrawing {
    return new Projection(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<ProjectionOptions>): Projection {
    return new Projection(id, anchors, style, options);
  }

  paint(scope: BitmapCoordinatesRenderingScope, viewport: Viewport): void {
    const { context: ctx, horizontalPixelRatio: pr, verticalPixelRatio: vr } = scope;
    const s = this.sector(viewport);
    if (!s) return;
    ctx.save();
    ctx.scale(pr, vr);
    ctx.strokeStyle = this._style.lineColor;
    ctx.lineWidth = this._style.lineWidth;
    ctx.lineJoin = 'round';

    // Until the second point is placed only a guide line follows the cursor.
    if (this.placedCount !== null && this.placedCount < 2) {
      ctx.beginPath();
      ctx.moveTo(s.c.x, s.c.y);
      ctx.lineTo(s.p2.x, s.p2.y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(s.c.x, s.c.y);
    ctx.lineTo(s.p2.x, s.p2.y);
    ctx.arc(s.c.x, s.c.y, s.r, s.a2, s.a3, s.anticlockwise);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(s.c.x - GRADIENT_LEAD, 0, s.c.x + s.r + GRADIENT_TAIL, 0);
    gradient.addColorStop(0, this._patternOptions.color1);
    gradient.addColorStop(1, this._patternOptions.color2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

class ProjectionPaneView implements IPrimitivePaneView {
  private readonly _renderer: ProjectionPaneRenderer;

  constructor(drawing: Projection) {
    this._renderer = new ProjectionPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class ProjectionPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: Projection) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const drawing = this._drawing;
      const viewport = drawing.getViewport();
      if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;
      drawing.paint(scope, viewport);
      if (drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered') {
        drawControlPoints(scope.context, drawing.getControlPoints(viewport), null, scope.horizontalPixelRatio, '#2962FF');
      }
    });
  }
}
