import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { GlyphDrawing } from './glyph-drawing';

const FONT_STACK = '"Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const PROBE_PX = 100;
const BLUE = '#2962FF';

interface Fit {
  cx: number;
  cy: number;
  extent: number;
}

const fits = new Map<string, Fit>();

/** Where a glyph's ink sits in a 100px probe, so any character can be fitted to the size box. */
function fitOf(ctx: CanvasRenderingContext2D, glyph: string): Fit {
  let fit = fits.get(glyph);
  if (!fit) {
    ctx.save();
    ctx.font = `${PROBE_PX}px ${FONT_STACK}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(glyph);
    const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    fit = {
      cx: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
      cy: (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2,
      extent: Math.max(w, h, 1),
    };
    ctx.restore();
    fits.set(glyph, fit);
  }
  return fit;
}

export class GlyphPaneView implements IPrimitivePaneView {
  private readonly _renderer: GlyphPaneRenderer;

  constructor(drawing: GlyphDrawing) {
    this._renderer = new GlyphPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class GlyphPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _d: GlyphDrawing) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._d;
    const viewport = d.getViewport();
    if (!viewport || !d.isValid() || !d.options.visible || !d.isDisplayed()) return;
    const c = d.center(viewport);
    if (!c) return;

    const size = d.size * pr;
    const turn = d.angle - Math.PI / 2;
    const state = d.state;
    const showHandles = state === 'selected' || state === 'editing';

    ctx.save();
    ctx.translate(c.x * pr, c.y * pr);
    ctx.rotate(turn);

    const picture = d.image();
    if (picture) {
      ctx.drawImage(picture, -size / 2, -size / 2, size, size);
    } else if (d.glyph()) {
      const fit = fitOf(ctx, d.glyph());
      const k = (size * d.fill()) / fit.extent;
      ctx.font = `${PROBE_PX * k}px ${FONT_STACK}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const tint = d.tint();
      if (tint) ctx.fillStyle = tint;
      ctx.fillText(d.glyph(), -fit.cx * k, -fit.cy * k);
    }

    if (showHandles) {
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = pr;
      ctx.strokeRect(-size / 2 + pr / 2, -size / 2 + pr / 2, size - pr, size - pr);
    }
    ctx.restore();

    if (!showHandles) return;
    for (const cp of d.getControlPoints(viewport)) {
      const round = cp.index === 0 || cp.index === 1;
      this.drawHandle(ctx, cp.x * pr, cp.y * pr, pr, round, turn);
    }
  }

  private drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, pr: number, round: boolean, turn: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(turn);
    ctx.beginPath();
    if (round) ctx.arc(0, 0, 5 * pr, 0, Math.PI * 2);
    else ctx.roundRect(-5 * pr, -5 * pr, 10 * pr, 10 * pr, 3 * pr);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5 * pr;
    ctx.strokeStyle = BLUE;
    ctx.stroke();
    ctx.restore();
  }
}
