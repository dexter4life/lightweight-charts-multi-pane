import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { Geometry, LineGeometry, RectangleGeometry } from '../../core/geometry';
import { distanceToLineSegment } from '../../core/geometry';
import { PositionForecastPaneView } from './position-forecast-pane-view';

export interface PositionForecastOptions extends DrawingOptions {
  showPrices?: boolean;
  showPercentage?: boolean;
  showRiskReward?: boolean;
  showPnL?: boolean;
  quantity?: number;
}

export class PositionForecast extends Drawing {
  readonly type = 'position-forecast';

  protected static readonly REQUIRED_ANCHORS = 3;
  protected static readonly HIT_THRESHOLD = 6;

  private _positionForecastOptions: PositionForecastOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<PositionForecastOptions> = {}
  ) {
    const { showPrices, showPercentage, showRiskReward, showPnL, quantity, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._positionForecastOptions = {
      ...this._options,
      showPrices: showPrices ?? true,
      showPercentage: showPercentage ?? true,
      showRiskReward: showRiskReward ?? true,
      showPnL: showPnL ?? true,
      quantity: quantity ?? 1,
    };
  }

  get positionForecastOptions(): PositionForecastOptions {
    return this._positionForecastOptions;
  }

  setPositionForecastOptions(options: Partial<PositionForecastOptions>): void {
    this._positionForecastOptions = { ...this._positionForecastOptions, ...options };
    super.updateOptions(options);
  }

  override updateOptions(options: Partial<PositionForecastOptions>): void {
    this._positionForecastOptions = { ...this._positionForecastOptions, ...options };
    super.updateOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= PositionForecast.REQUIRED_ANCHORS;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new PositionForecastPaneView(this)];
  }

  getForecastMetrics(): {
    entry: number;
    target: number;
    stop: number;
    reward: number;
    risk: number;
    pnl: number;
    percent: number;
    riskPercent: number;
    rewardPercent: number;
    riskRewardRatio: number;
    isLong: boolean;
  } {
    if (!this.isValid()) {
      return {
        entry: 0,
        target: 0,
        stop: 0,
        reward: 0,
        risk: 0,
        pnl: 0,
        percent: 0,
        riskPercent: 0,
        rewardPercent: 0,
        riskRewardRatio: 0,
        isLong: true,
      };
    }

    const entry = this._anchors[0].price;
    const target = this._anchors[1].price;
    const stop = this._anchors[2].price;
    const reward = Math.abs(target - entry);
    const risk = Math.abs(entry - stop);
    const quantity = this._positionForecastOptions.quantity ?? 1;
    const pnl = (target - entry) * quantity;
    const percent = entry !== 0 ? ((target - entry) / entry) * 100 : 0;
    const riskPercent = entry !== 0 ? (risk / entry) * 100 : 0;
    const rewardPercent = entry !== 0 ? (reward / entry) * 100 : 0;
    const riskRewardRatio = risk > 0 ? reward / risk : 0;
    const isLong = target >= entry;

    return {
      entry,
      target,
      stop,
      reward,
      risk,
      pnl,
      percent,
      riskPercent,
      rewardPercent,
      riskRewardRatio,
      isLong,
    };
  }

  getPixelBox(viewport: Viewport): {
    left: number;
    right: number;
    top: number;
    bottom: number;
    entryY: number;
    targetY: number;
    stopY: number;
  } | null {
    if (!this.isValid()) {
      return null;
    }

    const entry = this.anchorToPixel(this._anchors[0], viewport);
    const target = this.anchorToPixel(this._anchors[1], viewport);
    const stop = this.anchorToPixel(this._anchors[2], viewport);

    if (!entry || !target || !stop) {
      return null;
    }

    const left = entry.x;
    const right = Math.max(entry.x + 60, target.x, stop.x);
    const top = Math.min(entry.y, target.y, stop.y);
    const bottom = Math.max(entry.y, target.y, stop.y);

    return {
      left,
      right,
      top,
      bottom,
      entryY: entry.y,
      targetY: target.y,
      stopY: stop.y,
    };
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const box = this.getPixelBox(viewport);
    if (!box) {
      return [];
    }

    const width = box.right - box.left;
    const geometries: Geometry[] = [];
    const rewardTop = Math.min(box.entryY, box.targetY);
    const rewardHeight = Math.abs(box.targetY - box.entryY);
    const riskTop = Math.min(box.entryY, box.stopY);
    const riskHeight = Math.abs(box.stopY - box.entryY);

    geometries.push({
      type: 'rectangle',
      topLeft: { x: box.left, y: rewardTop },
      width,
      height: rewardHeight,
    } as RectangleGeometry);
    geometries.push({
      type: 'rectangle',
      topLeft: { x: box.left, y: riskTop },
      width,
      height: riskHeight,
    } as RectangleGeometry);
    geometries.push({ type: 'line', start: { x: box.left, y: box.entryY }, end: { x: box.right, y: box.entryY } } as LineGeometry);
    geometries.push({ type: 'line', start: { x: box.left, y: box.targetY }, end: { x: box.right, y: box.targetY } } as LineGeometry);
    geometries.push({ type: 'line', start: { x: box.left, y: box.stopY }, end: { x: box.right, y: box.stopY } } as LineGeometry);

    return geometries;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const box = this.getPixelBox(viewport);
    if (!box) {
      return false;
    }

    if (
      point.x >= box.left &&
      point.x <= box.right &&
      point.y >= box.top &&
      point.y <= box.bottom
    ) {
      return true;
    }

    const lines = [
      [{ x: box.left, y: box.entryY }, { x: box.right, y: box.entryY }],
      [{ x: box.left, y: box.targetY }, { x: box.right, y: box.targetY }],
      [{ x: box.left, y: box.stopY }, { x: box.right, y: box.stopY }],
    ] as const;

    return lines.some(([start, end]) => distanceToLineSegment(point, start, end) <= PositionForecast.HIT_THRESHOLD);
  }

  override toJSON(): SerializedDrawing {
    return {
      ...super.toJSON(),
      options: { ...this._positionForecastOptions },
    };
  }

  override fromJSON(data: SerializedDrawing): void {
    super.fromJSON(data);
    this._positionForecastOptions = { ...this._positionForecastOptions, ...data.options };
  }

  override clone(newId: string): IDrawing {
    return new PositionForecast(newId, [...this._anchors], { ...this._style }, { ...this._positionForecastOptions });
  }
}
