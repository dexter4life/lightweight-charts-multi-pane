import type { BitmapCoordinatesRenderingScope, CanvasRenderingTarget2D } from 'fancy-canvas';

import type { Time } from '../../model/horz-scale-behavior-time/types';
import type { Logical } from '../../model/time-data';
import type { IPrimitivePaneRenderer, IPrimitivePaneView } from '../../model/ipane-primitive';
import type { ISeriesPrimitiveAxisView } from '../../model/iseries-primitive';

import type { Drawing } from './drawing';

const BAND_COLOR = 'rgba(41, 98, 255, 0.22)';
const LABEL_BACK = '#2962FF';
const LABEL_TEXT = '#FFFFFF';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

function toDate(time: Time): { date: Date; intraday: boolean } | null {
  if (typeof time === 'number') {
    return { date: new Date(time * 1000), intraday: time % 86400 !== 0 };
  }
  if (typeof time === 'string') {
    const d = new Date(`${time}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : { date: d, intraday: false };
  }
  if (time && typeof time === 'object' && 'year' in time) {
    return { date: new Date(Date.UTC(time.year, time.month - 1, time.day)), intraday: false };
  }
  return null;
}

/** Formats like TradingView's axis tags: "15 Sep '26" (+ " 14:30" for intraday). */
export function formatAxisTime(time: Time): string {
  const parsed = toDate(time);
  if (!parsed) return '';
  const { date, intraday } = parsed;
  const base = `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} '${pad(
    date.getUTCFullYear() % 100
  )}`;
  return intraday ? `${base}  ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}` : base;
}

type Extent = { min: number; max: number };

function priceExtent(drawing: Drawing, placedOnly = false): Extent | null {
  const custom = drawing.extentPrices();
  if (custom && custom.length > 0) return { min: Math.min(...custom), max: Math.max(...custom) };
  const anchors = placedOnly && drawing.placedCount !== null ? drawing.anchors.slice(0, drawing.placedCount) : drawing.anchors;
  if (anchors.length === 0) return null;
  let min = anchors[0].price;
  let max = anchors[0].price;
  for (const a of anchors) {
    if (a.price < min) min = a.price;
    if (a.price > max) max = a.price;
  }
  return { min, max };
}

function timeExtent(
  drawing: Drawing,
  placedOnly = false
): { first: Time; last: Time; x1: number; x2: number } | null {
  const vp = drawing.getViewport();
  if (!vp) return null;
  let first: { time: Time; x: number } | null = null;
  let last: { time: Time; x: number } | null = null;
  const anchors = placedOnly && drawing.placedCount !== null ? drawing.anchors.slice(0, drawing.placedCount) : drawing.anchors;
  for (const a of anchors) {
    const x =
      a.logical !== undefined ? vp.timeScale.logicalToCoordinate(a.logical as Logical) : vp.timeScale.timeToCoordinate(a.time);
    if (x === null) continue;
    if (!first || x < first.x) first = { time: a.time, x };
    if (!last || x > last.x) last = { time: a.time, x };
  }
  if (!first || !last) return null;
  return { first: first.time, last: last.time, x1: first.x, x2: last.x };
}

function isActive(drawing: Drawing): boolean {
  if (!drawing.options.visible || !drawing.isDisplayed() || drawing.anchors.length === 0) return false;
  return drawing.state === 'selected' || drawing.state === 'editing';
}

function showsPriceTags(drawing: Drawing): boolean {
  if (drawing.showsAxisTags() && isActive(drawing)) return true;
  return (
    drawing.showsIdlePriceLabels() &&
    !!drawing.options.visible &&
    drawing.anchors.length > 0 &&
    (drawing.placedCount === null || drawing.placedCount >= Math.min(2, drawing.anchors.length))
  );
}

/** Every placed anchor gets its own tag, so multi-point tools show all of their prices and times. */
const MAX_ANCHOR_TAGS = 16;

function placedAnchor(drawing: Drawing, index: number) {
  const count = drawing.placedCount ?? drawing.anchors.length;
  return index < Math.min(count, drawing.anchors.length) ? drawing.anchors[index] : null;
}

class PriceLabelView implements ISeriesPrimitiveAxisView {
  constructor(
    private readonly _drawing: Drawing,
    private readonly _index: number
  ) {}

  private _price(): number | null {
    const custom = this._drawing.customPriceTags();
    if (custom) return custom[this._index]?.price ?? null;
    return placedAnchor(this._drawing, this._index)?.price ?? null;
  }

  visible(): boolean {
    return showsPriceTags(this._drawing) && this._price() !== null;
  }

  coordinate(): number {
    const price = this._price();
    const y = price === null ? null : this._drawing.getViewport()?.priceScale.priceToCoordinate(price);
    return y ?? -1000;
  }

  text(): string {
    const price = this._price();
    const series = (this._drawing as unknown as { _series: { priceFormatter(): { format(p: number): string } } | null })
      ._series;
    return price === null ? '' : series ? series.priceFormatter().format(price) : price.toFixed(2);
  }

  textColor(): string {
    return LABEL_TEXT;
  }

  backColor(): string {
    return this._drawing.customPriceTags()?.[this._index]?.backColor ?? LABEL_BACK;
  }
}

class TimeLabelView implements ISeriesPrimitiveAxisView {
  constructor(
    private readonly _drawing: Drawing,
    private readonly _index: number
  ) {}

  private _x(): number | null {
    const a = placedAnchor(this._drawing, this._index);
    const vp = this._drawing.getViewport();
    if (!a || !vp) return null;
    return a.logical !== undefined ? vp.timeScale.logicalToCoordinate(a.logical as Logical) : vp.timeScale.timeToCoordinate(a.time);
  }

  visible(): boolean {
    const d = this._drawing;
    const idle = d.showsIdleTimeLabels() && !!d.options.visible && d.isDisplayed() && d.anchors.length > 0;
    return ((d.showsAxisTags() && isActive(d)) || idle) && this._x() !== null;
  }

  coordinate(): number {
    return this._x() ?? -1000;
  }

  text(): string {
    const a = placedAnchor(this._drawing, this._index);
    return a ? formatAxisTime(a.time) : '';
  }

  textColor(): string {
    return LABEL_TEXT;
  }

  backColor(): string {
    return LABEL_BACK;
  }

  tickVisible(): boolean {
    return false;
  }
}

class BandRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _drawing: Drawing,
    private readonly _axis: 'price' | 'time'
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    if (!isActive(this._drawing)) return;
    if (this._axis === 'price' && !this._drawing.showsPriceBand()) return;
    if (this._axis === 'time' && !this._drawing.showsTimeBand()) return;
    const vp = this._drawing.getViewport();
    if (!vp) return;

    let from: number | null = null;
    let to: number | null = null;
    if (this._axis === 'price') {
      const ext = priceExtent(this._drawing);
      if (!ext) return;
      // price min maps to the larger y coordinate
      from = vp.priceScale.priceToCoordinate(ext.max);
      to = vp.priceScale.priceToCoordinate(ext.min);
    } else {
      const ext = timeExtent(this._drawing);
      if (!ext) return;
      from = ext.x1;
      to = ext.x2;
    }
    if (from === null || to === null) return;

    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      const { context: ctx, bitmapSize, horizontalPixelRatio: hr, verticalPixelRatio: vr } = scope;
      ctx.fillStyle = this._drawing.axisBandColor() ?? BAND_COLOR;
      if (this._axis === 'price') {
        ctx.fillRect(0, Math.round(from! * vr), bitmapSize.width, Math.max(1, Math.round((to! - from!) * vr)));
      } else {
        ctx.fillRect(Math.round(from! * hr), 0, Math.max(1, Math.round((to! - from!) * hr)), bitmapSize.height);
      }
    });
  }
}

class BandView implements IPrimitivePaneView {
  private readonly _renderer: BandRenderer;

  constructor(drawing: Drawing, axis: 'price' | 'time') {
    this._renderer = new BandRenderer(drawing, axis);
  }

  zOrder(): 'bottom' {
    return 'bottom';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

/** Highlights the price/time extent of a selected drawing on the axes, like TradingView. */
export class DrawingAxisViews {
  readonly priceLabels: readonly ISeriesPrimitiveAxisView[];
  readonly timeLabels: readonly ISeriesPrimitiveAxisView[];
  readonly priceBand: readonly IPrimitivePaneView[];
  readonly timeBand: readonly IPrimitivePaneView[];

  constructor(drawing: Drawing) {
    const slots = Array.from({ length: MAX_ANCHOR_TAGS }, (_, i) => i);
    this.priceLabels = slots.map((i) => new PriceLabelView(drawing, i));
    this.timeLabels = slots.map((i) => new TimeLabelView(drawing, i));
    this.priceBand = [new BandView(drawing, 'price')];
    this.timeBand = [new BandView(drawing, 'time')];
  }
}
