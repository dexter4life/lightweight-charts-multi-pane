import type { ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, Time } from "lightweight-charts-multi-pane";

export interface FillPoint {
  time: number;
  /** The edge the fill is measured from (a plot). */
  a: number;
  /** The edge it runs to (a level or another plot). */
  b: number;
}

export interface FillOptions {
  mode: "band" | "over" | "under";
  color: string;
  /** Fades from `color` at the price `end` to `color2` at the `b` edge. */
  gradient?: { end: number; color2: string };
}

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
  bitmapSize: { width: number; height: number };
}
interface Target {
  useBitmapCoordinateSpace<T>(callback: (scope: BitmapScope) => T): T;
}

/** Shades the space between two edges of an indicator: a band, or only where one edge is over/under the other. */
export class FillPrimitive implements ISeriesPrimitive<Time> {
  private points: FillPoint[] = [];
  private shown = true;
  private param?: SeriesAttachedParameter<Time>;

  constructor(private options: FillOptions) {}

  attached(param: SeriesAttachedParameter<Time>) {
    this.param = param;
  }

  detached() {
    this.param = undefined;
  }

  setPoints(points: FillPoint[]) {
    this.points = points;
    this.param?.requestUpdate();
  }

  setOptions(options: FillOptions) {
    this.options = options;
    this.param?.requestUpdate();
  }

  setVisible(visible: boolean) {
    this.shown = visible;
    this.param?.requestUpdate();
  }

  paneViews() {
    return [{ zOrder: () => "bottom" as const, renderer: () => ({ draw: (target: Target) => this.draw(target) }) }];
  }

  private draw(target: Target) {
    const param = this.param;
    if (!param || !this.shown || this.points.length < 2) return;
    const series = param.series as ISeriesApi<"Line">;
    const timeScale = param.chart.timeScale();
    const { mode, color, gradient } = this.options;
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr, bitmapSize }) => {
      const at = (p: FillPoint) => {
        const x = timeScale.timeToCoordinate(p.time as Time);
        const ya = series.priceToCoordinate(p.a);
        const yb = series.priceToCoordinate(p.b);
        return x === null || ya === null || yb === null ? null : { x: x * hr, ya: ya * vr, yb: yb * vr, d: mode === "under" ? p.b - p.a : p.a - p.b };
      };
      let fill: string | CanvasGradient = color;
      if (gradient) {
        const first = this.points[0];
        const yEnd = series.priceToCoordinate(gradient.end);
        const yTo = series.priceToCoordinate(first.b);
        if (yEnd !== null && yTo !== null && yEnd !== yTo) {
          const g = ctx.createLinearGradient(0, yEnd * vr, 0, yTo * vr);
          g.addColorStop(0, color);
          g.addColorStop(1, gradient.color2);
          fill = g;
        }
      }
      ctx.fillStyle = fill;
      const polygon = (pts: Array<[number, number]>) => {
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fill();
      };
      let prev = at(this.points[0]);
      for (let i = 1; i < this.points.length; i++) {
        const q = at(this.points[i]);
        const p = prev;
        prev = q;
        if (!p || !q) continue;
        if (q.x < 0 || p.x > bitmapSize.width) continue;
        if (mode === "band") {
          polygon([[p.x, p.ya], [q.x, q.ya], [q.x, q.yb], [p.x, p.yb]]);
          continue;
        }
        if (p.d <= 0 && q.d <= 0) continue;
        if (p.d >= 0 && q.d >= 0) {
          polygon([[p.x, p.ya], [q.x, q.ya], [q.x, q.yb], [p.x, p.yb]]);
          continue;
        }
        // The edges cross inside this segment: keep only the triangle on the shaded side.
        const t = p.d / (p.d - q.d);
        const cx = p.x + (q.x - p.x) * t;
        const cy = p.ya + (q.ya - p.ya) * t;
        if (p.d > 0) polygon([[p.x, p.ya], [cx, cy], [p.x, p.yb]]);
        else polygon([[q.x, q.ya], [cx, cy], [q.x, q.yb]]);
      }
    });
  }
}
