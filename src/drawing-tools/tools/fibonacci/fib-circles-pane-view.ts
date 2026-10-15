import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { applyStyle, drawControlPoints, drawLine } from '../../rendering/canvas-utils';
import type { FibCircles, FibCircleRing } from './fib-circles';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const HANDLE_COLOR = '#2962FF';
const LABEL_GAP = 9;

export const formatFibCoeff = (value: number, percents: boolean): string =>
  percents ? `${+(value * 100).toFixed(1)}%` : String(+value.toFixed(3));

/** The fills tint the candles, as in the reference, so both layers draw above the series. */
export class FibCirclesPaneView implements IPrimitivePaneView {
  private _renderer: FibCirclesPaneRenderer;

  constructor(drawing: FibCircles, layer: 'body' | 'handles' = 'body') {
    this._renderer = new FibCirclesPaneRenderer(drawing, layer);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FibCirclesPaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: FibCircles,
    private readonly _layer: 'body' | 'handles'
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isDisplayed()) return;
    const layout = drawing.layout(viewport);
    if (!layout) return;

    const o = drawing.fibOptions;
    ctx.save();

    if (this._layer === 'handles') {
      const state = drawing.state;
      if (state === 'selected' || state === 'editing' || state === 'hovered') {
        drawControlPoints(ctx, drawing.getControlPoints(viewport), null, pr, HANDLE_COLOR);
      }
      ctx.restore();
      return;
    }

    const { center, rings } = layout;
    // Arcs and the wedge keep only a part of each circle.
    const arc = layout.arc;
    const path = (r: FibCircleRing | null, reverse = false) => {
      const rx = (r ? r.rx : 0) * pr;
      const ry = (r ? r.ry : 0) * pr;
      if (arc) {
        ctx.ellipse(center.x * pr, center.y * pr, rx, ry, 0, reverse ? arc.to : arc.from, reverse ? arc.from : arc.to, reverse);
      } else {
        ctx.moveTo(center.x * pr + rx, center.y * pr);
        ctx.ellipse(center.x * pr, center.y * pr, rx, ry, 0, 0, Math.PI * 2, reverse);
      }
    };

    // Each band takes the colour of its outer level; the innermost one is the disc inside the first level.
    if (o.backgroundVisible) {
      ctx.globalAlpha = o.backgroundOpacity ?? 0.2;
      rings.forEach((ring, i) => {
        ctx.fillStyle = ring.level.color;
        ctx.beginPath();
        path(ring);
        if (arc) path(i > 0 ? rings[i - 1] : null, true);
        else if (i > 0) path(rings[i - 1], true);
        ctx.closePath();
        ctx.fill('evenodd');
      });
      ctx.globalAlpha = 1;
    }

    ctx.lineCap = 'butt';
    for (const ring of rings) {
      ctx.strokeStyle = ring.level.color;
      ctx.lineWidth = Math.max(1, Math.round((ring.level.width ?? 1) * pr));
      ctx.beginPath();
      path(ring);
      ctx.stroke();
    }

    if (o.trendLineVisible !== false) {
      applyStyle(ctx, drawing.style, pr);
      for (const [p, q] of layout.edges ?? [[layout.a, layout.b]]) drawLine(ctx, p, q, pr);
    }

    if (o.showLabels !== false) {
      ctx.font = `${12 * pr}px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const ring of rings) {
        ctx.fillStyle = ring.level.color;
        const x = (ring.label ? ring.label.x : center.x) - LABEL_GAP;
        const y = ring.label ? ring.label.y : center.y + (layout.side ?? 1) * ring.ry;
        ctx.fillText(formatFibCoeff(ring.level.value, !!o.coeffsAsPercents), x * pr, y * pr);
      }
    }
    ctx.restore();
  }
}
