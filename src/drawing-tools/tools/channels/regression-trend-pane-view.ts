import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';
import { defaultFontFamily } from '../../../helpers/make-font';
import type { IPrimitivePaneView, IPrimitivePaneRenderer } from '../../../model/ipane-primitive';

import type { Point } from '../../core/types';
import type { RegressionTrend } from './regression-trend';
import { drawLine } from '../../rendering/canvas-utils';

const HANDLE_STROKE = '#2962FF';
const LABEL_FONT = `14px ${defaultFontFamily}`;

/** '#rrggbb', '#rrggbbaa' or 'rgb(a)(...)' to its opaque RGB triplet. */
function rgbOf(color: string): [number, number, number] {
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.length === 4 ? c.slice(1).replace(/./g, '$&$&') : c.slice(1, 7);
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/[\d.]+/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [41, 98, 255];
}

export class RegressionTrendPaneView implements IPrimitivePaneView {
  private _renderer: RegressionTrendPaneRenderer;

  constructor(drawing: RegressionTrend) {
    this._renderer = new RegressionTrendPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class RegressionTrendPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: RegressionTrend) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const d = this._drawing;
    const viewport = d.getViewport();
    if (!viewport || !d.options.visible || !d.isDisplayed()) return;
    const px = d.pixels(viewport);
    if (!px) return;
    const o = d.regressionOptions;

    if (d.placedCount !== null) {
      ctx.save();
      ctx.lineWidth = pr;
      ctx.strokeStyle = '#363A45';
      for (const p of px.base) {
        ctx.beginPath();
        ctx.moveTo(Math.round(p.x * pr) + 0.5, 0);
        ctx.lineTo(Math.round(p.x * pr) + 0.5, viewport.height * pr);
        ctx.stroke();
      }
      ctx.strokeStyle = '#787B86';
      drawLine(ctx, px.base[0], px.base[1], pr);
      ctx.restore();
      this.drawHandles(ctx, pr, d.getControlPoints(viewport), []);
      return;
    }

    const ordered = (s: [Point, Point]): [Point, Point] => {
      const e = d.extendRight(s, viewport);
      return e[0].x <= e[1].x ? e : [e[1], e[0]];
    };
    const base = ordered(px.base);
    const upper = ordered(px.upper);
    const lower = ordered(px.lower);
    const alpha = 1 - (o.transparency ?? 70) / 100;
    const rgba = (color: string, a: number) => {
      const [r, g, b] = rgbOf(color);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };
    const opaque = (color: string) => rgba(color, 1);

    ctx.save();
    const fill = (a: [Point, Point], b: [Point, Point], color: string) => {
      ctx.fillStyle = rgba(color, alpha);
      ctx.beginPath();
      ctx.moveTo(a[0].x * pr, a[0].y * pr);
      ctx.lineTo(a[1].x * pr, a[1].y * pr);
      ctx.lineTo(b[1].x * pr, b[1].y * pr);
      ctx.lineTo(b[0].x * pr, b[0].y * pr);
      ctx.closePath();
      ctx.fill();
    };
    if (o.showUp) fill(upper, base, o.upColor ?? '#2962FF');
    if (o.showDown) fill(base, lower, o.baseColor ?? '#F23645');

    ctx.lineCap = 'butt';
    const stroke = (seg: [Point, Point], color: string, width: number, dash: number[] | undefined) => {
      ctx.strokeStyle = opaque(color);
      ctx.lineWidth = width * pr;
      ctx.setLineDash((dash ?? []).map((v) => v * pr));
      drawLine(ctx, seg[0], seg[1], pr);
    };
    if (o.showUp) stroke(upper, o.upColor ?? '#2962FF', o.upWidth ?? d.style.lineWidth, o.upDash);
    if (o.showDown) stroke(lower, o.downColor ?? '#2962FF', o.downWidth ?? d.style.lineWidth, o.downDash);
    if (o.showBase) stroke(base, o.baseColor ?? '#F23645', o.baseWidth ?? 1, o.baseDash);

    const fit = d.fit();
    if (o.showPearsons && fit) {
      ctx.setLineDash([]);
      ctx.font = LABEL_FONT.replace('14px', `${14 * pr}px`);
      ctx.fillStyle = opaque(o.downColor ?? '#2962FF');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const anchor = px.lower[0];
      ctx.fillText(String(fit.r), anchor.x * pr, (anchor.y + 14) * pr);
    }
    ctx.restore();

    if (d.state === 'selected' || d.state === 'editing') {
      const small = [px.upper[0], px.upper[1]];
      this.drawHandles(ctx, pr, d.getControlPoints(viewport), small);
    }
  }

  private drawHandles(ctx: CanvasRenderingContext2D, pr: number, big: Array<{ x: number; y: number }>, small: Point[]): void {
    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = HANDLE_STROKE;
    for (const [list, radius, width] of [[small, 3.25, 1.5], [big, 4.7, 2]] as const) {
      ctx.lineWidth = width * pr;
      for (const c of list) {
        ctx.beginPath();
        ctx.arc(c.x * pr, c.y * pr, radius * pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
