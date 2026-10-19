import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { defaultFontFamily as FONT_FAMILY } from '../../../helpers/make-font';
import { Drawing } from '../../core/drawing';
import type { Geometry, LineGeometry } from '../../core/geometry';
import type { Anchor, ControlPoint, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { GannBoxPaneView } from './gann-box-pane-view';

/** Gann price levels (re-exported for public API compatibility). */
export { GANN_LEVELS } from './constants';

export interface GannBoxLevel {
  value: number;
  enabled: boolean;
  color: string;
}

export interface GannBoxOptions extends DrawingOptions {
  priceLevels?: GannBoxLevel[];
  timeLevels?: GannBoxLevel[];
  showLeftLabels?: boolean;
  showRightLabels?: boolean;
  showTopLabels?: boolean;
  showBottomLabels?: boolean;
  fillHorzBackground?: boolean;
  horzOpacity?: number;
  fillVertBackground?: boolean;
  vertOpacity?: number;
  showFans?: boolean;
  fansColor?: string;
  reverse?: boolean;
  fontSize?: number;
  visibility?: VisibilityMap;
}

const GREY = '#787B86';
const LEVEL_DEFAULTS: Array<[number, string]> = [
  [0, GREY],
  [0.25, '#FF9800'],
  [0.382, '#00bcd4'],
  [0.5, '#4caf50'],
  [0.618, '#089981'],
  [0.75, '#2962FF'],
  [1, GREY],
];

export const defaultGannBoxLevels = (): GannBoxLevel[] =>
  LEVEL_DEFAULTS.map(([value, color]) => ({ value, enabled: true, color }));

export const DEFAULT_GANN_BOX_OPTIONS = {
  showLeftLabels: true,
  showRightLabels: true,
  showTopLabels: true,
  showBottomLabels: true,
  fillHorzBackground: true,
  horzOpacity: 0.2,
  fillVertBackground: true,
  vertOpacity: 0.2,
  showFans: false,
  fansColor: '#9598A1',
  reverse: false,
  fontSize: 12,
};

export interface GannBoxLevelLine {
  level: GannBoxLevel;
  /** Pixel coordinate along the axis the level is laid out on (y for price, x for time). */
  pos: number;
}

export interface GannBoxLayout {
  a: Point;
  b: Point;
  left: number;
  right: number;
  top: number;
  bottom: number;
  price: GannBoxLevelLine[];
  time: GannBoxLevelLine[];
}

export interface GannBoxLabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type GannBoxLabelSide = 'left' | 'right' | 'top' | 'bottom';

export const GANN_LABEL = {
  /** Gap between the box edge and a left or right label. */
  sideGap: 9,
  /** Distance from the box edge to the vertical centre of a top label. */
  topGap: 12.5,
  /** Distance from the box edge to the vertical centre of a bottom label. */
  bottomGap: 15,
};

const HIT_THRESHOLD = 3;

let measureCtx: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, size: number): number {
  if (measureCtx === undefined) {
    measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  if (!measureCtx) return text.length * size * 0.56;
  measureCtx.font = `${size}px ${FONT_FAMILY}`;
  return measureCtx.measureText(text).width;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + s * dx), p.y - (a.y + s * dy));
}

/**
 * Gann Box: level 0 sits on the first point and level 1 on the second, on both axes.
 * Horizontal lines are laid out by price, vertical lines by time; `reverse` swaps the two origins.
 */
export class GannBox extends Drawing {
  readonly type: string = 'gann-box';

  protected static readonly REQUIRED_ANCHORS = 2;

  private _gannOptions: GannBoxOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<GannBoxOptions> = {}
  ) {
    const { visible, locked, zIndex } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    if (zIndex !== undefined) base.zIndex = zIndex;
    super(id, anchors, { lineColor: GREY, lineWidth: 1, lineDash: [], ...style }, base);

    const defined = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
    this._gannOptions = {
      ...DEFAULT_GANN_BOX_OPTIONS,
      ...defined,
      priceLevels: (options.priceLevels ?? defaultGannBoxLevels()).map((l) => ({ ...l })),
      timeLevels: (options.timeLevels ?? defaultGannBoxLevels()).map((l) => ({ ...l })),
    };
  }

  get gannOptions(): GannBoxOptions {
    return this._gannOptions;
  }

  setGannOptions(options: Partial<GannBoxOptions>): void {
    this._gannOptions = { ...this._gannOptions, ...options };
    const { visible, locked } = options;
    const base: Partial<DrawingOptions> = {};
    if (visible !== undefined) base.visible = visible;
    if (locked !== undefined) base.locked = locked;
    this._options = { ...this._options, ...base };
    this.requestUpdate();
  }

  /** The floating toolbar recolours every level at once and styles all the lines. */
  applyUniformStyle(patch: { color?: string; width?: number; dash?: number[] }): void {
    if (patch.color) {
      const color = patch.color;
      this._gannOptions = {
        ...this._gannOptions,
        fansColor: color,
        priceLevels: (this._gannOptions.priceLevels ?? []).map((l) => ({ ...l, color })),
        timeLevels: (this._gannOptions.timeLevels ?? []).map((l) => ({ ...l, color })),
      };
    }
    this.updateStyle({
      ...(patch.width !== undefined ? { lineWidth: patch.width } : {}),
      ...(patch.dash ? { lineDash: patch.dash } : {}),
    });
  }

  setInterval(unit: IntervalUnit, multiplier: number): void {
    this._interval = { unit, multiplier };
    this.requestUpdate();
  }

  override isDisplayed(): boolean {
    const map = this._gannOptions.visibility;
    if (!map || !this._interval) return true;
    const rule = map[this._interval.unit];
    if (!rule) return true;
    return rule.enabled && this._interval.multiplier >= rule.min && this._interval.multiplier <= rule.max;
  }

  isValid(): boolean {
    return this._anchors.length >= GannBox.REQUIRED_ANCHORS;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new GannBoxPaneView(this), new GannBoxPaneView(this, 'handles')];
  }

  /** While placing, the reference shows a handle on the cursor point as well. */
  override getControlPoints(viewport: Viewport): ControlPoint[] {
    const points: ControlPoint[] = [];
    this._anchors.forEach((anchor, index) => {
      const p = this.anchorToPixel(anchor, viewport);
      if (p) points.push({ index, x: p.x, y: p.y, radius: 6 });
    });
    return points;
  }

  layout(viewport: Viewport): GannBoxLayout | null {
    if (!this.isValid()) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;

    const o = this._gannOptions;
    const origin = o.reverse ? b : a;
    const far = o.reverse ? a : b;
    const place = (levels: GannBoxLevel[] | undefined, from: number, to: number): GannBoxLevelLine[] =>
      (levels ?? [])
        .filter((l) => l.enabled)
        .map((level) => ({ level, pos: from + level.value * (to - from) }))
        .sort((p, q) => p.level.value - q.level.value);

    return {
      a,
      b,
      left: Math.min(a.x, b.x),
      right: Math.max(a.x, b.x),
      top: Math.min(a.y, b.y),
      bottom: Math.max(a.y, b.y),
      price: place(o.priceLevels, origin.y, far.y),
      time: place(o.timeLevels, origin.x, far.x),
    };
  }

  /** Every diagonal the Angles option draws: each corner to the level marks on the two far edges. */
  fanLines(layout: GannBoxLayout): Array<[Point, Point]> {
    const { left, right, top, bottom } = layout;
    const lines: Array<[Point, Point]> = [];
    const xs = layout.time.map((l) => l.pos);
    const ys = layout.price.map((l) => l.pos);
    const corners: Array<{ p: Point; xEdge: number; yEdge: number }> = [
      { p: { x: left, y: top }, xEdge: right, yEdge: bottom },
      { p: { x: right, y: top }, xEdge: left, yEdge: bottom },
      { p: { x: left, y: bottom }, xEdge: right, yEdge: top },
      { p: { x: right, y: bottom }, xEdge: left, yEdge: top },
    ];
    for (const c of corners) {
      for (const y of ys) lines.push([c.p, { x: c.xEdge, y }]);
      for (const x of xs) lines.push([c.p, { x, y: c.yEdge }]);
    }
    return lines;
  }

  /** Text boxes of the visible labels, shared by the hit test and the renderer. */
  labelRects(layout: GannBoxLayout): Array<{ text: string; color: string; side: GannBoxLabelSide; rect: GannBoxLabelRect }> {
    const o = this._gannOptions;
    const size = o.fontSize ?? 12;
    const h = size * 1.2;
    const out: Array<{ text: string; color: string; side: GannBoxLabelSide; rect: GannBoxLabelRect }> = [];
    for (const l of layout.price) {
      const text = String(l.level.value);
      const w = textWidth(text, size);
      const color = l.level.color;
      if (o.showLeftLabels !== false) out.push({ text, color, side: 'left', rect: { x: layout.left - GANN_LABEL.sideGap - w, y: l.pos - h / 2, w, h } });
      if (o.showRightLabels !== false) out.push({ text, color, side: 'right', rect: { x: layout.right + GANN_LABEL.sideGap, y: l.pos - h / 2, w, h } });
    }
    for (const l of layout.time) {
      const text = String(l.level.value);
      const w = textWidth(text, size);
      const color = l.level.color;
      if (o.showTopLabels !== false) out.push({ text, color, side: 'top', rect: { x: l.pos - w / 2, y: layout.top - GANN_LABEL.topGap - h / 2, w, h } });
      if (o.showBottomLabels !== false) out.push({ text, color, side: 'bottom', rect: { x: l.pos - w / 2, y: layout.bottom + GANN_LABEL.bottomGap - h / 2, w, h } });
    }
    return out;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    const layout = this.layout(viewport);
    if (!layout) return [];
    const geometries: Geometry[] = [];
    for (const l of layout.price) {
      geometries.push({ type: 'line', start: { x: layout.left, y: l.pos }, end: { x: layout.right, y: l.pos } } as LineGeometry);
    }
    for (const l of layout.time) {
      geometries.push({ type: 'line', start: { x: l.pos, y: layout.top }, end: { x: l.pos, y: layout.bottom } } as LineGeometry);
    }
    return geometries;
  }

  testHit(point: Point, viewport: Viewport): boolean {
    if (!this.isDisplayed()) return false;
    const layout = this.layout(viewport);
    if (!layout) return false;
    const { left, right, top, bottom } = layout;

    const inX = point.x >= left - HIT_THRESHOLD && point.x <= right + HIT_THRESHOLD;
    const inY = point.y >= top - HIT_THRESHOLD && point.y <= bottom + HIT_THRESHOLD;
    if (inX && layout.price.some((l) => Math.abs(point.y - l.pos) <= HIT_THRESHOLD)) return true;
    if (inY && layout.time.some((l) => Math.abs(point.x - l.pos) <= HIT_THRESHOLD)) return true;

    if (this._gannOptions.showFans && this.fanLines(layout).some(([p, q]) => distanceToSegment(point, p, q) <= HIT_THRESHOLD)) {
      return true;
    }
    return this.labelRects(layout).some(
      ({ rect }) => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
    );
  }

  clone(newId: string): IDrawing {
    return new GannBox(newId, [...this._anchors], { ...this._style }, { ...this._options, ...this._gannOptions });
  }

  static create(
    id: string,
    corner1: Anchor,
    corner2: Anchor,
    style?: Partial<DrawingStyle>,
    options?: Partial<GannBoxOptions>
  ): GannBox {
    return new GannBox(id, [corner1, corner2], style, options);
  }

  override toJSON() {
    return { ...super.toJSON(), options: { ...this._options, ...this._gannOptions } };
  }

  override fromJSON(data: any): void {
    super.fromJSON(data);
    if (data.options) this.setGannOptions(data.options);
  }
}
