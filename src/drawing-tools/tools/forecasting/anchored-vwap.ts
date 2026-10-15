import type { IChartApi } from '../../../api/create-chart';
import type { DataChangedHandler, ISeriesApi } from '../../../api/iseries-api';
import type { IPrimitivePaneView } from '../../../model/ipane-primitive';
import type { SeriesType } from '../../../model/series-options';

import { Drawing } from '../../core/drawing';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { distanceToLineSegment } from '../../core/geometry';
import type { SeriesDatumLike } from './data-utils';
import { findNearestBarIndex, resolveSeriesBars, typicalPrice } from './data-utils';
import { AnchoredVwapPaneView } from './anchored-vwap-pane-view';

export interface AnchoredVwapOptions extends DrawingOptions {
  showBands?: boolean;
  bandMultiplier?: number;
  bandColor?: string;
  bandFillColor?: string;
}

export interface AnchoredVwapPoint {
  x: number;
  y: number;
  upperY: number;
  lowerY: number;
}

export class AnchoredVwap extends Drawing {
  readonly type = 'anchored-vwap';

  protected static readonly REQUIRED_ANCHORS = 1;
  protected static readonly HIT_THRESHOLD = 6;

  private _anchoredVwapOptions: AnchoredVwapOptions;
  private _dataChangedHandler: DataChangedHandler | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<AnchoredVwapOptions> = {}
  ) {
    const { showBands, bandMultiplier, bandColor, bandFillColor, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._anchoredVwapOptions = {
      ...this._options,
      showBands: showBands ?? true,
      bandMultiplier: bandMultiplier ?? 1,
      bandColor: bandColor ?? '#90caf9',
      bandFillColor: bandFillColor ?? 'rgba(144, 202, 249, 0.12)',
    };
  }

  get anchoredVwapOptions(): AnchoredVwapOptions {
    return this._anchoredVwapOptions;
  }

  setAnchoredVwapOptions(options: Partial<AnchoredVwapOptions>): void {
    this._anchoredVwapOptions = { ...this._anchoredVwapOptions, ...options };
    super.updateOptions(options);
  }

  override updateOptions(options: Partial<AnchoredVwapOptions>): void {
    this._anchoredVwapOptions = { ...this._anchoredVwapOptions, ...options };
    super.updateOptions(options);
  }

  override attached(params: { chart: IChartApi; series: ISeriesApi<SeriesType>; requestUpdate: () => void }): void {
    super.attached(params);
    this.subscribeToData(params.series);
  }

  override detached(): void {
    this.unsubscribeFromData();
    super.detached();
  }

  updateAllViews(): void {
    this.requestUpdate();
  }

  override isValid(): boolean {
    return this._anchors.length >= AnchoredVwap.REQUIRED_ANCHORS;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new AnchoredVwapPaneView(this)];
  }

  getVwapPoints(viewport: Viewport): AnchoredVwapPoint[] {
    if (!this.isValid() || !this._series) {
      return [];
    }

    const bars = resolveSeriesBars(this._series.data() as readonly SeriesDatumLike[]);
    const startIndex = findNearestBarIndex(bars, this._anchors[0].time);
    if (startIndex < 0) {
      return [];
    }

    const bandMultiplier = this._anchoredVwapOptions.bandMultiplier ?? 1;
    const points: AnchoredVwapPoint[] = [];
    let cumulativeWeight = 0;
    let cumulativeWeightedPrice = 0;
    let cumulativeWeightedSquared = 0;

    for (let index = startIndex; index < bars.length; index += 1) {
      const bar = bars[index];
      const x = viewport.timeScale.timeToCoordinate(bar.time);
      if (x === null) {
        continue;
      }

      const price = typicalPrice(bar);
      const weight = bar.hasExplicitVolume ? Math.max(bar.volume, 0.0001) : 1;
      cumulativeWeight += weight;
      cumulativeWeightedPrice += price * weight;
      cumulativeWeightedSquared += price * price * weight;

      const mean = cumulativeWeightedPrice / cumulativeWeight;
      const variance = Math.max(0, cumulativeWeightedSquared / cumulativeWeight - mean * mean);
      const deviation = Math.sqrt(variance) * bandMultiplier;

      const y = viewport.priceScale.priceToCoordinate(mean);
      const upperY = viewport.priceScale.priceToCoordinate(mean + deviation);
      const lowerY = viewport.priceScale.priceToCoordinate(mean - deviation);

      if (y === null || upperY === null || lowerY === null) {
        continue;
      }

      points.push({ x, y, upperY, lowerY });
    }

    return points;
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const points = this.getVwapPoints(viewport);
    if (points.length < 2) {
      return [];
    }

    const geometries: Geometry[] = [];
    for (let index = 1; index < points.length; index += 1) {
      geometries.push({
        type: 'line',
        start: { x: points[index - 1].x, y: points[index - 1].y },
        end: { x: points[index].x, y: points[index].y },
      } as LineGeometry);

      if (this._anchoredVwapOptions.showBands) {
        geometries.push({
          type: 'line',
          start: { x: points[index - 1].x, y: points[index - 1].upperY },
          end: { x: points[index].x, y: points[index].upperY },
        } as LineGeometry);
        geometries.push({
          type: 'line',
          start: { x: points[index - 1].x, y: points[index - 1].lowerY },
          end: { x: points[index].x, y: points[index].lowerY },
        } as LineGeometry);
      }
    }

    return geometries;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getVwapPoints(viewport);
    for (let index = 1; index < points.length; index += 1) {
      const segmentPairs = [
        [{ x: points[index - 1].x, y: points[index - 1].y }, { x: points[index].x, y: points[index].y }],
      ] as Array<[Point, Point]>;

      if (this._anchoredVwapOptions.showBands) {
        segmentPairs.push(
          [{ x: points[index - 1].x, y: points[index - 1].upperY }, { x: points[index].x, y: points[index].upperY }],
          [{ x: points[index - 1].x, y: points[index - 1].lowerY }, { x: points[index].x, y: points[index].lowerY }]
        );
      }

      if (segmentPairs.some(([start, end]) => distanceToLineSegment(point, start, end) <= AnchoredVwap.HIT_THRESHOLD)) {
        return true;
      }
    }

    return false;
  }

  override toJSON(): SerializedDrawing {
    return {
      ...super.toJSON(),
      options: { ...this._anchoredVwapOptions },
    };
  }

  override fromJSON(data: SerializedDrawing): void {
    super.fromJSON(data);
    this._anchoredVwapOptions = { ...this._anchoredVwapOptions, ...data.options };
  }

  override clone(newId: string): IDrawing {
    return new AnchoredVwap(newId, [...this._anchors], { ...this._style }, { ...this._anchoredVwapOptions });
  }

  private subscribeToData(series: ISeriesApi<SeriesType>): void {
    this.unsubscribeFromData();
    this._dataChangedHandler = () => this.requestUpdate();
    series.subscribeDataChanged(this._dataChangedHandler);
  }

  private unsubscribeFromData(): void {
    if (this._series && this._dataChangedHandler) {
      this._series.unsubscribeDataChanged(this._dataChangedHandler);
    }
    this._dataChangedHandler = null;
  }
}
