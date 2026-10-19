import type { ISeriesApi, ISeriesPrimitive, SeriesAttachedParameter, Time } from "lightweight-charts-multi-pane";

interface MediaScope {
  context: CanvasRenderingContext2D;
}
interface Target {
  useMediaCoordinateSpace<T>(callback: (scope: MediaScope) => T): T;
}

/**
 * The dots that mark a selected line, candle series or volume study.
 * They are painted by the chart itself, so they stay on the line while a pane is resized or scrolled.
 */
export class AnchorsPrimitive implements ISeriesPrimitive<Time> {
  private param?: SeriesAttachedParameter<Time>;

  constructor(
    private color: () => string,
    private length: () => number,
    private valueAt: (index: number) => number | null | undefined,
  ) {}

  attached(param: SeriesAttachedParameter<Time>) {
    this.param = param;
    // Attaching alone does not repaint the chart.
    param.requestUpdate();
  }

  detached() {
    this.param = undefined;
  }

  paneViews() {
    return [{ zOrder: () => "top" as const, renderer: () => ({ draw: (target: Target) => this.draw(target) }) }];
  }

  private draw(target: Target) {
    const param = this.param;
    if (!param) return;
    const timeScale = param.chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;
    const series = param.series as ISeriesApi<"Line">;
    const spacing = timeScale.options().barSpacing || 6;
    const step = Math.max(1, Math.round(120 / spacing));
    const from = Math.max(0, Math.ceil(range.from));
    const to = Math.min(this.length() - 1, Math.floor(range.to));
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (let index = Math.ceil(from / step) * step + Math.floor(step / 2); index <= to; index += step) {
        const value = this.valueAt(index);
        if (value === null || value === undefined) continue;
        const x = timeScale.logicalToCoordinate(index as never);
        const y = series.priceToCoordinate(value);
        if (x === null || y === null) continue;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 4.25, 0, Math.PI * 2);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = this.color();
        ctx.stroke();
      }
    });
  }
}
