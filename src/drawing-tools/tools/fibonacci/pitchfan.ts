import type { Anchor, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { defaultPitchforkLevels, Pitchfork, type PitchforkLayout, type PitchforkLevelRay, type PitchforkOptions, type PitchforkRay } from '../pitchforks/pitchfork';

/** Pitchfan levels (re-exported for public API compatibility). */
export { PITCHFAN_LEVELS } from './constants';

export type PitchfanOptions = PitchforkOptions;

/** Same levels as the pitchforks, except that the 0.5 line is cyan. */
export const defaultPitchfanLevels = () =>
  defaultPitchforkLevels().map((l) => (l.value === 0.5 ? { ...l, color: '#00bcd4' } : l));

const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

function unit(from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return len < 1e-9 ? null : { x: dx / len, y: dy / len };
}

/**
 * Pitchfan: three points A, B, C. Every line is a ray from A. The median goes through the middle of
 * B–C and each level `v` through `mid + v × (B − mid)` (and its mirror image), so level 1 passes
 * exactly through B and C. It reuses the Pitchfork options, levels and dialog.
 */
export class Pitchfan extends Pitchfork {
  override readonly type: string = 'pitchfan';

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<PitchfanOptions> = {}
  ) {
    super(id, anchors, style, { ...options, levels: options.levels ?? defaultPitchfanLevels() }, 'original');
  }

  override layout(viewport: Viewport): PitchforkLayout | null {
    const base = super.layout(viewport);
    if (!base || base.partial) return base;

    const { a, b, c } = base;
    const bc = mid(b, c);
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const forward = 3 * (viewport.width + viewport.height) + 2 * Math.hypot(a.x - center.x, a.y - center.y);
    const ray = (to: Point): PitchforkRay | null => {
      const dir = unit(a, to);
      return dir ? { start: a, dir, back: 0, forward } : null;
    };

    const median = ray(bc);
    const half = { x: b.x - bc.x, y: b.y - bc.y };
    const levels: PitchforkLevelRay[] = [];
    for (const level of this.pitchforkOptions.levels ?? []) {
      if (!level.enabled) continue;
      for (const sign of [-1, 1]) {
        const signed = sign * level.value;
        const r = ray({ x: bc.x + half.x * signed, y: bc.y + half.y * signed });
        if (r) levels.push({ ...r, level, signed });
      }
    }
    levels.sort((p, q) => p.signed - q.signed);
    return { a, b, c, segments: [[b, c]], median, levels, partial: false, fan: true };
  }

  override clone(newId: string): IDrawing {
    return new Pitchfan(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._pitchforkOptions });
  }
}
