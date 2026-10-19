import type { IChartApi } from "lightweight-charts-multi-pane";
import type { DrawingController } from "./controller";

export type ScaleMode = "regular" | "percent" | "indexed" | "log";
const LWC_MODE: Record<ScaleMode, number> = { regular: 0, log: 1, percent: 2, indexed: 3 };
const MODE_LABEL: Record<ScaleMode, string> = {
  regular: "toggle regular scale",
  percent: "toggle percentage scale",
  indexed: "toggle indexed to 100 scale",
  log: "toggle log scale",
};

interface ScaleState {
  mode: ScaleMode;
  auto: boolean;
  invert: boolean;
}

/** Price-scale mode, auto-fit and invert state of the main (right) price scale, with undo. */
export class PriceScaleControl {
  private listeners = new Set<() => void>();
  private last = "";
  private timer: ReturnType<typeof setInterval>;
  private onKey: (e: KeyboardEvent) => void;
  keysEnabled = true;

  constructor(
    private chart: IChartApi,
    private ctl: DrawingController,
  ) {
    // LWC turns autoScale off by itself when the user drags the axis, so the state is re-read on interaction.
    const poll = () => this.refresh();
    this.timer = setInterval(poll, 200);
    this.onKey = (e) => {
      if (!this.keysEnabled) return;
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const act: Record<string, () => void> = {
        KeyP: () => this.toggleMode("percent"),
        KeyL: () => this.toggleMode("log"),
        KeyI: () => this.toggleInvert(),
        KeyR: () => this.ctl.resetView(),
      };
      const fn = act[e.code];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    document.addEventListener("keydown", this.onKey);
  }

  dispose() {
    clearInterval(this.timer);
    document.removeEventListener("keydown", this.onKey);
    this.listeners.clear();
  }

  private get scale() {
    return this.chart.priceScale(this.ctl.scaleId);
  }

  get state(): ScaleState {
    const o = this.scale.options();
    const mode = (Object.keys(LWC_MODE) as ScaleMode[]).find((m) => LWC_MODE[m] === o.mode) ?? "regular";
    return { mode, auto: !!o.autoScale, invert: !!o.invertScale };
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  refresh() {
    const key = JSON.stringify(this.state);
    if (key === this.last) return;
    this.last = key;
    this.listeners.forEach((l) => l());
  }

  /** Applies only what differs: re-sending a percent/indexed mode would force auto-scale back on. */
  private apply(s: ScaleState) {
    const cur = this.state;
    if (s.mode !== cur.mode) this.scale.applyOptions({ mode: LWC_MODE[s.mode] } as never);
    if (s.invert !== cur.invert) this.scale.applyOptions({ invertScale: s.invert } as never);
    if (s.auto !== this.state.auto) this.scale.applyOptions({ autoScale: s.auto } as never);
    this.refresh();
  }

  private change(label: string, patch: (cur: ScaleState) => Partial<ScaleState>) {
    const before = this.state;
    const after = { ...before, ...patch(before) };
    this.apply(after);
    this.ctl.recordAction(label, () => this.apply(before), () => this.apply(after));
  }

  setMode(mode: ScaleMode) {
    if (this.state.mode === mode) return;
    this.change(MODE_LABEL[mode], () => ({ mode }));
  }

  /** Percent and log toggle against regular, like the bottom-bar buttons. */
  toggleMode(mode: ScaleMode) {
    const cur = this.state.mode;
    this.change(MODE_LABEL[mode], () => ({ mode: cur === mode ? "regular" : mode }));
  }

  toggleAuto() {
    this.change("toggle auto scale", (s) => ({ auto: !s.auto }));
  }

  toggleInvert() {
    this.change("toggle invert scale", (s) => ({ invert: !s.invert }));
  }
}
