import type { Anchor, ControlPoint, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { CycleDrawing, type CycleOptions } from './cycle-drawing';
import { PATTERN_HIT_THRESHOLD } from './pattern-utils';

export type TimeCyclesOptions = CycleOptions;

export const TIME_CYCLES_COLOR = '#159980';
export const TIME_CYCLES_FILL = 'rgba(106, 168, 79, 0.5)';

/** Both anchors share one price: the second only sets the period. */
function levelled(anchors: Anchor[]): Anchor[] {
  return anchors.length >= 2 ? [anchors[0], { ...anchors[1], price: anchors[0].price }, ...anchors.slice(2)] : anchors;
}

export class TimeCycles extends CycleDrawing {
  readonly type = 'time-cycles';

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<TimeCyclesOptions> = {}) {
    super(id, levelled(anchors), style, options, { lineColor: TIME_CYCLES_COLOR, fillColor: TIME_CYCLES_FILL });
  }

  override setAnchors(anchors: Anchor[]): void {
    super.setAnchors(levelled(anchors));
  }

  override updateAnchor(index: number, anchor: Anchor): void {
    super.updateAnchor(index, anchor);
    if (this._anchors.length >= 2) this._anchors[1] = { ...this._anchors[1], price: this._anchors[0].price };
  }

  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const points = super.getControlPoints(viewport);
    return points.map((p) => ({ ...p, y: points[0].y }));
  }

  /** Semicircles standing on the baseline, one per period, repeating in both directions. */
  getArcs(viewport: Viewport): { cx: number; radius: number; y: number }[] {
    const pixels = this.anchorPixels(viewport);
    if (!pixels) return [];
    const [a, b] = pixels;
    const period = Math.abs(b.x - a.x);
    if (period < 2) return [];

    const first = Math.floor((-period - a.x) / period);
    const last = Math.ceil((viewport.width + period - a.x) / period);
    const arcs: { cx: number; radius: number; y: number }[] = [];
    for (let k = first; k <= last && arcs.length < 2000; k++) arcs.push({ cx: a.x + (k + 0.5) * period, radius: period / 2, y: a.y });
    return arcs;
  }

  paint(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    const arcs = this.getArcs(viewport);
    if (this._patternOptions.fillBackground !== false) {
      ctx.save();
      ctx.fillStyle = this._style.fillColor ?? TIME_CYCLES_FILL;
      ctx.beginPath();
      for (const arc of arcs) {
        ctx.moveTo(arc.cx - arc.radius, arc.y);
        ctx.arc(arc.cx, arc.y, arc.radius, Math.PI, 0);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    for (const arc of arcs) {
      ctx.moveTo(arc.cx - arc.radius, arc.y);
      ctx.arc(arc.cx, arc.y, arc.radius, Math.PI, 0);
    }
    ctx.stroke();
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    return this.getArcs(viewport).some((arc) => {
      if (point.y > arc.y + PATTERN_HIT_THRESHOLD || Math.abs(point.x - arc.cx) > arc.radius + PATTERN_HIT_THRESHOLD) return false;
      return Math.abs(Math.hypot(point.x - arc.cx, point.y - arc.y) - arc.radius) <= PATTERN_HIT_THRESHOLD;
    });
  }

  override clone(newId: string): IDrawing {
    return new TimeCycles(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<TimeCyclesOptions>): TimeCycles {
    return new TimeCycles(id, anchors, style, options);
  }
}
