import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { PositionForecast } from './position-forecast';
import { drawControlPoints, drawLine, formatPercentage, formatPrice } from '../../rendering/canvas-utils';

export class PositionForecastPaneView implements IPrimitivePaneView {
  private _renderer: PositionForecastPaneRenderer;

  constructor(drawing: PositionForecast) {
    this._renderer = new PositionForecastPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class PositionForecastPaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: PositionForecast;

  constructor(drawing: PositionForecast) {
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
    const viewport = this._drawing.getViewport();

    if (!viewport || !this._drawing.options.visible || !this._drawing.isValid()) {
      return;
    }

    const box = this._drawing.getPixelBox(viewport);
    if (!box) {
      return;
    }

    const options = this._drawing.positionForecastOptions;
    const metrics = this._drawing.getForecastMetrics();
    const width = box.right - box.left;

    ctx.save();

    ctx.fillStyle = 'rgba(38, 166, 154, 0.18)';
    ctx.fillRect(
      box.left * pixelRatio,
      Math.min(box.entryY, box.targetY) * pixelRatio,
      width * pixelRatio,
      Math.abs(box.targetY - box.entryY) * pixelRatio
    );
    ctx.strokeStyle = '#26a69a';
    ctx.lineWidth = 1 * pixelRatio;
    ctx.strokeRect(
      box.left * pixelRatio,
      Math.min(box.entryY, box.targetY) * pixelRatio,
      width * pixelRatio,
      Math.abs(box.targetY - box.entryY) * pixelRatio
    );

    ctx.fillStyle = 'rgba(239, 83, 80, 0.18)';
    ctx.fillRect(
      box.left * pixelRatio,
      Math.min(box.entryY, box.stopY) * pixelRatio,
      width * pixelRatio,
      Math.abs(box.stopY - box.entryY) * pixelRatio
    );
    ctx.strokeStyle = '#ef5350';
    ctx.strokeRect(
      box.left * pixelRatio,
      Math.min(box.entryY, box.stopY) * pixelRatio,
      width * pixelRatio,
      Math.abs(box.stopY - box.entryY) * pixelRatio
    );

    ctx.strokeStyle = '#42a5f5';
    ctx.lineWidth = 2 * pixelRatio;
    drawLine(ctx, { x: box.left, y: box.entryY }, { x: box.right, y: box.entryY }, pixelRatio);

    ctx.strokeStyle = '#26a69a';
    ctx.setLineDash([5 * pixelRatio, 3 * pixelRatio]);
    drawLine(ctx, { x: box.left, y: box.targetY }, { x: box.right, y: box.targetY }, pixelRatio);

    ctx.strokeStyle = '#ef5350';
    drawLine(ctx, { x: box.left, y: box.stopY }, { x: box.right, y: box.stopY }, pixelRatio);
    ctx.setLineDash([]);

    ctx.font = `${11 * pixelRatio}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const labelX = (box.right + 8) * pixelRatio;

    ctx.fillStyle = '#42a5f5';
    const entryText = options.showPrices ? `Entry ${formatPrice(metrics.entry)}` : 'Entry';
    ctx.fillText(entryText, labelX, box.entryY * pixelRatio);

    ctx.fillStyle = '#26a69a';
    let targetText = 'Target';
    if (options.showPrices) {
      targetText += ` ${formatPrice(metrics.target)}`;
    }
    if (options.showPercentage) {
      targetText += ` ${formatPercentage(metrics.rewardPercent)}`;
    }
    ctx.fillText(targetText, labelX, box.targetY * pixelRatio);

    ctx.fillStyle = '#ef5350';
    let stopText = 'Stop';
    if (options.showPrices) {
      stopText += ` ${formatPrice(metrics.stop)}`;
    }
    if (options.showPercentage) {
      stopText += ` -${metrics.riskPercent.toFixed(2)}%`;
    }
    ctx.fillText(stopText, labelX, box.stopY * pixelRatio);

    const panelLines: string[] = [];
    if (options.showPnL) {
      const signedPnl = metrics.pnl >= 0 ? `+${formatPrice(metrics.pnl)}` : formatPrice(metrics.pnl);
      panelLines.push(`PnL ${signedPnl}`);
    }
    if (options.showPercentage) {
      panelLines.push(`Move ${formatPercentage(metrics.percent)}`);
    }
    if (options.showRiskReward) {
      panelLines.push(`R:R 1:${metrics.riskRewardRatio.toFixed(2)}`);
    }

    if (panelLines.length > 0) {
      const panelX = box.left + 8;
      const panelY = box.top + 8;
      const lineHeight = 14;
      const padding = 6;

      ctx.font = `${11 * pixelRatio}px sans-serif`;
      const maxWidth = panelLines.reduce((widthValue, line) => Math.max(widthValue, ctx.measureText(line).width / pixelRatio), 0);
      const panelWidth = maxWidth + padding * 2;
      const panelHeight = panelLines.length * lineHeight + padding * 2;

      ctx.fillStyle = 'rgba(19, 23, 34, 0.92)';
      ctx.beginPath();
      ctx.roundRect(
        panelX * pixelRatio,
        panelY * pixelRatio,
        panelWidth * pixelRatio,
        panelHeight * pixelRatio,
        4 * pixelRatio
      );
      ctx.fill();

      ctx.strokeStyle = metrics.isLong ? '#26a69a' : '#ef5350';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';
      panelLines.forEach((line, index) => {
        ctx.fillText(
          line,
          (panelX + padding) * pixelRatio,
          (panelY + padding + index * lineHeight) * pixelRatio
        );
      });
    }

    ctx.restore();

    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      drawControlPoints(ctx, this._drawing.getControlPoints(viewport), null, pixelRatio);
    }
  }
}
