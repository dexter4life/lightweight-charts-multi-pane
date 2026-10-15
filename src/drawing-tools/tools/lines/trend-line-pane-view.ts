import type {
  BitmapCoordinatesRenderingScope,
  CanvasRenderingTarget2D,
} from 'fancy-canvas';
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
} from '../../../model/ipane-primitive';

import { getLineAngleDegrees, midpoint } from '../../core/geometry';
import type { Point, Viewport } from '../../core/types';
import { applyStyle, drawControlPoints, drawLabel, drawLine, formatPrice } from '../../rendering/canvas-utils';
import type { TrendLine } from './trend-line';

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
const TEXT_GAP = 4;
const STATS_ROW = 28;
const STATS_PAD = 5;
const STATS_GAP = 11;
const STATS_ICON_X = 19;
const STATS_TEXT_X = 37.5;
const STATS_PAD_RIGHT = 12;
const STATS_FILL = 'rgba(33, 150, 243, 0.1)';
const STATS_TEXT = '#131722';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMiddlePoint(ctx: CanvasRenderingContext2D, p: Point, pixelRatio: number, color: string): void {
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(p.x * pixelRatio, p.y * pixelRatio, 3.5 * pixelRatio, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * pixelRatio;
  ctx.stroke();
  ctx.restore();
}

function drawStatsIcon(ctx: CanvasRenderingContext2D, icon: 'price' | 'range' | 'angle', cx: number, cy: number): void {
  ctx.save();
  ctx.strokeStyle = STATS_TEXT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (icon === 'price') {
    ctx.moveTo(cx - 5.5, cy - 6.5); ctx.lineTo(cx + 5.5, cy - 6.5);
    ctx.moveTo(cx - 5.5, cy + 6.5); ctx.lineTo(cx + 5.5, cy + 6.5);
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
    ctx.moveTo(cx - 2.5, cy - 2); ctx.lineTo(cx, cy - 5); ctx.lineTo(cx + 2.5, cy - 2);
    ctx.moveTo(cx - 2.5, cy + 2); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx + 2.5, cy + 2);
  } else if (icon === 'range') {
    for (const dx of [-6.5, 6.5]) {
      ctx.rect(cx + dx - 1.25, cy - 4.7, 2.5, 9.4);
      ctx.moveTo(cx + dx, cy - 6.3); ctx.lineTo(cx + dx, cy - 4.7);
      ctx.moveTo(cx + dx, cy + 4.7); ctx.lineTo(cx + dx, cy + 6.3);
    }
    ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx - 2, cy - 2); ctx.lineTo(cx - 4, cy); ctx.lineTo(cx - 2, cy + 2);
    ctx.moveTo(cx + 2, cy - 2); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx + 2, cy + 2);
  } else {
    const vx = cx - 5.75;
    const vy = cy + 5.25;
    ctx.moveTo(vx, vy); ctx.lineTo(vx + 11.5, vy);
    ctx.moveTo(vx, vy); ctx.lineTo(vx + 6.75, vy - 10.9);
    ctx.moveTo(vx + 6.5, vy); ctx.arc(vx, vy, 6.5, 0, -1.01, true);
  }
  ctx.stroke();
  ctx.restore();
}

const ANGLE_ARC_RADIUS = 50;
const ANGLE_LABEL_GAP = 7;

/**
 * Specialized pane view for TrendLine with label support
 */
export class TrendLinePaneView implements IPrimitivePaneView {
  private _renderer: TrendLinePaneRenderer;

  constructor(drawing: TrendLine) {
    this._renderer = new TrendLinePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

/**
 * Renderer for TrendLine
 */
class TrendLinePaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: TrendLine;

  constructor(drawing: TrendLine) {
    this._drawing = drawing;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      this.drawImpl(scope);
    });
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio } = scope;
    const pixelRatio = horizontalPixelRatio;
    const drawing = this._drawing;

    const viewport = drawing.getViewport();
    if (!viewport) return;
    if (!drawing.options.visible || !drawing.isDisplayed()) return;
    if (!drawing.isValid()) return;

    const px = drawing.anchorPixels(viewport);
    if (!px) return;
    const [start, end] = px;
    const opts = drawing.trendLineOptions;
    const state = drawing.state;
    const active = state === 'selected' || state === 'editing';

    ctx.save();
    applyStyle(ctx, drawing.style, pixelRatio);
    this.renderLine(ctx, start, end, viewport, pixelRatio);

    ctx.setLineDash([]);
    if (opts.leftEnd === 'arrow') this.drawArrowCap(ctx, start, end, pixelRatio);
    if (opts.rightEnd === 'arrow') this.drawArrowCap(ctx, end, start, pixelRatio);
    ctx.restore();

    if (drawing.showsAngleArc) this.renderAngleArc(ctx, start, end, pixelRatio);

    if (opts.showText && opts.text) this.renderText(ctx, start, end, pixelRatio);

    this.renderLabels(ctx, start, end, pixelRatio);

    if (opts.middlePoint && active) {
      const mid = midpoint(start, end);
      drawMiddlePoint(ctx, mid, pixelRatio, drawing.style.lineColor);
    }

    if (state === 'selected' || state === 'editing' || state === 'hovered') {
      const controlPoints = drawing.getControlPoints(viewport);
      drawControlPoints(ctx, controlPoints, null, pixelRatio, drawing.style.lineColor);
    }

    if (drawing.hasStats() && (active || opts.alwaysShowStats)) {
      this.renderStats(ctx, start, end, pixelRatio);
    }
  }

  private renderLine(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    viewport: Viewport,
    pixelRatio: number
  ): void {
    const options = this._drawing.options;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    let a = start;
    let b = end;
    if (len > 0) {
      const reach = (viewport.width + viewport.height) * 4 + len;
      const ux = dx / len;
      const uy = dy / len;
      if (options.extendLeft) a = { x: start.x - ux * reach, y: start.y - uy * reach };
      if (options.extendRight) b = { x: end.x + ux * reach, y: end.y + uy * reach };
    }
    drawLine(ctx, a, b, pixelRatio);
  }

  private drawArrowCap(ctx: CanvasRenderingContext2D, tip: Point, other: Point, pixelRatio: number): void {
    const dx = other.x - tip.x;
    const dy = other.y - tip.y;
    if (dx === 0 && dy === 0) return;
    const base = Math.atan2(dy, dx);
    const size = 7 * this._drawing.style.lineWidth;
    const spread = Math.PI / 4;
    ctx.beginPath();
    for (const sign of [-1, 1]) {
      ctx.moveTo(tip.x * pixelRatio, tip.y * pixelRatio);
      ctx.lineTo(
        (tip.x + Math.cos(base + sign * spread) * size) * pixelRatio,
        (tip.y + Math.sin(base + sign * spread) * size) * pixelRatio
      );
    }
    ctx.stroke();
  }

  private renderText(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, pixelRatio: number): void {
    const o = this._drawing.trendLineOptions;
    const left = p1.x <= p2.x ? p1 : p2;
    const right = left === p1 ? p2 : p1;
    const angle = Math.atan2(right.y - left.y, right.x - left.x);
    const hAlign = o.textHAlign ?? 'center';
    const vAlign = o.textVAlign ?? 'top';
    const anchor = hAlign === 'left' ? left : hAlign === 'right' ? right : midpoint(left, right);

    ctx.save();
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.translate(anchor.x, anchor.y);
    ctx.rotate(angle);
    ctx.font = `${o.textItalic ? 'italic ' : ''}${o.textBold ? 'bold ' : ''}${o.textSize ?? 14}px ${FONT_FAMILY}`;
    ctx.fillStyle = o.textColor ?? this._drawing.style.lineColor;
    ctx.textAlign = hAlign;
    ctx.textBaseline = vAlign === 'top' ? 'bottom' : vAlign === 'bottom' ? 'top' : 'middle';
    const gap = vAlign === 'top' ? -TEXT_GAP : vAlign === 'bottom' ? TEXT_GAP : 0;
    const lines = (o.text ?? '').split('\n');
    const lh = (o.textSize ?? 14) * 1.2;
    const total = lines.length * lh;
    const first = vAlign === 'top' ? gap - total + lh : vAlign === 'bottom' ? gap : gap - total / 2 + lh / 2;
    lines.forEach((line, i) => {
      if (vAlign === 'top') ctx.textBaseline = 'bottom';
      ctx.fillText(line, 0, first + i * lh);
    });
    ctx.restore();
  }

  private renderAngleArc(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, pixelRatio: number): void {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (dx === 0 && dy === 0) return;
    const color = this._drawing.style.lineColor;
    const theta = Math.atan2(-dy, dx);

    ctx.save();
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([0.5, 1]);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + ANGLE_ARC_RADIUS, p1.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, ANGLE_ARC_RADIUS, 0, -theta, theta > 0);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round((theta * 180) / Math.PI)}\u00b0`, p1.x + ANGLE_ARC_RADIUS + ANGLE_LABEL_GAP, p1.y);
    ctx.restore();
  }

  private renderStats(ctx: CanvasRenderingContext2D, p1: Point, p2: Point, pixelRatio: number): void {
    const rows = this._drawing.computeStats(p1, p2);
    if (rows.length === 0) return;
    const position = this._drawing.trendLineOptions.statsPosition ?? 'right';
    const anchor = position === 'left' ? p1 : position === 'right' ? p2 : midpoint(p1, p2);
    const dx = p2.x - p1.x;
    const slope = dx === 0 ? -1 : (p2.y - p1.y) / dx;

    ctx.save();
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.font = `12px ${FONT_FAMILY}`;
    const textWidth = Math.max(...rows.map((r) => ctx.measureText(r.text).width));
    const width = STATS_TEXT_X + textWidth + STATS_PAD_RIGHT;
    const height = rows.length * STATS_ROW + STATS_PAD * 2;
    const x = anchor.x + STATS_GAP;
    const y = slope > 0 ? anchor.y - STATS_GAP - height : anchor.y + STATS_GAP;

    ctx.fillStyle = STATS_FILL;
    roundRect(ctx, x, y, width, height, 4);
    ctx.fill();

    ctx.fillStyle = STATS_TEXT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    rows.forEach((row, i) => {
      const cy = y + STATS_PAD + STATS_ROW * i + STATS_ROW / 2;
      drawStatsIcon(ctx, row.icon, x + STATS_ICON_X, cy);
      ctx.fillText(row.text, x + STATS_TEXT_X, cy);
    });
    ctx.restore();
  }

  private renderLabels(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    pixelRatio: number
  ): void {
    const options = this._drawing.trendLineOptions;

    if (!options.showAngle &&
        !options.showPriceChange &&
        !options.showPercentChange &&
        !options.showBars) {
      return;
    }

    // Calculate label parts
    const labelParts: string[] = [];

    if (options.showAngle) {
      const angle = getLineAngleDegrees(start, end);
      labelParts.push(`${angle.toFixed(1)}°`);
    }

    if (options.showPriceChange) {
      const { absolute } = this._drawing.getPriceChange();
      const sign = absolute >= 0 ? '+' : '';
      labelParts.push(`${sign}${formatPrice(absolute)}`);
    }

    if (options.showPercentChange) {
      const { percentage } = this._drawing.getPriceChange();
      const sign = percentage >= 0 ? '+' : '';
      labelParts.push(`${sign}${percentage.toFixed(2)}%`);
    }

    if (options.showBars) {
      const bars = this._drawing.getTimeSpan();
      labelParts.push(`${bars} bars`);
    }

    if (labelParts.length === 0) return;

    // Position label at midpoint, above the line
    const labelPosition = midpoint(start, end);
    const offset = 20;

    // Determine if line goes up or down to position label appropriately
    const goesUp = end.y < start.y;
    const labelY = goesUp ? labelPosition.y - offset : labelPosition.y + offset;

    const text = labelParts.join(' | ');

    drawLabel(
      ctx,
      text,
      { x: labelPosition.x, y: labelY },
      {
        font: this._drawing.style.labelFont || '12px sans-serif',
        textColor: '#ffffff',
        backgroundColor: this._drawing.style.lineColor + 'CC',
        padding: 4,
        borderRadius: 3,
      },
      pixelRatio
    );
  }
}
