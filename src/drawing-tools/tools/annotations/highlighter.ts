import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import type { Anchor, ControlPoint, Point, Viewport, DrawingStyle, DrawingOptions, IDrawing } from '../../core/types';
import type { Geometry, PolygonGeometry } from '../../core/geometry';
import { distanceToLineSegment } from '../../core/geometry';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { HighlighterPaneView } from './highlighter-pane-view';

/**
 * Highlighter options
 */
export interface HighlighterOptions extends DrawingOptions {
  highlighterWidth?: number;
  visibility?: VisibilityMap;
}

export const HIGHLIGHTER_COLOR = 'rgba(242, 54, 69, 0.2)';
const HANDLE_RADIUS = 4;

/**
 * Highlighter - Semi-transparent highlight drawing tool.
 *
 * Features:
 * - Multiple anchor points forming a path
 * - Wide, semi-transparent stroke
 * - Ideal for marking important areas
 */
export class Highlighter extends Drawing {
  readonly type = 'highlighter';

  protected static readonly REQUIRED_ANCHORS = 2;
  protected static readonly HIT_THRESHOLD = 2;

  private _highlighterOptions: HighlighterOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<HighlighterOptions> = {}
  ) {
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    super(id, anchors, { lineColor: HIGHLIGHTER_COLOR, ...style }, base);

    this._highlighterOptions = {
      ...this._options,
      highlighterWidth: options.highlighterWidth ?? 20,
      visibility: options.visibility,
    };
  }

  /** Highlights only mark their extent on the axes; no price/time tags. */
  override showsAxisTags(): boolean {
    return false;
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._highlighterOptions.visibility;
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

  get highlighterOptions(): HighlighterOptions {
    return this._highlighterOptions;
  }

  setHighlighterOptions(options: Partial<HighlighterOptions>): void {
    this._highlighterOptions = { ...this._highlighterOptions, ...options };
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
    this.requestUpdate();
  }

  /**
   * Add a point to the highlighter path
   */
  addPoint(anchor: Anchor): void {
    this._anchors.push(anchor);
    this.requestUpdate();
  }

  isValid(): boolean {
    return this._anchors.length >= Highlighter.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new HighlighterPaneView(this)];
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
      if (dist <= Highlighter.HIT_THRESHOLD + (this._highlighterOptions.highlighterWidth ?? 20) / 2) {
        return true;
      }
    }

    return false;
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._highlighterOptions, visible: this._options.visible, locked: this._options.locked } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) {
      this._highlighterOptions = { ...this._highlighterOptions, ...data.options };
    }
  }

  clone(newId: string): IDrawing {
    return new Highlighter(
      newId,
      [...this._anchors],
      { ...this._style },
      { ...this._highlighterOptions }
    );
  }

  static create(
    id: string,
    points: Anchor[],
    style?: Partial<DrawingStyle>,
    options?: Partial<HighlighterOptions>
  ): Highlighter {
    return new Highlighter(id, points, style, options);
  }
}
