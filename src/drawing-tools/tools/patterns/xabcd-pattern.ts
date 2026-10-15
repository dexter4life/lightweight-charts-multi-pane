import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PatternDrawing } from './pattern-base';
import { XABCDPatternPaneView } from './xabcd-pattern-pane-view';
import { midpoint } from '../../core/geometry';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline, formatRatio, isPointInPolygon, safeRatio } from './pattern-utils';

export interface XABCDPatternOptions extends DrawingOptions {
  /** Fills the X-A-B and B-C-D triangles with `style.fillColor`. */
  filled?: boolean;
  showLabels?: boolean;
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  visibility?: VisibilityMap;
}

export const XABCD_LINE_COLOR = '#2962FF';
export const XABCD_FILL_COLOR = 'rgba(41, 98, 255, 0.15)';

export interface PatternLabel {
  text: string;
  /** Centre of the label box for ratio labels; the point the label hangs from for vertex labels. */
  position: Point;
  /** Vertex labels only: whether the box sits above the point. */
  above?: boolean;
}

export class XABCDPattern extends PatternDrawing<XABCDPatternOptions> {
  readonly type = 'xabcd-pattern';
  readonly anchorLabels = ['X', 'A', 'B', 'C', 'D'] as const;

  protected _patternOptions: XABCDPatternOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<XABCDPatternOptions> = {}
  ) {
    const { filled, showLabels, textColor, fontSize, bold, italic, visibility, ...baseOptions } = options;
    super(id, anchors, { lineColor: XABCD_LINE_COLOR, lineWidth: 1, fillColor: XABCD_FILL_COLOR, ...style }, baseOptions);

    this._patternOptions = {
      ...this._options,
      filled: filled ?? true,
      showLabels: showLabels ?? true,
      textColor: textColor ?? '#ffffff',
      fontSize: fontSize ?? 12,
      bold: bold ?? false,
      italic: italic ?? false,
      visibility,
    };
  }

  get xabcdPatternOptions(): XABCDPatternOptions {
    return this._patternOptions;
  }

  setXABCDPatternOptions(options: Partial<XABCDPatternOptions>): void {
    this.updatePatternOptions(options);
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._patternOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._patternOptions, visible: this._options.visible, locked: this._options.locked } };
  }

  override isValid(): boolean {
    return this._anchors.length >= 5;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new XABCDPatternPaneView(this)];
  }

  getPatternPoints(viewport: Viewport): Point[] {
    if (!this.isValid()) return [];

    return this._anchors
      .map((anchor) => this.anchorToPixel(anchor, viewport))
      .filter((point): point is Point => point !== null);
  }

  getGuideLines(viewport: Viewport): Array<[Point, Point]> {
    const points = this.getPatternPoints(viewport);
    if (points.length < 5) return [];

    return [
      [points[0], points[2]],
      [points[1], points[3]],
      [points[0], points[4]],
      [points[2], points[4]],
    ];
  }

  getFilledPolygons(viewport: Viewport): Point[][] {
    const points = this.getPatternPoints(viewport);
    if (points.length < 5) return [];
    return [
      [points[0], points[1], points[2]],
      [points[2], points[3], points[4]],
    ];
  }

  /** Ratios are taken on price: AB/XA, BC/AB, CD/BC and AD/XA, each drawn at the middle of its guide line. */
  getRatioLabels(viewport: Viewport): PatternLabel[] {
    const points = this.getPatternPoints(viewport);
    if (points.length < 5) return [];

    const [x, a, b, c, d] = this._anchors.map((anchor) => anchor.price);
    const text = (n: number, m: number) => formatRatio(safeRatio(n, m));
    return [
      { text: text(b - a, a - x), position: midpoint(points[0], points[2]) },
      { text: text(c - b, b - a), position: midpoint(points[1], points[3]) },
      { text: text(d - c, c - b), position: midpoint(points[2], points[4]) },
      { text: text(d - a, a - x), position: midpoint(points[0], points[4]) },
    ];
  }

  /** A vertex label sits above its point when the price moved up into it (the first one compares with the next point). */
  getVertexLabels(viewport: Viewport): PatternLabel[] {
    const points = this.getPatternPoints(viewport);
    if (points.length < 5) return [];
    const prices = this._anchors.map((anchor) => anchor.price);
    return points.map((position, i) => ({
      text: this.anchorLabels[i],
      position,
      above: i === 0 ? prices[0] > prices[1] : prices[i] > prices[i - 1],
    }));
  }

  override computeGeometry(): never[] {
    return [];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getPatternPoints(viewport);
    if (points.length < 5) return false;

    if (distanceToPolyline(point, points) <= PATTERN_HIT_THRESHOLD) return true;

    for (const [start, end] of this.getGuideLines(viewport)) {
      if (distanceToPolyline(point, [start, end]) <= PATTERN_HIT_THRESHOLD) return true;
    }

    return this._patternOptions.filled
      ? this.getFilledPolygons(viewport).some((polygon) => isPointInPolygon(point, polygon))
      : false;
  }

  override clone(newId: string): IDrawing {
    return new XABCDPattern(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
  }
}
