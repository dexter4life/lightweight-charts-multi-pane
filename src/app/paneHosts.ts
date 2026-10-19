import type { IChartApi } from "lightweight-charts-multi-pane";

/**
 * Calls `onChange` once the chart has added, removed or reordered its pane rows.
 * The chart builds pane widgets (and the control containers inside them) on its next frame rather than when a pane is added,
 * so anything rendered into `chart.getControlContainers()` has to wait for this.
 */
export function watchPaneHosts(chart: IChartApi, onChange: () => void): () => void {
  const table = chart.chartElement().querySelector("table");
  if (!table) return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(table, { childList: true });
  return () => observer.disconnect();
}
