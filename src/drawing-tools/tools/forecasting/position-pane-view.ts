import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { drawControlPoint } from '../../rendering/canvas-utils';
import { PATTERN_LABEL_FONT_FAMILY } from '../patterns/xabcd-pattern-pane-view';
import { CP_ENTRY, type PositionDrawing, type PositionStats } from './position-base';

const LABEL_HEIGHT = 20;
const CENTER_HEIGHT = 32;
const LABEL_GAP = 14;
const LABEL_PAD_X = 14.5;
const CENTER_PAD_X = 12;
const LABEL_RADIUS = 5;
const LINE_PITCH = 13;
const HANDLE_SIZE = 12;
const MINUS = '\u2212';

const LABEL_GREEN = 'rgb(8, 153, 129)';
const LABEL_RED = 'rgb(242, 54, 69)';

/** Label fill for a zone colour: the same hue, fully opaque. */
const labelColor = (color: string, fallback: string): string => {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color);
  return m ? `rgb(${+m[1]}, ${+m[2]}, ${+m[3]})` : fallback;
};

const trimQty = (qty: number): string => String(+qty.toFixed(3));

export class PositionPaneView implements IPrimitivePaneView {
  private readonly _renderer: PositionPaneRenderer;

  constructor(drawing: PositionDrawing) {
    this._renderer = new PositionPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class PositionPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: PositionDrawing) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;

    const stats = drawing.getStats();
    const entry = drawing.anchorToPixel(drawing.anchors[0], viewport);
    const rightPoint = drawing.anchorToPixel(drawing.anchors[1], viewport);
    if (!stats || !entry || !rightPoint) return;
    const yProfit = viewport.priceScale.priceToCoordinate(stats.profitPrice);
    const yStop = viewport.priceScale.priceToCoordinate(stats.stopPrice);
    if (yProfit === null || yStop === null) return;

    const { context: ctx, horizontalPixelRatio: pr, bitmapSize } = scope;
    const o = drawing.positionOptions;
    const { lineColor, lineWidth } = drawing.style;
    const left = Math.min(entry.x, rightPoint.x);
    const right = Math.max(entry.x, rightPoint.x);
    const bx = (x: number) => Math.round(x * pr);
    const by = (y: number) => Math.round(y * pr);

    const fillBox = (x0: number, x1: number, y0: number, y1: number, color: string) => {
      const top = Math.min(by(y0), by(y1));
      const bottom = Math.max(by(y0), by(y1));
      ctx.fillStyle = color;
      ctx.fillRect(bx(x0), top, bx(x1) - bx(x0), bottom - top);
    };

    ctx.save();
    if (o.fillBackground) {
      fillBox(left, right, entry.y, yProfit, o.profitBackground ?? '');
      fillBox(left, right, entry.y, yStop, o.stopBackground ?? '');
      // A closed trade shades the side that was hit a second time, up to the bar that closed it.
      if (stats.closed && stats.exit) {
        const exitX = viewport.timeScale.logicalToCoordinate(stats.exit.logical as never);
        if (exitX !== null) {
          const hitProfit = stats.pnl > 0;
          fillBox(entry.x, Math.min(exitX, right), entry.y, hitProfit ? yProfit : yStop, hitProfit ? (o.profitBackground ?? '') : (o.stopBackground ?? ''));
        }
      }
    }
    if (o.drawBorder) {
      ctx.strokeStyle = o.borderColor ?? lineColor;
      ctx.lineWidth = pr;
      for (const y of [yProfit, yStop]) {
        ctx.strokeRect(bx(left) + 0.5, Math.min(by(entry.y), by(y)) + 0.5, bx(right) - bx(left), Math.abs(by(y) - by(entry.y)));
      }
    }

    const lw = Math.max(1, Math.round(lineWidth * pr));
    ctx.fillStyle = lineColor;
    ctx.fillRect(bx(left), by(entry.y) - Math.floor(lw / 2), bx(right) - bx(left), lw);

    if (stats.exit) {
      const exitX = viewport.timeScale.logicalToCoordinate(stats.exit.logical as never);
      const exitY = viewport.priceScale.priceToCoordinate(stats.exit.price);
      if (exitX !== null && exitY !== null) {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lw;
        ctx.setLineDash([4 * pr, 4 * pr]);
        ctx.beginPath();
        ctx.moveTo(entry.x * pr, entry.y * pr);
        ctx.lineTo(exitX * pr, exitY * pr);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const active = drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered';
    const selected = drawing.state === 'selected' || drawing.state === 'editing';
    if (selected || o.alwaysShowStats) {
      this.drawLabels(scope, stats, { left, right, entryY: entry.y, yProfit, yStop, bounds: bitmapSize.width / pr });
    }
    if (active) this.drawHandles(scope, viewport);
    ctx.restore();
  }

  private drawLabels(
    scope: BitmapCoordinatesRenderingScope,
    stats: PositionStats,
    g: { left: number; right: number; entryY: number; yProfit: number; yStop: number; bounds: number }
  ): void {
    const drawing = this._drawing;
    const o = drawing.positionOptions;
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const size = o.fontSize ?? 12;
    const money = (n: number) => (n < 0 ? MINUS : '') + drawing.formatPrice(Math.abs(n));
    const pct = (d: number) => ((d / stats.entry) * 100).toFixed(2);

    const profitText = o.compact
      ? `${drawing.formatPrice(stats.profitDistance)} (${pct(stats.profitDistance)}%) ${stats.amountTarget}`
      : `Target: ${drawing.formatPrice(stats.profitDistance)} (${pct(stats.profitDistance)}%) ${stats.profitTicks}, Amount: ${stats.amountTarget}`;
    const stopText = o.compact
      ? `${drawing.formatPrice(stats.stopDistance)} (${pct(stats.stopDistance)}%) ${stats.amountStop}`
      : `Stop: ${drawing.formatPrice(stats.stopDistance)} (${pct(stats.stopDistance)}%) ${stats.stopTicks}, Amount: ${stats.amountStop}`;
    const ratio = String(+stats.riskReward.toFixed(2));
    const centerLines = o.compact
      ? [`${money(stats.pnl)} ~ ${trimQty(stats.qty)}`, ratio]
      : [`${stats.closed ? 'Closed' : 'Open'} P&L: ${money(stats.pnl)}, Qty: ${trimQty(stats.qty)}`, `Risk/Reward Ratio: ${ratio}`];

    const profitColor = labelColor(o.profitBackground ?? '', LABEL_GREEN);
    const stopColor = labelColor(o.stopBackground ?? '', LABEL_RED);
    const centerX = (g.left + g.right) / 2;
    const long = drawing.side > 0;

    ctx.font = `${size * pr}px ${PATTERN_LABEL_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const box = (lines: string[], top: number, color: string) => {
      const single = lines.length === 1;
      const textW = Math.max(...lines.map((t) => ctx.measureText(t).width)) / pr;
      const w = Math.ceil(textW + 2 * (single ? LABEL_PAD_X : CENTER_PAD_X));
      const h = single ? LABEL_HEIGHT : CENTER_HEIGHT;
      const x = Math.round((centerX - w / 2) * pr);
      const y = Math.round(top * pr);
      // A 1px white outline keeps the label legible over candles.
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(x - pr, y - pr, w * pr + 2 * pr, h * pr + 2 * pr, (LABEL_RADIUS + 1) * pr);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, w * pr, h * pr, LABEL_RADIUS * pr);
      ctx.fill();
      ctx.fillStyle = o.textColor ?? '#ffffff';
      lines.forEach((text, i) => {
        const cy = single ? top + h / 2 : top + h / 2 + (i - 0.5) * LINE_PITCH;
        ctx.fillText(text, centerX * pr, cy * pr + 0.5 * pr);
      });
    };
    const heightOf = (lines: string[]) => (lines.length === 1 ? LABEL_HEIGHT : CENTER_HEIGHT);

    // The target label sits beyond the take-profit edge, the stop label beyond the stop edge.
    const profitTop = long ? g.yProfit - LABEL_GAP - LABEL_HEIGHT : g.yProfit + LABEL_GAP;
    const stopTop = long ? g.yStop + LABEL_GAP : g.yStop - LABEL_GAP - LABEL_HEIGHT;
    const centerTop = long ? g.entryY + LABEL_GAP : g.entryY - LABEL_GAP - heightOf(centerLines);

    box([profitText], profitTop, profitColor);
    box([stopText], stopTop, stopColor);
    box(centerLines, centerTop, stats.pnl >= 0 ? profitColor : stopColor);
  }

  private drawHandles(scope: BitmapCoordinatesRenderingScope, viewport: NonNullable<ReturnType<PositionDrawing['getViewport']>>): void {
    const { context: ctx, horizontalPixelRatio: pr } = scope;
    const color = '#1E53E5';
    for (const point of this._drawing.getControlPoints(viewport)) {
      if (point.index === CP_ENTRY) {
        drawControlPoint(ctx, point, false, pr, color);
        continue;
      }
      const s = HANDLE_SIZE * pr;
      const ring = 1.5 * pr;
      ctx.beginPath();
      ctx.roundRect(point.x * pr - s / 2 + ring / 2, point.y * pr - s / 2 + ring / 2, s - ring, s - ring, 4 * pr);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = ring;
      ctx.stroke();
    }
  }
}
