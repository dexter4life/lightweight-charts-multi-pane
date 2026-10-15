import type { IChartApi } from '../../api/create-chart';
import type { ISeriesApi } from '../../api/iseries-api';
import type { Time } from '../../model/horz-scale-behavior-time/types';
import type { Logical } from '../../model/time-data';
import type {
  IPrimitivePaneView,
  PrimitiveHoveredItem,
  PrimitivePaneViewZOrder,
} from '../../model/ipane-primitive';
import type { AutoscaleInfo, SeriesType } from '../../model/series-options';

import { DrawingAxisViews } from './axis-views';
import { createFractionalMapper } from './fractional-logical';
import type { Geometry } from './geometry';
import type {
  Anchor,
  ControlPoint,
  DrawingOptions,
  DrawingState,
  DrawingStyle,
  IDrawing,
  Point,
  SerializedDrawing,
  Viewport,
} from './types';
import { DEFAULT_DRAWING_STYLE } from './types';

export interface PriceTag {
  price: number;
  backColor: string;
}

/**
 * Abstract base class for all drawing tools.
 * Implements ISeriesPrimitive for integration with lightweight-charts.
 */
export abstract class Drawing implements IDrawing {
  readonly id: string;
  abstract readonly type: string;

  protected _anchors: Anchor[] = [];
  protected _style: DrawingStyle;
  protected _options: DrawingOptions;
  protected _state: DrawingState = 'normal';
  protected _placedCount: number | null = null;

  protected _series: ISeriesApi<SeriesType> | null = null;
  protected _chart: IChartApi | null = null;
  protected _container: HTMLElement | null = null;
  protected _requestUpdateFn: (() => void) | null = null;
  private readonly _axisViews = new DrawingAxisViews(this);

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<DrawingOptions> = {}
  ) {
    this.id = id;
    this._anchors = [...anchors];
    this._style = { ...DEFAULT_DRAWING_STYLE, ...style };
    this._options = {
      visible: true,
      locked: false,
      zIndex: 0,
      extendLeft: false,
      extendRight: false,
      ...options,
    };
  }

  // ============ Getters/Setters ============

  get anchors(): Anchor[] {
    return this._anchors;
  }

  get style(): DrawingStyle {
    return this._style;
  }

  get options(): DrawingOptions {
    return this._options;
  }

  get state(): DrawingState {
    return this._state;
  }

  set anchors(value: Anchor[]) {
    this._anchors = [...value];
    this.requestUpdate();
  }

  set style(value: DrawingStyle) {
    this._style = { ...value };
    this.requestUpdate();
  }

  set options(value: DrawingOptions) {
    this._options = { ...value };
    this.requestUpdate();
  }

  /** Whether price-axis tags stay visible while the drawing is not selected. */
  showsIdlePriceLabels(): boolean {
    return false;
  }

  /** Whether the selected drawing shows price/time tags on the axes (the extent band is always shown). */
  showsAxisTags(): boolean {
    return true;
  }

  /** Replaces the per-anchor price tags with custom ones (e.g. take-profit/stop levels); null keeps the anchor tags. */
  customPriceTags(): PriceTag[] | null {
    return null;
  }

  /** Whether the selected drawing highlights its price extent on the price axis. */
  showsPriceBand(): boolean {
    return true;
  }

  /** Extra per-drawing visibility gate (e.g. interval visibility) beyond `options.visible`. */
  isDisplayed(): boolean {
    return true;
  }

  /** While a drawing is being placed, only the first N anchors are committed (shown as handles / axis tags). */
  get placedCount(): number | null {
    return this._placedCount;
  }

  set placedCount(value: number | null) {
    this._placedCount = value;
    this.requestUpdate();
  }

  set state(value: DrawingState) {
    this._state = value;
    this.requestUpdate();
  }

  // ============ Lifecycle ============

  attach(series: ISeriesApi<SeriesType>, chart: IChartApi, container?: HTMLElement): void {
    if (this._series) {
      this.detach();
    }
    this._series = series;
    this._chart = chart;
    this._container = container ?? null;
    series.attachPrimitive(this);
  }

  detach(): void {
    if (this._series) {
      this._series.detachPrimitive(this);
      this._series = null;
      this._chart = null;
      this._container = null;
      this._requestUpdateFn = null;
    }
  }

  isAttached(): boolean {
    return this._series !== null;
  }

  // ============ ISeriesPrimitive Implementation ============

  requestUpdate(): void {
    if (this._requestUpdateFn) {
      this._requestUpdateFn();
    }
  }

  attached(params: { chart: IChartApi; series: ISeriesApi<SeriesType>; requestUpdate: () => void }): void {
    this._chart = params.chart;
    this._series = params.series;
    this._requestUpdateFn = params.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._container = null;
    this._requestUpdateFn = null;
  }

  /**
   * Returns pane views for rendering. Must be implemented by subclasses.
   */
  abstract paneViews(): IPrimitivePaneView[];

  priceAxisViews() {
    return this._axisViews.priceLabels;
  }

  timeAxisViews() {
    return this._axisViews.timeLabels;
  }

  priceAxisPaneViews(): readonly IPrimitivePaneView[] {
    return this._axisViews.priceBand;
  }

  timeAxisPaneViews(): readonly IPrimitivePaneView[] {
    return this._axisViews.timeBand;
  }

  /**
   * Optional: Provide hit testing for the primitive (lightweight-charts interface)
   */
  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const viewport = this.getViewport();
    if (!viewport) return null;

    const point: Point = { x, y };
    const hit = this.testHit(point, viewport);

    if (hit) {
      return {
        cursorStyle: this._options.locked ? 'default' : 'pointer',
        externalId: this.id,
        zOrder: 'normal' as PrimitivePaneViewZOrder,
      };
    }

    return null;
  }

  /**
   * Optional: Provide autoscale info
   */
  autoscaleInfo(): AutoscaleInfo | null {
    if (this._anchors.length === 0) return null;

    const prices = this._anchors.map((a) => a.price);
    return {
      priceRange: {
        minValue: Math.min(...prices),
        maxValue: Math.max(...prices),
      },
    };
  }

  // ============ State Management ============

  setAnchors(anchors: Anchor[]): void {
    this._anchors = [...anchors];
    this.requestUpdate();
  }

  /** Called when a control point is grabbed, with the pointer in pane pixels. Subclasses may record a grab offset. */
  grabControlPoint(_index: number, _point: Point): void {}

  /** Pointer drag of a control point. `anchor` is the resolved (magnet-snapped) pointer position, null outside the data. */
  dragControlPoint(index: number, _point: Point, anchor: Anchor | null, _viewport: Viewport): void {
    if (anchor) this.updateAnchor(index, anchor);
  }

  /** Pixel position of every anchor when a body drag starts; null cancels the drag. */
  bodyDragOrigin(viewport: Viewport): Point[] | null {
    const origin: Point[] = [];
    for (const anchor of this._anchors) {
      const x = viewport.timeScale.timeToCoordinate(anchor.time);
      const y = viewport.priceScale.priceToCoordinate(anchor.price);
      if (x === null || y === null) return null;
      origin.push({ x, y });
    }
    return origin;
  }

  /** Anchors after a body drag moved the grabbed drawing by (dx, dy) pixels; null skips the frame. */
  bodyDragAnchors(origin: Point[], dx: number, dy: number, viewport: Viewport): Anchor[] | null {
    const next: Anchor[] = [];
    for (const o of origin) {
      const time = viewport.timeScale.coordinateToTime(o.x + dx);
      const price = viewport.priceScale.coordinateToPrice(o.y + dy);
      if (time === null || price === null) return null;
      next.push({ time, price });
    }
    return next;
  }

  updateAnchor(index: number, anchor: Anchor): void {
    if (index >= 0 && index < this._anchors.length) {
      this._anchors[index] = { ...anchor };
      this.requestUpdate();
    }
  }

  updateStyle(style: Partial<DrawingStyle>): void {
    this._style = { ...this._style, ...style };
    this.requestUpdate();
  }

  updateOptions(options: Partial<DrawingOptions>): void {
    this._options = { ...this._options, ...options };
    this.requestUpdate();
  }

  setState(state: DrawingState): void {
    this._state = state;
    this.requestUpdate();
  }

  // ============ Hit Testing ============

  /**
   * Test if point hits the drawing. Must be implemented by subclasses.
   */
  abstract testHit(point: Point, viewport: Viewport): boolean;

  /**
   * Test if point hits an anchor control point
   */
  hitTestAnchor(point: Point, viewport: Viewport): number | null {
    const controlPoints = this.getControlPoints(viewport);
    const threshold = 8; // pixels

    for (const cp of controlPoints) {
      const dx = point.x - cp.x;
      const dy = point.y - cp.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= threshold) {
        return cp.index;
      }
    }

    return null;
  }

  /**
   * Get control points for anchor manipulation
   */
  getControlPoints(viewport: Viewport): ControlPoint[] {
    const points: ControlPoint[] = [];

    const count = this._placedCount ?? this._anchors.length;
    for (let i = 0; i < Math.min(count, this._anchors.length); i++) {
      const anchor = this._anchors[i];
      const pixel = this.anchorToPixel(anchor, viewport);

      if (pixel) {
        points.push({
          index: i,
          x: pixel.x,
          y: pixel.y,
          radius: 6,
        });
      }
    }

    return points;
  }

  // ============ Coordinate Conversion ============

  anchorToPixel(anchor: Anchor, viewport: Viewport): Point | null {
    const x =
      anchor.logical !== undefined
        ? viewport.timeScale.logicalToCoordinate(anchor.logical as Logical)
        : viewport.timeScale.timeToCoordinate(anchor.time);
    const y = viewport.priceScale.priceToCoordinate(anchor.price);

    if (x === null || y === null) return null;

    return { x, y };
  }

  protected pixelToAnchor(point: Point, viewport: Viewport): Anchor | null {
    const time = viewport.timeScale.coordinateToTime(point.x);
    const price = viewport.priceScale.coordinateToPrice(point.y);

    if (time === null || price === null) return null;

    return { time, price };
  }

  getViewport(): Viewport | null {
    if (!this._chart || !this._series) return null;

    const timeScale = this._chart.timeScale();
    const height = this._container?.clientHeight ?? 400;
    let mapper: ReturnType<typeof createFractionalMapper> | undefined;

    return {
      width: timeScale.width(),
      height,
      timeScale: {
        coordinateToTime: (x: number) => timeScale.coordinateToTime(x),
        timeToCoordinate: (time: Time) => timeScale.timeToCoordinate(time),
        logicalToCoordinate: (logical) => {
          if (Number.isInteger(logical)) return timeScale.logicalToCoordinate(logical);
          mapper ??= createFractionalMapper(timeScale);
          const x = mapper?.toX(logical) ?? null;
          return x === null ? null : (x as never);
        },
      },
      priceScale: {
        coordinateToPrice: (y: number) => this._series!.coordinateToPrice(y),
        priceToCoordinate: (price: number) => this._series!.priceToCoordinate(price),
      },
    };
  }

  // ============ Geometry ============

  /**
   * Compute geometry for rendering. Must be implemented by subclasses.
   */
  abstract computeGeometry(viewport: Viewport): Geometry[];

  // ============ Validation ============

  /**
   * Check if drawing is valid (has required anchors). Must be implemented by subclasses.
   */
  abstract isValid(): boolean;

  // ============ Serialization ============

  toJSON(): SerializedDrawing {
    return {
      id: this.id,
      type: this.type,
      anchors: [...this._anchors],
      style: { ...this._style },
      options: { ...this._options },
    };
  }

  fromJSON(data: SerializedDrawing): void {
    this._anchors = [...data.anchors];
    this._style = { ...DEFAULT_DRAWING_STYLE, ...data.style };
    this._options = { ...this._options, ...data.options };
    this.requestUpdate();
  }

  // ============ Clone ============

  /**
   * Create a clone of this drawing. Must be implemented by subclasses.
   */
  abstract clone(newId: string): IDrawing;
}
