import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { CycleDrawing, type CycleOptions } from './cycle-drawing';
import { PATTERN_HIT_THRESHOLD } from './pattern-utils';

export type CyclicLinesOptions = CycleOptions;

export const CYCLIC_LINES_COLOR = '#80ccdb';

export class CyclicLines extends CycleDrawing {
  readonly type = 'cyclic-lines';

  constructor(id: string, anchors: Anchor[] = [], style: Partial<DrawingStyle> = {}, options: Partial<CyclicLinesOptions> = {}) {
    super(id, anchors, style, options, { lineColor: CYCLIC_LINES_COLOR });
  }

  /** Vertical lines start at the first anchor and repeat toward (and past) the second one. */
  getLineCoordinates(viewport: Viewport): number[] {
    const pixels = this.anchorPixels(viewport);
    if (!pixels) return [];
    const [a, b] = pixels;
    const period = b.x - a.x;
    if (Math.abs(period) < 1) return [a.x];

    const xs: number[] = [];
    for (let x = a.x; x >= -1 && x <= viewport.width + 1 && xs.length < 2000; x += period) xs.push(x);
    return xs;
  }

  paint(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    ctx.beginPath();
    for (const x of this.getLineCoordinates(viewport)) {
      const px = Math.round(x - 0.5) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, viewport.height);
    }
    ctx.stroke();
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    return this.getLineCoordinates(viewport).some((x) => Math.abs(point.x - x) <= PATTERN_HIT_THRESHOLD);
  }

  override clone(newId: string): IDrawing {
    return new CyclicLines(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<CyclicLinesOptions>): CyclicLines {
    return new CyclicLines(id, anchors, style, options);
  }
}
