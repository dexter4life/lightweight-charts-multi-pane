import type { IChartApi } from '../../../api/create-chart';
import type { DataChangedHandler, ISeriesApi } from '../../../api/iseries-api';
import type { IPrimitivePaneView } from '../../../model/ipane-primitive';
import type { SeriesType } from '../../../model/series-options';

import { Drawing } from '../../core/drawing';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { Geometry, RectangleGeometry } from '../../core/geometry';
import type { SeriesDatumLike, VolumeProfileData } from './data-utils';
import { buildVolumeProfile, findNearestBarIndex, resolveSeriesBars } from './data-utils';
import { AnchoredVolumeProfilePaneView } from './anchored-volume-profile-pane-view';

export interface AnchoredVolumeProfileOptions extends DrawingOptions {
  bucketCount?: number;
  side?: 'left' | 'right';
  profileWidth?: number;
  showPoc?: boolean;
  upColor?: string;
  downColor?: string;
  rangeFillColor?: string;
}

export interface AnchoredVolumeProfileRenderData {
  left: number;
  right: number;
  top: number;
  bottom: number;
  profile: VolumeProfileData;
}

export class AnchoredVolumeProfile extends Drawing {
  readonly type = 'anchored-volume-profile';

  protected static readonly REQUIRED_ANCHORS = 1;

  private _anchoredVolumeProfileOptions: AnchoredVolumeProfileOptions;
  private _dataChangedHandler: DataChangedHandler | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<AnchoredVolumeProfileOptions> = {}
  ) {
    const { bucketCount, side, profileWidth, showPoc, upColor, downColor, rangeFillColor, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._anchoredVolumeProfileOptions = {
      ...this._options,
      bucketCount: bucketCount ?? 24,
      side: side ?? 'right',
      profileWidth: profileWidth ?? 72,
      showPoc: showPoc ?? true,
      upColor: upColor ?? 'rgba(38, 166, 154, 0.65)',
      downColor: downColor ?? 'rgba(239, 83, 80, 0.65)',
      rangeFillColor: rangeFillColor ?? 'rgba(41, 98, 255, 0.08)',
    };
  }

  get anchoredVolumeProfileOptions(): AnchoredVolumeProfileOptions {
    return this._anchoredVolumeProfileOptions;
  }

  setAnchoredVolumeProfileOptions(options: Partial<AnchoredVolumeProfileOptions>): void {
    this._anchoredVolumeProfileOptions = { ...this._anchoredVolumeProfileOptions, ...options };
    super.updateOptions(options);
  }

  override updateOptions(options: Partial<AnchoredVolumeProfileOptions>): void {
    this._anchoredVolumeProfileOptions = { ...this._anchoredVolumeProfileOptions, ...options };
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
    return this._anchors.length >= AnchoredVolumeProfile.REQUIRED_ANCHORS;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new AnchoredVolumeProfilePaneView(this)];
  }

  getProfileRenderData(viewport: Viewport): AnchoredVolumeProfileRenderData | null {
    if (!this.isValid() || !this._series) {
      return null;
    }

    const anchorPoint = this.anchorToPixel(this._anchors[0], viewport);
    if (!anchorPoint) {
      return null;
    }

    const bars = resolveSeriesBars(this._series.data() as readonly SeriesDatumLike[]);
    const startIndex = findNearestBarIndex(bars, this._anchors[0].time);
    if (startIndex < 0 || startIndex >= bars.length) {
      return null;
    }

    const selectedBars = bars.slice(startIndex);
    const profile = buildVolumeProfile(selectedBars, this._anchoredVolumeProfileOptions.bucketCount ?? 24);
    if (!profile) {
      return null;
    }

    const lastBar = selectedBars[selectedBars.length - 1];
    const lastX = viewport.timeScale.timeToCoordinate(lastBar.time);
    if (lastX === null) {
      return null;
    }

    const top = viewport.priceScale.priceToCoordinate(profile.maxPrice);
    const bottom = viewport.priceScale.priceToCoordinate(profile.minPrice);
    if (top === null || bottom === null) {
      return null;
    }

    return {
      left: Math.min(anchorPoint.x, lastX),
      right: Math.max(anchorPoint.x, lastX),
      top: Math.min(top, bottom),
      bottom: Math.max(top, bottom),
      profile,
    };
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const data = this.getProfileRenderData(viewport);
    if (!data) {
      return [];
    }

    return [{
      type: 'rectangle',
      topLeft: { x: data.left, y: data.top },
      width: data.right - data.left,
      height: data.bottom - data.top,
    } as RectangleGeometry];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const data = this.getProfileRenderData(viewport);
    if (!data) {
      return false;
    }

    const profileWidth = this._anchoredVolumeProfileOptions.profileWidth ?? 72;
    const side = this._anchoredVolumeProfileOptions.side ?? 'right';
    const histogramLeft = side === 'right' ? data.right - profileWidth : data.left;
    const histogramRight = side === 'right' ? data.right : data.left + profileWidth;

    return (
      (point.x >= data.left && point.x <= data.right && point.y >= data.top && point.y <= data.bottom) ||
      (point.x >= histogramLeft && point.x <= histogramRight && point.y >= data.top && point.y <= data.bottom)
    );
  }

  override toJSON(): SerializedDrawing {
    return {
      ...super.toJSON(),
      options: { ...this._anchoredVolumeProfileOptions },
    };
  }

  override fromJSON(data: SerializedDrawing): void {
    super.fromJSON(data);
    this._anchoredVolumeProfileOptions = { ...this._anchoredVolumeProfileOptions, ...data.options };
  }

  override clone(newId: string): IDrawing {
    return new AnchoredVolumeProfile(newId, [...this._anchors], { ...this._style }, { ...this._anchoredVolumeProfileOptions });
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
