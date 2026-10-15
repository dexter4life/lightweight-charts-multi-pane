import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import { PATTERN_LABEL_FONT_FAMILY } from '../patterns/xabcd-pattern-pane-view';
import type { Measure } from './measure';

const UP_LINE = '#1E53E5';
const UP_FILL = 'rgba(41, 98, 255, 0.2)';
const UP_LABEL = '#2962FF';
const DOWN_LINE = '#F7525F';
const DOWN_FILL = 'rgba(247, 82, 95, 0.2)';
const DOWN_LABEL = '#F7525F';

const LABEL_GAP = 10;
const LABEL_PAD_X = 11;
const LABEL_PITCH = 20;
const LABEL_PAD_Y = 5;
const LABEL_RADIUS = 4;
const FONT_SIZE = 12;
const ARROW = 5;

export class MeasurePaneView implements IPrimitivePaneView {
  private readonly _renderer: MeasurePaneRenderer;

  constructor(drawing: Measure) {
    this._renderer = new MeasurePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class MeasurePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: Measure) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => this.drawImpl(scope));
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const drawing = this._drawing;
    const viewport = drawing.getViewport();
    if (!viewport || !drawing.options.visible || !drawing.isValid()) return;
    const info = drawing.getInfo();
    const p1 = drawing.anchorToPixel(drawing.anchors[0], viewport);
    const p2 = drawing.anchorToPixel(drawing.anchors[1], viewport);
    if (!info || !p1 || !p2) return;

    const { context: ctx, horizontalPixelRatio: pr, verticalPixelRatio: vr } = scope;
    const hx = (x: number) => Math.round(x * pr);
    const vy = (y: number) => Math.round(y * vr);
    const lw = Math.max(1, Math.round(pr));

    const left = Math.min(p1.x, p2.x);
    const right = Math.max(p1.x, p2.x);
    const top = Math.min(p1.y, p2.y);
    const bottom = Math.max(p1.y, p2.y);
    const line = info.up ? UP_LINE : DOWN_LINE;

    ctx.save();
    ctx.fillStyle = info.up ? UP_FILL : DOWN_FILL;
    ctx.fillRect(hx(left), vy(top), hx(right) - hx(left), vy(bottom) - vy(top));

    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    const midX = (hx(left) + hx(right)) / 2;
    const midY = (vy(top) + vy(bottom)) / 2;
    const snap = (v: number) => Math.round(v - lw / 2) + lw / 2;
    const arrow = ARROW * pr;

    // Horizontal ruler runs towards the second point's time, the vertical one towards its price.
    const dirX = p2.x >= p1.x ? 1 : -1;
    const x1 = hx(p1.x);
    const x2 = hx(p2.x);
    const y = snap(midY);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.moveTo(x2 - dirX * arrow, y - arrow);
    ctx.lineTo(x2, y);
    ctx.lineTo(x2 - dirX * arrow, y + arrow);
    ctx.stroke();

    const dirY = p2.y >= p1.y ? 1 : -1;
    const y1 = vy(p1.y);
    const y2 = vy(p2.y);
    const x = snap(midX);
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.moveTo(x - arrow, y2 - dirY * arrow);
    ctx.lineTo(x, y2);
    ctx.lineTo(x + arrow, y2 - dirY * arrow);
    ctx.stroke();

    this.drawLabel(scope, drawing.getLabelLines(), (left + right) / 2, top, bottom, info.up, viewport.height);
    ctx.restore();
  }

  private drawLabel(
    scope: BitmapCoordinatesRenderingScope,
    lines: string[],
    centerX: number,
    top: number,
    bottom: number,
    up: boolean,
    paneHeight: number
  ): void {
    const { context: ctx, horizontalPixelRatio: pr, verticalPixelRatio: vr } = scope;
    ctx.font = `${FONT_SIZE * vr}px ${PATTERN_LABEL_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textW = Math.max(...lines.map((t) => ctx.measureText(t).width)) / pr;
    const w = Math.ceil(textW + 2 * LABEL_PAD_X);
    const h = lines.length * LABEL_PITCH + 2 * LABEL_PAD_Y;
    let y = up ? top - LABEL_GAP - h : bottom + LABEL_GAP;
    y = Math.max(0, Math.min(y, paneHeight - h));

    ctx.fillStyle = up ? UP_LABEL : DOWN_LABEL;
    ctx.beginPath();
    ctx.roundRect(Math.round((centerX - w / 2) * pr), Math.round(y * vr), w * pr, h * vr, LABEL_RADIUS * pr);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    lines.forEach((text, i) => {
      ctx.fillText(text, centerX * pr, (y + LABEL_PAD_Y + LABEL_PITCH * (i + 0.5)) * vr + 0.5 * vr);
    });
  }
}
