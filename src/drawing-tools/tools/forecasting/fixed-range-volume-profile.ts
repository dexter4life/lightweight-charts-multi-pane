import type { IChartApi } from '../../../api/create-chart';
import type { DataChangedHandler, ISeriesApi } from '../../../api/iseries-api';
import type { IPrimitivePaneView } from '../../../model/ipane-primitive';
import type { SeriesType } from '../../../model/series-options';

import { Drawing } from '../../core/drawing';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { Geometry, RectangleGeometry } from '../../core/geometry';
import type { SeriesDatumLike, VolumeProfileData } from './data-utils';
import { buildVolumeProfile, resolveSeriesBars, sliceBarsInRange } from './data-utils';
import { FixedRangeVolumeProfilePaneView } from './fixed-range-volume-profile-pane-view';

export interface FixedRangeVolumeProfileOptions extends DrawingOptions {
  bucketCount?: number;
  side?: 'left' | 'right';
  profileWidth?: number;
  showPoc?: boolean;
  upColor?: string;
  downColor?: string;
  rangeFillColor?: string;
}

export interface VolumeProfileRenderData {
  left: number;
  right: number;
  top: number;
  bottom: number;
  profile: VolumeProfileData;
}

export class FixedRangeVolumeProfile extends Drawing {
  readonly type = 'fixed-range-volume-profile';

  protected static readonly REQUIRED_ANCHORS = 2;

  private _fixedRangeVolumeProfileOptions: FixedRangeVolumeProfileOptions;
  private _dataChangedHandler: DataChangedHandler | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FixedRangeVolumeProfileOptions> = {}
  ) {
    const { bucketCount, side, profileWidth, showPoc, upColor, downColor, rangeFillColor, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._fixedRangeVolumeProfileOptions = {
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

  get fixedRangeVolumeProfileOptions(): FixedRangeVolumeProfileOptions {
    return this._fixedRangeVolumeProfileOptions;
  }

  setFixedRangeVolumeProfileOptions(options: Partial<FixedRangeVolumeProfileOptions>): void {
    this._fixedRangeVolumeProfileOptions = { ...this._fixedRangeVolumeProfileOptions, ...options };
    super.updateOptions(options);
  }

  override updateOptions(options: Partial<FixedRangeVolumeProfileOptions>): void {
    this._fixedRangeVolumeProfileOptions = { ...this._fixedRangeVolumeProfileOptions, ...options };
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
    return this._anchors.length >= FixedRangeVolumeProfile.REQUIRED_ANCHORS;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new FixedRangeVolumeProfilePaneView(this)];
  }

  getProfileRenderData(viewport: Viewport): VolumeProfileRenderData | null {
    if (!this.isValid() || !this._series) {
      return null;
    }

    const start = this.anchorToPixel(this._anchors[0], viewport);
    const end = this.anchorToPixel(this._anchors[1], viewport);
    if (!start || !end) {
      return null;
    }

    const bars = resolveSeriesBars(this._series.data() as readonly SeriesDatumLike[]);
    const selectedBars = sliceBarsInRange(bars, this._anchors[0].time, this._anchors[1].time);
    const profile = buildVolumeProfile(selectedBars, this._fixedRangeVolumeProfileOptions.bucketCount ?? 24);

    if (!profile) {
      return null;
    }

    const top = viewport.priceScale.priceToCoordinate(profile.maxPrice);
    const bottom = viewport.priceScale.priceToCoordinate(profile.minPrice);
    if (top === null || bottom === null) {
      return null;
    }

    return {
      left: Math.min(start.x, end.x),
      right: Math.max(start.x, end.x),
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

    const profileWidth = this._fixedRangeVolumeProfileOptions.profileWidth ?? 72;
    const side = this._fixedRangeVolumeProfileOptions.side ?? 'right';
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
      options: { ...this._fixedRangeVolumeProfileOptions },
    };
  }

  override fromJSON(data: SerializedDrawing): void {
    super.fromJSON(data);
    this._fixedRangeVolumeProfileOptions = { ...this._fixedRangeVolumeProfileOptions, ...data.options };
  }

  override clone(newId: string): IDrawing {
    return new FixedRangeVolumeProfile(newId, [...this._anchors], { ...this._style }, { ...this._fixedRangeVolumeProfileOptions });
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
