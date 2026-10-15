import type { IChartApi } from '../../../api/create-chart';
import type { DataChangedHandler, ISeriesApi } from '../../../api/iseries-api';
import type { IPrimitivePaneView } from '../../../model/ipane-primitive';
import type { SeriesType } from '../../../model/series-options';

import { Drawing } from '../../core/drawing';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { Geometry, LineGeometry } from '../../core/geometry';
import { distanceToLineSegment } from '../../core/geometry';
import type { ResolvedSeriesBar, SeriesDatumLike } from './data-utils';
import { estimateSpacingFromBars, findNearestBarIndex, resolveSeriesBars } from './data-utils';
import { GhostFeedPaneView } from './ghost-feed-pane-view';

export interface GhostFeedOptions extends DrawingOptions {
  lookbackBars?: number;
  opacity?: number;
  candleWidthFactor?: number;
  showBodies?: boolean;
  showWicks?: boolean;
}

export interface GhostFeedProjectedBar {
  x: number;
  openY: number;
  highY: number;
  lowY: number;
  closeY: number;
  isUp: boolean;
}

export class GhostFeed extends Drawing {
  readonly type = 'ghost-feed';

  protected static readonly REQUIRED_ANCHORS = 2;
  protected static readonly HIT_THRESHOLD = 6;

  private _ghostFeedOptions: GhostFeedOptions;
  private _dataChangedHandler: DataChangedHandler | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<GhostFeedOptions> = {}
  ) {
    const { lookbackBars, opacity, candleWidthFactor, showBodies, showWicks, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._ghostFeedOptions = {
      ...this._options,
      lookbackBars: lookbackBars ?? 20,
      opacity: opacity ?? 0.35,
      candleWidthFactor: candleWidthFactor ?? 0.6,
      showBodies: showBodies ?? true,
      showWicks: showWicks ?? true,
    };
  }

  get ghostFeedOptions(): GhostFeedOptions {
    return this._ghostFeedOptions;
  }

  setGhostFeedOptions(options: Partial<GhostFeedOptions>): void {
    this._ghostFeedOptions = { ...this._ghostFeedOptions, ...options };
    super.updateOptions(options);
  }

  override updateOptions(options: Partial<GhostFeedOptions>): void {
    this._ghostFeedOptions = { ...this._ghostFeedOptions, ...options };
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
    return this._anchors.length >= GhostFeed.REQUIRED_ANCHORS;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new GhostFeedPaneView(this)];
  }

  getProjectedBars(viewport: Viewport): { bars: GhostFeedProjectedBar[]; candleWidth: number } {
    if (!this.isValid() || !this._series) {
      return { bars: [], candleWidth: 6 };
    }

    const sourceBars = resolveSeriesBars(this._series.data() as readonly SeriesDatumLike[]);
    if (sourceBars.length === 0) {
      return { bars: [], candleWidth: 6 };
    }

    const sourceIndex = findNearestBarIndex(sourceBars, this._anchors[0].time);
    if (sourceIndex < 0) {
      return { bars: [], candleWidth: 6 };
    }

    const lookback = Math.max(2, Math.floor(this._ghostFeedOptions.lookbackBars ?? 20));
    const startIndex = Math.max(0, sourceIndex - lookback + 1);
    const sample = sourceBars.slice(startIndex, sourceIndex + 1);
    const destination = this.anchorToPixel(this._anchors[1], viewport);

    if (!destination || sample.length === 0) {
      return { bars: [], candleWidth: 6 };
    }

    const firstClose = sample[0].close;
    const spacing = estimateSpacingFromBars(sample, (time) => viewport.timeScale.timeToCoordinate(time), 12);
    const candleWidth = Math.max(3, spacing * (this._ghostFeedOptions.candleWidthFactor ?? 0.6));
    const projectedBars: GhostFeedProjectedBar[] = [];

    sample.forEach((bar: ResolvedSeriesBar, index: number) => {
      const offset = this._anchors[1].price - firstClose;
      const projectedOpen = bar.open + offset;
      const projectedHigh = bar.high + offset;
      const projectedLow = bar.low + offset;
      const projectedClose = bar.close + offset;
      const openY = viewport.priceScale.priceToCoordinate(projectedOpen);
      const highY = viewport.priceScale.priceToCoordinate(projectedHigh);
      const lowY = viewport.priceScale.priceToCoordinate(projectedLow);
      const closeY = viewport.priceScale.priceToCoordinate(projectedClose);

      if (openY === null || highY === null || lowY === null || closeY === null) {
        return;
      }

      projectedBars.push({
        x: destination.x + index * spacing,
        openY,
        highY,
        lowY,
        closeY,
        isUp: projectedClose >= projectedOpen,
      });
    });

    return { bars: projectedBars, candleWidth };
  }

  getProjectedBounds(viewport: Viewport): { left: number; right: number; top: number; bottom: number } | null {
    const { bars, candleWidth } = this.getProjectedBars(viewport);
    if (bars.length === 0) {
      return null;
    }

    const left = bars[0].x - candleWidth / 2;
    const right = bars[bars.length - 1].x + candleWidth / 2;
    const top = Math.min(...bars.map((bar) => bar.highY));
    const bottom = Math.max(...bars.map((bar) => bar.lowY));

    return { left, right, top, bottom };
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const { bars } = this.getProjectedBars(viewport);
    if (bars.length < 2) {
      return [];
    }

    const geometries: Geometry[] = [];
    for (let index = 1; index < bars.length; index += 1) {
      geometries.push({
        type: 'line',
        start: { x: bars[index - 1].x, y: bars[index - 1].closeY },
        end: { x: bars[index].x, y: bars[index].closeY },
      } as LineGeometry);
    }

    return geometries;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const bounds = this.getProjectedBounds(viewport);
    if (!bounds) {
      return false;
    }

    if (
      point.x >= bounds.left &&
      point.x <= bounds.right &&
      point.y >= bounds.top &&
      point.y <= bounds.bottom
    ) {
      return true;
    }

    const { bars } = this.getProjectedBars(viewport);
    for (let index = 1; index < bars.length; index += 1) {
      if (
        distanceToLineSegment(
          point,
          { x: bars[index - 1].x, y: bars[index - 1].closeY },
          { x: bars[index].x, y: bars[index].closeY }
        ) <= GhostFeed.HIT_THRESHOLD
      ) {
        return true;
      }
    }

    return false;
  }

  override toJSON(): SerializedDrawing {
    return {
      ...super.toJSON(),
      options: { ...this._ghostFeedOptions },
    };
  }

  override fromJSON(data: SerializedDrawing): void {
    super.fromJSON(data);
    this._ghostFeedOptions = { ...this._ghostFeedOptions, ...data.options };
  }

  override clone(newId: string): IDrawing {
    return new GhostFeed(newId, [...this._anchors], { ...this._style }, { ...this._ghostFeedOptions });
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
