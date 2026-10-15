import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, ControlPoint, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry, PolygonGeometry } from '../../core/geometry';
import { distanceToLineSegment } from '../../core/geometry';
import type { IntervalUnit, LineEnd, VisibilityMap } from '../lines/trend-line';
import { BrushPaneView } from './brush-pane-view';

/**
 * Brush options
 */
export interface BrushOptions extends DrawingOptions {
  brushSize?: number;
  smoothing?: number;
  backgroundVisible?: boolean;
  leftEnd?: LineEnd;
  rightEnd?: LineEnd;
  visibility?: VisibilityMap;
}

export const BRUSH_COLOR = '#00BCD4';
export const BRUSH_FILL = 'rgba(0, 188, 212, 0.5)';
const HANDLE_RADIUS = 4;

/**
 * Brush - Freehand drawing tool.
 *
 * Features:
 * - Multiple anchor points forming a path
 * - Variable brush size
 * - Smooth line rendering
 */
export class Brush extends Drawing {
  readonly type = 'brush';

  protected static readonly REQUIRED_ANCHORS = 2;
  protected static readonly HIT_THRESHOLD = 5;

  private _brushOptions: BrushOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<BrushOptions> = {}
  ) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: BRUSH_COLOR, lineWidth: 1, fillColor: BRUSH_FILL, ...style }, base);

    this._brushOptions = {
      ...this._options,
      brushSize: options.brushSize,
      smoothing: options.smoothing ?? 0.5,
      backgroundVisible: options.backgroundVisible ?? false,
      leftEnd: options.leftEnd ?? 'normal',
      rightEnd: options.rightEnd ?? 'normal',
      visibility: options.visibility,
    };
  }

  /** Brush strokes only highlight their extent on the axes; no price/time tags. */
  override showsAxisTags(): boolean {
    return false;
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._brushOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  /** Only the first and last points are handles. */
  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const n = this._anchors.length;
    if (n === 0) return [];
    const out: ControlPoint[] = [];
    for (const index of n === 1 ? [0] : [0, n - 1]) {
      const p = this.anchorToPixel(this._anchors[index], viewport);
      if (p) out.push({ index, x: p.x, y: p.y, radius: HANDLE_RADIUS });
    }
    return out;
  }

  get brushOptions(): BrushOptions {
    return this._brushOptions;
  }

  setBrushOptions(options: Partial<BrushOptions>): void {
    this._brushOptions = { ...this._brushOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  /**
   * Add a point to the brush path
   */
  addPoint(anchor: Anchor): void {
    this._anchors.push(anchor);
    this.requestUpdate();
  }

  isValid(): boolean {
    return this._anchors.length >= Brush.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new BrushPaneView(this)];
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    if (!this.isValid()) return [];

    const points: Point[] = [];
    for (const anchor of this._anchors) {
      const p = this.anchorToPixel(anchor, viewport);
      if (p) points.push(p);
    }

    if (points.length < 2) return [];

    const polygonGeometry: PolygonGeometry = {
      type: 'polygon',
      points,
      closed: false,
    };

    return [polygonGeometry];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isValid() || !this.isDisplayed()) return false;

    const points: Point[] = [];
    for (const anchor of this._anchors) {
      const p = this.anchorToPixel(anchor, viewport);
      if (p) points.push(p);
    }

    // Check if near any segment
    for (let i = 0; i < points.length - 1; i++) {
      const dist = distanceToLineSegment(point, points[i], points[i + 1]);
      if (dist <= Brush.HIT_THRESHOLD + this._style.lineWidth / 2) {
        return true;
      }
    }

    return false;
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._brushOptions, visible: this._options.visible, locked: this._options.locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) {
      this._brushOptions = { ...this._brushOptions, ...data.options };
    }
  }

  clone(newId: string): IDrawing {
    return new Brush(
      newId,
      [...this._anchors],
      { ...this._style },
      { ...this._brushOptions }
    );
  }

  static create(
    id: string,
    points: Anchor[],
    style?: Partial<DrawingStyle>,
    options?: Partial<BrushOptions>
  ): Brush {
    return new Brush(id, points, style, options);
  }
}
