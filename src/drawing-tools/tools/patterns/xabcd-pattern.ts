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

export interface PatternDefaults {
  lineColor: string;
  fillColor: string;
  filled: boolean;
}

/** A ratio shown at the middle of the guide line joining two vertices; `value` receives every vertex price. */
export interface RatioSpec {
  pair: [number, number];
  value: (prices: number[]) => number | null;
}

export interface PatternLabel {
  text: string;
  /** Centre of the label box for ratio labels; the point the label hangs from for vertex labels. */
  position: Point;
  /** Vertex labels only: whether the box sits above the point. */
  above?: boolean;
}

export class XABCDPattern extends PatternDrawing<XABCDPatternOptions> {
  readonly type: string = 'xabcd-pattern';
  /** One entry per vertex; an empty string draws no label. */
  readonly anchorLabels: readonly string[] = ['X', 'A', 'B', 'C', 'D'];
  protected readonly ratioDecimals: number = 3;

  protected _patternOptions: XABCDPatternOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<XABCDPatternOptions> = {},
    defaults: PatternDefaults = { lineColor: XABCD_LINE_COLOR, fillColor: XABCD_FILL_COLOR, filled: true }
  ) {
    const { filled, showLabels, textColor, fontSize, bold, italic, visibility, ...baseOptions } = options;
    super(id, anchors, { lineColor: defaults.lineColor, lineWidth: 1, fillColor: defaults.fillColor, ...style }, baseOptions);

    this._patternOptions = {
      ...this._options,
      filled: filled ?? defaults.filled,
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

  protected get requiredPoints(): number {
    return this.anchorLabels.length;
  }

  /** Vertex index pairs joined by dotted guide lines. */
  protected get guidePairs(): Array<[number, number]> {
    return [[0, 2], [1, 3], [0, 4], [2, 4]];
  }

  /** Vertex index lists of the filled polygons. */
  protected get fillShapes(): number[][] {
    return [[0, 1, 2], [2, 3, 4]];
  }

  /** Ratios are taken on price: AB/XA, BC/AB, CD/BC and AD/XA. */
  protected get ratioSpecs(): RatioSpec[] {
    return [
      { pair: [0, 2], value: ([x, a, b]) => safeRatio(b - a, a - x) },
      { pair: [1, 3], value: ([, a, b, c]) => safeRatio(c - b, b - a) },
      { pair: [2, 4], value: ([, , b, c, d]) => safeRatio(d - c, c - b) },
      { pair: [0, 4], value: ([x, a, , , d]) => safeRatio(d - a, a - x) },
    ];
  }

  override isValid(): boolean {
    return this._anchors.length >= this.requiredPoints;
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
    if (points.length < this.requiredPoints) return [];
    return this.guidePairs.map(([a, b]) => [points[a], points[b]]);
  }

  getFilledPolygons(viewport: Viewport): Point[][] {
    const points = this.getPatternPoints(viewport);
    if (points.length < this.requiredPoints) return [];
    return this.fillShapes.map((shape) => shape.map((i) => points[i]));
  }

  getRatioLabels(viewport: Viewport): PatternLabel[] {
    const points = this.getPatternPoints(viewport);
    if (points.length < this.requiredPoints) return [];
    const prices = this._anchors.map((anchor) => anchor.price);
    return this.ratioSpecs.map(({ pair, value }) => ({
      text: formatRatio(value(prices), this.ratioDecimals),
      position: midpoint(points[pair[0]], points[pair[1]]),
    }));
  }

  /** A vertex label sits above its point when the price moved up into it (the first one compares with the next point). */
  getVertexLabels(viewport: Viewport): PatternLabel[] {
    const points = this.getPatternPoints(viewport);
    if (points.length < this.requiredPoints) return [];
    const prices = this._anchors.map((anchor) => anchor.price);
    const labels: PatternLabel[] = [];
    points.forEach((position, i) => {
      const text = this.anchorLabels[i];
      if (!text) return;
      labels.push({ text, position, above: i === 0 ? prices[0] > prices[1] : prices[i] > prices[i - 1] });
    });
    return labels;
  }

  override computeGeometry(): never[] {
    return [];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getPatternPoints(viewport);
    if (points.length < this.requiredPoints) return false;

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
