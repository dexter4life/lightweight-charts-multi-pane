import type { ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, Time } from "lightweight-charts-multi-pane";

export interface CloudPoint {
  time: number;
  a: number;
  b: number;
}

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}
interface Target {
  useBitmapCoordinateSpace<T>(callback: (scope: BitmapScope) => T): T;
}

/** Fills the area between two lines (e.g. the Ichimoku cloud), tinted by which line is on top. */
export class CloudPrimitive implements ISeriesPrimitive<Time> {
  private points: CloudPoint[] = [];
  private shown = true;
  private param?: SeriesAttachedParameter<Time>;

  constructor(
    private up: string,
    private down: string,
  ) {}

  attached(param: SeriesAttachedParameter<Time>) {
    this.param = param;
  }

  detached() {
    this.param = undefined;
  }

  setPoints(points: CloudPoint[]) {
    this.points = points;
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
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hr, verticalPixelRatio: vr }) => {
      const xy = (p: CloudPoint) => {
        const x = timeScale.timeToCoordinate(p.time as Time);
        const ya = series.priceToCoordinate(p.a);
        const yb = series.priceToCoordinate(p.b);
        return x === null || ya === null || yb === null ? null : { x: x * hr, ya: ya * vr, yb: yb * vr };
      };
      for (let i = 1; i < this.points.length; i++) {
        const p = xy(this.points[i - 1]);
        const q = xy(this.points[i]);
        if (!p || !q) continue;
        const d0 = this.points[i - 1].a - this.points[i - 1].b;
        const d1 = this.points[i].a - this.points[i].b;
        const polygon = (pts: Array<[number, number]>, color: string) => {
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        };
        if (d0 * d1 >= 0) {
          polygon([[p.x, p.ya], [q.x, q.ya], [q.x, q.yb], [p.x, p.yb]], d0 + d1 >= 0 ? this.up : this.down);
        } else {
          // The lines cross inside this segment: split it into two triangles at the crossing.
          const t = d0 / (d0 - d1);
          const cx = p.x + (q.x - p.x) * t;
          const cy = p.ya + (q.ya - p.ya) * t;
          polygon([[p.x, p.ya], [cx, cy], [p.x, p.yb]], d0 > 0 ? this.up : this.down);
          polygon([[q.x, q.ya], [cx, cy], [q.x, q.yb]], d1 > 0 ? this.up : this.down);
        }
      }
    });
  }
}
