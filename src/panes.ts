import type { IChartApi, IPaneApi, Time } from "lightweight-charts-multi-pane";

type Listener = () => void;

/** Height a collapsed pane keeps: just its legend row. */
const COLLAPSED_PX = 34;
/** Stretch factor that squeezes a pane to the minimum height the chart allows. */
const SQUEEZED = 0.0001;

interface Options {
  chart: IChartApi;
  /** The pane of the main series, which can be neither deleted nor collapsed. */
  isMain(paneIndex: number): boolean;
  /** Whether a pane holds something that cannot be deleted (the candles, the volume). */
  isProtected(paneIndex: number): boolean;
  /** Removes the indicators of a pane, which takes the pane with them. */
  removeContents(paneIndex: number): void;
}

/**
 * The pane controls of the chart: move, delete, collapse and maximize.
 * LWC sizes panes by stretch factors, so collapsing and maximizing work by changing those and restoring the saved ones afterwards.
 */
export class PaneLayout {
  private readonly chart: IChartApi;
  private readonly isMain: Options["isMain"];
  private readonly isProtected: Options["isProtected"];
  private readonly removeContents: Options["removeContents"];
  private listeners = new Set<Listener>();
  /** The factors the panes have when neither collapsed nor maximized. */
  private base = new Map<IPaneApi<Time>, number>();
  private collapsed = new Set<IPaneApi<Time>>();
  private maximized: IPaneApi<Time> | null = null;
  private paneCount = 0;
  private applying = false;

  constructor(options: Options) {
    this.chart = options.chart;
    this.isMain = options.isMain;
    this.isProtected = options.isProtected;
    this.removeContents = options.removeContents;
    this.paneCount = this.panes().length;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose() {
    this.listeners.clear();
  }

  count() {
    return this.panes().length;
  }

  isCollapsed(index: number) {
    const pane = this.panes()[index];
    return !!pane && this.collapsed.has(pane) && this.maximized !== pane;
  }

  isMaximized(index: number) {
    const pane = this.panes()[index];
    return !!pane && this.maximized === pane;
  }

  /** Whether another pane is maximized, which hides this one together with its legend and controls. */
  isHidden(index: number) {
    const pane = this.panes()[index];
    return !!this.maximized && this.maximized !== pane;
  }

  canMoveUp(index: number) {
    return index > 0;
  }

  canMoveDown(index: number) {
    return index < this.count() - 1;
  }

  canCollapse(index: number) {
    return !this.isMain(index);
  }

  canDelete(index: number) {
    return !this.isProtected(index);
  }

  /** Moves the pane one step; the neighbour takes its place. */
  move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= this.count()) return;
    this.chart.swapPanes(index, target);
    this.emit();
  }

  remove(index: number) {
    if (!this.canDelete(index)) return;
    this.removeContents(index);
    this.sync();
  }

  toggleCollapsed(index: number) {
    const pane = this.panes()[index];
    if (!pane || !this.canCollapse(index)) return;
    // Maximized panes are expanded already; collapsing one gives the others their space back first.
    if (this.maximized === pane) this.maximized = null;
    if (this.collapsed.has(pane)) this.collapsed.delete(pane);
    else this.collapsed.add(pane);
    this.apply();
    this.emit();
  }

  toggleMaximized(index: number) {
    const pane = this.panes()[index];
    if (!pane) return;
    this.maximized = this.maximized === pane ? null : pane;
    this.apply();
    this.emit();
  }

  /** Called when panes were added or removed, or the chart was resized. */
  sync() {
    if (this.applying) return;
    const panes = this.panes();
    this.collapsed.forEach((pane) => {
      if (!panes.includes(pane)) this.collapsed.delete(pane);
    });
    if (this.maximized && (!panes.includes(this.maximized) || panes.length !== this.paneCount)) this.maximized = null;
    this.paneCount = panes.length;
    this.apply();
    this.emit();
  }

  /** Reapplies the sizes after the chart resized, so collapsed panes keep their height. */
  resize() {
    if (this.collapsed.size || this.maximized) this.apply();
  }

  private panes() {
    return this.chart.panes();
  }

  private apply() {
    const panes = this.panes();
    this.applying = true;
    try {
      // Squeezed panes would still show a sliver of themselves.
      panes.forEach((pane) => {
        const el = pane.getHTMLElement();
        if (el) el.style.visibility = this.maximized && this.maximized !== pane ? "hidden" : "";
      });
      const special = this.collapsed.size > 0 || this.maximized !== null;
      if (!special) {
        panes.forEach((pane) => {
          const factor = this.base.get(pane);
          if (factor !== undefined) pane.setStretchFactor(factor);
        });
        this.base.clear();
        return;
      }
      // A factor read while special is applied is not the user's own, so only record panes that were not seen before.
      const total = panes.reduce((sum, pane) => sum + pane.getHeight(), 0);
      panes.forEach((pane) => {
        if (!this.base.has(pane)) this.base.set(pane, pane.getStretchFactor());
      });
      for (const pane of [...this.base.keys()]) if (!panes.includes(pane)) this.base.delete(pane);

      if (this.maximized) {
        panes.forEach((pane) => pane.setStretchFactor(pane === this.maximized ? 1 : SQUEEZED));
        return;
      }
      const rest = panes.filter((pane) => !this.collapsed.has(pane));
      const restFactor = rest.reduce((sum, pane) => sum + (this.base.get(pane) ?? 1), 0);
      const room = total - this.collapsed.size * COLLAPSED_PX;
      const collapsedFactor = rest.length && room > COLLAPSED_PX ? (COLLAPSED_PX * restFactor) / room : 1;
      panes.forEach((pane) => pane.setStretchFactor(this.collapsed.has(pane) ? collapsedFactor : (this.base.get(pane) ?? 1)));
    } finally {
      this.applying = false;
    }
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }
}
