import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { CycleDrawing, type CycleOptions } from './cycle-drawing';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline } from './pattern-utils';

export type SineLineOptions = CycleOptions;

export const SINE_LINE_COLOR = '#159980';

export class SineLine extends CycleDrawing {
  readonly type = 'sine-line';

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<SineLineOptions> = {}) {
    super(id, anchors, style, options, { lineColor: SINE_LINE_COLOR });
  }

  /** The first anchor is a trough (or crest) and the second the next crest (or trough): half a period apart. */
  getWavePoints(viewport: Viewport, step = 2): Point[] {
    const pixels = this.anchorPixels(viewport);
    if (!pixels) return [];
    const [a, b] = pixels;
    const half = b.x - a.x;
    if (Math.abs(half) < 1) return [];

    const mid = (a.y + b.y) / 2;
    const amp = (a.y - b.y) / 2;
    const points: Point[] = [];
    for (let x = -step; x <= viewport.width + step; x += step) {
      points.push({ x, y: mid + amp * Math.cos((Math.PI * (x - a.x)) / half) });
    }
    return points;
  }

  paint(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    const points = this.getWavePoints(viewport);
    if (points.length < 2) return;
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    return distanceToPolyline(point, this.getWavePoints(viewport, 3)) <= PATTERN_HIT_THRESHOLD;
  }

  override clone(newId: string): IDrawing {
    return new SineLine(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<SineLineOptions>): SineLine {
    return new SineLine(id, anchors, style, options);
  }
}
