import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../../model/ipane-primitive';
import type { ISeriesApi } from '../../../api/iseries-api';
import type { SeriesType } from '../../../model/series-options';

import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, Viewport } from '../../core/types';
import { drawControlPoints } from '../../rendering/canvas-utils';
import type { IntervalUnit, VisibilityMap } from '../lines/trend-line';
import { PatternDrawing } from '../patterns/pattern-base';
import { resolveSeriesBars, timeToKey } from './data-utils';
import type { ResolvedSeriesBar, SeriesDatumLike, VolumeProfileData } from './data-utils';

export interface VolumeProfileRenderData {
  left: number;
  right: number;
  top: number;
  bottom: number;
  profile: VolumeProfileData;
}

export type VolumeMode = 'updown' | 'total' | 'delta';

export interface FixedRangeVolumeProfileOptions extends DrawingOptions {
  visibility?: VisibilityMap;
  rowsLayout: 'rows' | 'ticks';
  /** Number of rows, or ticks per row, depending on the layout. */
  rows: number;
  volume: VolumeMode;
  /** Share of the total volume the value area covers, in percent. */
  vaVolume: number;
  /** Longest histogram bar, in percent of the box width. */
  percentWidth: number;
  placement: 'left' | 'right';
  showProfile: boolean;
  showValues: boolean;
  valuesColor: string;
  upColor: string;
  downColor: string;
  vaUpColor: string;
  vaDownColor: string;
  showPoc: boolean;
  pocColor: string;
  pocWidth: number;
  pocDash: number[];
  showDevPoc: boolean;
  devPocColor: string;
  devPocWidth: number;
  devPocDash: number[];
  showDevVA: boolean;
  devVAColor: string;
  devVAWidth: number;
  devVADash: number[];
  boxColor: string;
}

const DEFAULT_OPTIONS: FixedRangeVolumeProfileOptions = {
  rowsLayout: 'rows',
  rows: 24,
  volume: 'updown',
  vaVolume: 70,
  percentWidth: 30,
  placement: 'left',
  showProfile: true,
  showValues: false,
  valuesColor: '#424242',
  upColor: 'rgba(21, 146, 230, 0.24)',
  downColor: 'rgba(251, 193, 35, 0.24)',
  vaUpColor: 'rgba(21, 146, 230, 0.7)',
  vaDownColor: 'rgba(251, 193, 35, 0.7)',
  showPoc: true,
  pocColor: '#ff0000',
  pocWidth: 2,
  pocDash: [],
  showDevPoc: false,
  devPocColor: '#ff0000',
  devPocWidth: 1,
  devPocDash: [],
  showDevVA: false,
  devVAColor: '#0000ff',
  devVAWidth: 1,
  devVADash: [],
  boxColor: 'rgba(55, 166, 239, 0.06)',
};

const HIT = 5;
const MAX_ROWS = 1000;
const GUIDE = '#787B86';
const DIAGONAL = '#787B86';

interface VpBar extends ResolvedSeriesBar {
  key: number;
}

export interface VolumeRow {
  low: number;
  high: number;
  up: number;
  down: number;
  total: number;
  inValueArea: boolean;
}

export interface Profile {
  rows: VolumeRow[];
  pocIndex: number;
  maxTotal: number;
  low: number;
  high: number;
}

/** Spreads each bar's volume over the rows its high-low span touches, in proportion to the overlap. */
function distribute(bars: readonly VpBar[], low: number, rowHeight: number, rows: VolumeRow[]): void {
  for (const b of bars) {
    const first = Math.max(0, Math.min(rows.length - 1, Math.floor((b.low - low) / rowHeight + 1e-9)));
    const last = Math.max(first, Math.min(rows.length - 1, Math.ceil((b.high - low) / rowHeight - 1e-9) - 1));
    const span = b.high - b.low;
    const up = b.close >= b.open;
    for (let r = first; r <= last; r += 1) {
      const rLow = low + r * rowHeight;
      const overlap = span > 0 ? Math.max(0, Math.min(b.high, rLow + rowHeight) - Math.max(b.low, rLow)) / span : 1;
      const share = last === first ? 1 : overlap;
      const v = b.volume * share;
      if (up) rows[r].up += v;
      else rows[r].down += v;
      rows[r].total += v;
    }
  }
}

function pocOf(rows: readonly VolumeRow[]): number {
  let best = 0;
  for (let i = 1; i < rows.length; i += 1) if (rows[i].total > rows[best].total) best = i;
  return best;
}

/** Grows the value area outward from the point of control, taking the heavier pair of neighbours each step. */
function valueArea(rows: readonly VolumeRow[], poc: number, percent: number): [number, number] {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const target = (total * percent) / 100;
  let lo = poc;
  let hi = poc;
  let sum = rows[poc].total;
  while (sum < target && (lo > 0 || hi < rows.length - 1)) {
    const up = (rows[hi + 1]?.total ?? 0) + (rows[hi + 2]?.total ?? 0);
    const down = (rows[lo - 1]?.total ?? 0) + (rows[lo - 2]?.total ?? 0);
    const canUp = hi < rows.length - 1;
    const canDown = lo > 0;
    if (canUp && (!canDown || up >= down)) {
      hi += 1;
      sum += rows[hi].total;
      if (sum < target && hi < rows.length - 1) {
        hi += 1;
        sum += rows[hi].total;
      }
    } else {
      lo -= 1;
      sum += rows[lo].total;
      if (sum < target && lo > 0) {
        lo -= 1;
        sum += rows[lo].total;
      }
    }
  }
  return [lo, hi];
}

function formatVolume(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return String(Math.round(v));
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Volume histogram over the bars between two points; the points snap to the range's highest and lowest price. */
export class FixedRangeVolumeProfile extends PatternDrawing<FixedRangeVolumeProfileOptions> {
  readonly type = 'fixed-range-volume-profile';
  protected _patternOptions: FixedRangeVolumeProfileOptions;

  private _interval: { unit: IntervalUnit; multiplier: number } | null = null;
  private _volumeSeries: ISeriesApi<SeriesType> | null = null;
  private _cache: { key: string; bars: VpBar[] } | null = null;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<FixedRangeVolumeProfileOptions> = {},
  ) {
    super(id, anchors, { lineColor: DIAGONAL, lineWidth: 1, ...style }, {
      ...(options.visible !== undefined ? { visible: options.visible } : {}),
      ...(options.locked !== undefined ? { locked: options.locked } : {}),
    });
    this._patternOptions = { ...DEFAULT_OPTIONS, ...options };
  }

  get fixedRangeVolumeProfileOptions(): FixedRangeVolumeProfileOptions {
    return this._patternOptions;
  }

  setFixedRangeVolumeProfileOptions(options: Partial<FixedRangeVolumeProfileOptions>): void {
    this.updatePatternOptions(options);
    const { visible, locked } = options;
    if (visible !== undefined) this._options = { ...this._options, visible };
    if (locked !== undefined) this._options = { ...this._options, locked };
  }

  override updateOptions(options: Partial<FixedRangeVolumeProfileOptions>): void {
    this.setFixedRangeVolumeProfileOptions(options);
  }

  setVolumeSeries(series: ISeriesApi<SeriesType> | null): void {
    this._volumeSeries = series;
    this._cache = null;
    this.requestUpdate();
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
    return this._anchors.length >= 2;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new FixedRangeVolumeProfilePaneView(this)];
  }

  override computeGeometry(): never[] {
    return [];
  }

  override autoscaleInfo(): null {
    return null;
  }

  override clone(newId: string): IDrawing {
    const copy = new FixedRangeVolumeProfile(newId, [...this._anchors], { ...this._style }, { ...this._patternOptions });
    copy.setVolumeSeries(this._volumeSeries);
    return copy;
  }

  static create(id: string, anchors: Anchor[], style?: Partial<DrawingStyle>, options?: Partial<FixedRangeVolumeProfileOptions>): FixedRangeVolumeProfile {
    return new FixedRangeVolumeProfile(id, anchors, style, options);
  }

  private get minTick(): number {
    const minMove = (this._series?.options() as { priceFormat?: { minMove?: number } } | undefined)?.priceFormat?.minMove;
    return minMove && minMove > 0 ? minMove : 0.01;
  }

  private bars(): VpBar[] {
    if (!this._series) return [];
    const data = this._series.data() as unknown as readonly SeriesDatumLike[];
    const vol = this._volumeSeries?.data() as unknown as readonly SeriesDatumLike[] | undefined;
    const key = `${data.length}:${data.length ? timeToKey(data[data.length - 1].time) : 0}:${vol?.length ?? -1}`;
    if (this._cache?.key === key) return this._cache.bars;
    const volumes = new Map<number, number>();
    for (const v of vol ?? []) if (typeof v.value === 'number') volumes.set(timeToKey(v.time), v.value);
    const bars: VpBar[] = resolveSeriesBars(data).map((b) => {
      const k = timeToKey(b.time);
      const v = volumes.get(k);
      return { ...b, key: k, volume: v !== undefined ? Math.max(v, 0) : b.volume };
    });
    this._cache = { key, bars };
    return bars;
  }

  private indexAt(bars: readonly VpBar[], time: Anchor['time']): number {
    const target = timeToKey(time);
    let lo = 0;
    let hi = bars.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (bars[mid].key <= target) lo = mid;
      else hi = mid - 1;
    }
    if (lo + 1 < bars.length && Math.abs(bars[lo + 1].key - target) < Math.abs(target - bars[lo].key)) return lo + 1;
    return lo;
  }

  /** Snaps both points to bars: the first sits at the range's highest price, the second at its lowest. */
  private normalise(): void {
    if (this._anchors.length < 2 || !this._series) return;
    const bars = this.bars();
    if (!bars.length) return;
    const a = this.indexAt(bars, this._anchors[0].time);
    const b = this.indexAt(bars, this._anchors[1].time);
    const slice = bars.slice(Math.min(a, b), Math.max(a, b) + 1);
    const high = Math.max(...slice.map((x) => x.high));
    const low = Math.min(...slice.map((x) => x.low));
    this._anchors = [
      { time: bars[a].time, price: high },
      { time: bars[b].time, price: low },
    ];
    this.requestUpdate();
  }

  finalizePlacement(): void {
    if (this._placedCount !== null) return;
    this.normalise();
  }

  override dragControlPoint(index: number, _point: Point, anchor: Anchor | null, _viewport: Viewport): void {
    if (!anchor || index < 0 || index > 1) return;
    this._anchors[index] = { ...this._anchors[index], time: anchor.time };
    this.normalise();
  }

  // Only the handles move a volume profile.
  override bodyDragOrigin(): Point[] | null {
    return null;
  }

  override setAnchors(anchors: Anchor[]): void {
    super.setAnchors(anchors);
    if (this._placedCount === null) this.normalise();
  }

  override getControlPoints(viewport: Viewport) {
    const g = this.pixels(viewport);
    if (!g) return [];
    // While placing, both handles follow the raw points; afterwards they sit at the range's high and low.
    const pts = this._placedCount !== null && this._placedCount < 2 ? [g.a, g.b] : [{ x: g.a.x, y: g.top }, { x: g.b.x, y: g.bottom }];
    return pts.map((p, index) => ({ index, x: p.x, y: p.y, radius: 6 }));
  }

  private pixels(viewport: Viewport) {
    if (this._anchors.length < 2) return null;
    const a = this.anchorToPixel(this._anchors[0], viewport);
    const b = this.anchorToPixel(this._anchors[1], viewport);
    if (!a || !b) return null;
    return { xL: Math.min(a.x, b.x), xR: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y), a, b };
  }

  /** The histogram of the bars between the two points. */
  profile(): Profile | null {
    if (this._anchors.length < 2) return null;
    const bars = this.bars();
    if (!bars.length) return null;
    const o = this._patternOptions;
    const i1 = this.indexAt(bars, this._anchors[0].time);
    const i2 = this.indexAt(bars, this._anchors[1].time);
    const slice = bars.slice(Math.min(i1, i2), Math.max(i1, i2) + 1);
    const high = Math.max(...slice.map((b) => b.high));
    const low = Math.min(...slice.map((b) => b.low));
    if (!(high > low)) return null;
    let count = Math.round(o.rows);
    if (o.rowsLayout === 'ticks') count = Math.ceil((high - low) / (Math.max(1, o.rows) * this.minTick) - 1e-9);
    count = Math.max(1, Math.min(MAX_ROWS, count));
    const rowHeight = (high - low) / count;
    const rows: VolumeRow[] = Array.from({ length: count }, (_, r) => ({ low: low + r * rowHeight, high: low + (r + 1) * rowHeight, up: 0, down: 0, total: 0, inValueArea: false }));
    distribute(slice, low, rowHeight, rows);
    const pocIndex = pocOf(rows);
    const [lo, hi] = valueArea(rows, pocIndex, o.vaVolume);
    for (let r = lo; r <= hi; r += 1) rows[r].inValueArea = true;
    return { rows, pocIndex, maxTotal: rows[pocIndex].total, low, high };
  }

  /** Running point of control and value area after each bar of the range. */
  private developing(viewport: Viewport): { x: number; poc: number; vah: number; val: number }[] {
    const bars = this.bars();
    const g = this.pixels(viewport);
    const p = this.profile();
    if (!g || !p || !bars.length) return [];
    const i1 = this.indexAt(bars, this._anchors[0].time);
    const i2 = this.indexAt(bars, this._anchors[1].time);
    const from = Math.min(i1, i2);
    const to = Math.max(i1, i2);
    const rowHeight = (p.high - p.low) / p.rows.length;
    const rows: VolumeRow[] = p.rows.map((r) => ({ ...r, up: 0, down: 0, total: 0, inValueArea: false }));
    const out: { x: number; poc: number; vah: number; val: number }[] = [];
    for (let i = from; i <= to; i += 1) {
      distribute([bars[i]], p.low, rowHeight, rows);
      const poc = pocOf(rows);
      const [lo, hi] = valueArea(rows, poc, this._patternOptions.vaVolume);
      const x = viewport.timeScale.timeToCoordinate(bars[i].time);
      if (x === null) continue;
      out.push({ x, poc: (rows[poc].low + rows[poc].high) / 2, vah: rows[hi].high, val: rows[lo].low });
    }
    return out;
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const g = this.pixels(viewport);
    if (!g || (this._placedCount !== null && this._placedCount < 2)) return false;
    if (Math.abs(point.x - g.xR) <= HIT && point.y >= g.top - HIT && point.y <= g.bottom + HIT) return true;
    const o = this._patternOptions;
    const p = o.showPoc ? this.profile() : null;
    if (!p) return false;
    const pitch = (g.bottom - g.top) / p.rows.length;
    const y = g.bottom - (p.pocIndex + 0.5) * pitch;
    return point.x >= g.xL - HIT && point.x <= g.xR + HIT && distanceToSegment(point, { x: g.xL, y }, { x: g.xR, y }) <= Math.max(HIT - 1, o.pocWidth / 2 + 2);
  }

  paint(scope: BitmapCoordinatesRenderingScope, viewport: Viewport): void {
    const { context: ctx, horizontalPixelRatio: pr, verticalPixelRatio: vr } = scope;
    const g = this.pixels(viewport);
    if (!g) return;
    ctx.save();
    ctx.scale(pr, vr);

    if (this._placedCount !== null && this._placedCount < 2) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = GUIDE;
      for (const x of [g.a.x, g.b.x]) {
        const px = Math.round(x * pr) / pr;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, scope.mediaSize.height);
        ctx.stroke();
      }
      ctx.strokeStyle = DIAGONAL;
      ctx.beginPath();
      ctx.moveTo(g.a.x, g.a.y);
      ctx.lineTo(g.b.x, g.b.y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const o = this._patternOptions;
    const width = g.xR - g.xL;
    const height = g.bottom - g.top;
    ctx.fillStyle = o.boxColor;
    ctx.fillRect(g.xL, g.top, width, height);

    const p = this.profile();
    if (p && width > 0 && height > 0) {
      const pitch = height / p.rows.length;
      const rowTop = (r: number) => g.bottom - (r + 1) * pitch;

      if (o.showPoc) {
        const y = rowTop(p.pocIndex) + pitch / 2;
        ctx.strokeStyle = o.pocColor;
        ctx.lineWidth = o.pocWidth;
        ctx.setLineDash(o.pocDash);
        ctx.beginPath();
        ctx.moveTo(g.xL, y);
        ctx.lineTo(g.xR, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (o.showProfile && p.maxTotal > 0) {
        const maxW = (width * o.percentWidth) / 100;
        const dir = o.placement === 'right' ? -1 : 1;
        const origin = o.placement === 'right' ? g.xR : g.xL;
        const rect = (start: number, len: number, y: number, h: number, colour: string) => {
          if (len <= 0) return;
          ctx.fillStyle = colour;
          ctx.fillRect(dir > 0 ? origin + start : origin - start - len, y, len, h);
        };
        p.rows.forEach((row, r) => {
          const y = rowTop(r);
          const h = Math.max(pitch - 1, 1);
          const scale = maxW / p.maxTotal;
          const upColor = row.inValueArea ? o.vaUpColor : o.upColor;
          const downColor = row.inValueArea ? o.vaDownColor : o.downColor;
          let reach = 0;
          if (o.volume === 'updown') {
            rect(0, row.up * scale, y, h, upColor);
            rect(row.up * scale, row.down * scale, y, h, downColor);
            reach = row.total * scale;
          } else if (o.volume === 'total') {
            rect(0, row.total * scale, y, h, upColor);
            reach = row.total * scale;
          } else {
            const delta = row.up - row.down;
            const strong = delta >= 0 ? upColor : downColor;
            rect(0, Math.abs(delta) * scale, y, h, strong);
            rect(Math.abs(delta) * scale, (row.total - Math.abs(delta)) * scale, y, h, delta >= 0 ? o.upColor : o.downColor);
            reach = row.total * scale;
          }
          if (o.showValues) {
            ctx.fillStyle = o.valuesColor;
            ctx.font = '10px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.textAlign = dir > 0 ? 'left' : 'right';
            const v = o.volume === 'delta' ? row.up - row.down : row.total;
            ctx.fillText(formatVolume(v), origin + dir * (reach + 3), y + h / 2);
          }
        });
      }

      if (o.showDevPoc || o.showDevVA) {
        const dev = this.developing(viewport);
        const line = (colour: string, w: number, dash: number[], value: (d: (typeof dev)[number]) => number) => {
          ctx.strokeStyle = colour;
          ctx.lineWidth = w;
          ctx.setLineDash(dash);
          ctx.beginPath();
          let started = false;
          for (const d of dev) {
            const y = viewport.priceScale.priceToCoordinate(value(d));
            if (y === null) continue;
            if (!started) ctx.moveTo(d.x, y);
            else ctx.lineTo(d.x, y);
            started = true;
          }
          ctx.stroke();
          ctx.setLineDash([]);
        };
        if (o.showDevPoc) line(o.devPocColor, o.devPocWidth, o.devPocDash, (d) => d.poc);
        if (o.showDevVA) {
          line(o.devVAColor, o.devVAWidth, o.devVADash, (d) => d.vah);
          line(o.devVAColor, o.devVAWidth, o.devVADash, (d) => d.val);
        }
      }
    }
    ctx.restore();
  }
}

class FixedRangeVolumeProfilePaneView implements IPrimitivePaneView {
  private readonly _renderer: FixedRangeVolumeProfilePaneRenderer;

  constructor(drawing: FixedRangeVolumeProfile) {
    this._renderer = new FixedRangeVolumeProfilePaneRenderer(drawing);
  }

  // Candles stay above the histogram.
  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class FixedRangeVolumeProfilePaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly _drawing: FixedRangeVolumeProfile) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const drawing = this._drawing;
      const viewport = drawing.getViewport();
      if (!viewport || !drawing.options.visible || !drawing.isDisplayed() || !drawing.isValid()) return;
      drawing.paint(scope, viewport);
      if (drawing.state === 'selected' || drawing.state === 'editing' || drawing.state === 'hovered') {
        drawControlPoints(scope.context, drawing.getControlPoints(viewport), null, scope.horizontalPixelRatio, '#2962FF');
      }
    });
  }
}
