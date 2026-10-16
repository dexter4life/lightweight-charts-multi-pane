import type { IPrimitivePaneView } from '../../../model/ipane-primitive';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { ElliottWavePaneViewBase } from './elliott-wave-pane-view-base';
import { PatternDrawing } from './pattern-base';
import { PATTERN_HIT_THRESHOLD, distanceToPolyline } from './pattern-utils';

export interface ElliottWaveOptions extends DrawingOptions {
  /** Draws the wave polyline; the labels are always shown. */
  showWave?: boolean;
  /** Index into {@link ELLIOTT_DEGREES}; it picks the label style and size. */
  degree?: number;
  visibility?: VisibilityMap;
}

export const ELLIOTT_DEGREES = [
  'Supermillennium',
  'Millennium',
  'Submillennium',
  'Grand supercycle',
  'Supercycle',
  'Cycle',
  'Primary',
  'Intermediate',
  'Minor',
  'Minute',
  'Minuette',
  'Subminuette',
  'Micro',
  'Submicro',
  'Minuscule',
] as const;

export const DEFAULT_ELLIOTT_DEGREE = 7;

export type ElliottLabelKind = 'circle' | 'paren' | 'plain';

export interface ElliottLabelStyle {
  kind: ElliottLabelKind;
  fontSize: number;
  bold: boolean;
  /** Diameter of the ring around a circled label. */
  circleDiameter: number;
  /** Distance from the vertex to the centre of its label. */
  offset: number;
  lowercase: boolean;
  roman: boolean;
  romanLower: boolean;
}

const GROUPS = [
  { fontSize: 24, bold: true, circleDiameter: 36, offset: 28, lowercase: false, roman: false, romanLower: false },
  { fontSize: 20, bold: false, circleDiameter: 28, offset: 24, lowercase: true, roman: true, romanLower: false },
  { fontSize: 18, bold: false, circleDiameter: 22, offset: 21, lowercase: false, roman: false, romanLower: false },
  { fontSize: 14, bold: false, circleDiameter: 22, offset: 21, lowercase: true, roman: true, romanLower: true },
  { fontSize: 11, bold: true, circleDiameter: 14, offset: 17, lowercase: false, roman: false, romanLower: false },
] as const;

const KINDS: ElliottLabelKind[] = ['circle', 'paren', 'plain'];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

/** Group 1 (upper-case Roman) and group 3 (lower-case Roman) apply to numbers; letters just change case. */
export function elliottLabelStyle(degree: number): ElliottLabelStyle {
  const d = Math.max(0, Math.min(ELLIOTT_DEGREES.length - 1, Math.round(degree)));
  const group = GROUPS[Math.floor(d / 3)];
  const { roman, ...rest } = group;
  return { ...rest, roman, kind: KINDS[d % 3] };
}

export function elliottLabelText(token: string, style: ElliottLabelStyle): string {
  let text = token;
  if (/^\d+$/.test(token) && token !== '0') {
    text = style.roman ? ROMAN[Number(token)] ?? token : token;
    if (style.romanLower) text = text.toLowerCase();
  } else if (/^[A-Z]$/.test(token)) text = style.lowercase ? token.toLowerCase() : token;
  else if (style.romanLower) text = text.toLowerCase();
  return style.kind === 'paren' ? `(${text})` : text;
}

export interface ElliottWaveLabel {
  text: string;
  position: Point;
  above: boolean;
}

export abstract class ElliottWaveDrawing extends PatternDrawing<ElliottWaveOptions> {
  protected abstract readonly _requiredAnchors: number;
  /** One token per vertex ("0", "1", "A", ...), shown through the degree's label style. */
  protected abstract readonly _labels: readonly string[];
  protected _patternOptions: ElliottWaveOptions;
  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<ElliottWaveOptions> = {},
    defaultColor = '#3d85c6'
  ) {
    const { showWave, degree, visibility, ...baseOptions } = options;
    super(id, anchors, { lineColor: defaultColor, lineWidth: 1, ...style }, baseOptions);

    this._patternOptions = {
      ...this._options,
      showWave: showWave ?? true,
      degree: degree ?? DEFAULT_ELLIOTT_DEGREE,
      visibility,
    };
  }

  get waveOptions(): ElliottWaveOptions {
    return this._patternOptions;
  }

  setWaveOptions(options: Partial<ElliottWaveOptions>): void {
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

  get labels(): readonly string[] {
    return this._labels;
  }

  override isValid(): boolean {
    return this._anchors.length >= this._requiredAnchors;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new ElliottWavePaneViewBase(this)];
  }

  getWavePoints(viewport: Viewport): Point[] {
    if (!this.isValid()) return [];

    return this._anchors
      .map((anchor) => this.anchorToPixel(anchor, viewport))
      .filter((point): point is Point => point !== null);
  }

  /** A label sits above a local high and below a local low. */
  getWaveLabels(viewport: Viewport): ElliottWaveLabel[] {
    const points = this.getWavePoints(viewport);
    if (points.length < this._requiredAnchors) return [];
    const style = elliottLabelStyle(this._patternOptions.degree ?? DEFAULT_ELLIOTT_DEGREE);

    return points.map((point, i) => {
      const above = i === 0 ? points[1].y > point.y : point.y <= points[i - 1].y;
      return { text: elliottLabelText(this._labels[i] ?? `${i}`, style), position: point, above };
    });
  }

  override computeGeometry(): never[] {
    return [];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const points = this.getWavePoints(viewport);
    if (points.length < this._requiredAnchors) return false;
    if (this._patternOptions.showWave === false) {
      const style = elliottLabelStyle(this._patternOptions.degree ?? DEFAULT_ELLIOTT_DEGREE);
      return points.some((p) => Math.hypot(point.x - p.x, point.y - p.y) <= style.offset);
    }
    return distanceToPolyline(point, points) <= PATTERN_HIT_THRESHOLD;
  }

  abstract override clone(newId: string): IDrawing;
}
