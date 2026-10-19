import { Component, createRef, type ReactNode } from "react";
import type { ISeriesApi, MouseEventParams, SeriesType, Time } from "lightweight-charts-multi-pane";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import { watchPaneHosts } from "../../app/paneHosts";
import { AnchorsPrimitive } from "../../anchors";
import { ERASER, isCursorTool } from "../../controller";
import { Icons, LegendIcons } from "../icons";
import { externalOf, indicatorLabel, indicatorTitle, type IndicatorInstance, type IndicatorSnapshot } from "../../indicators";
import { intervalMode, rgba, type IntervalVisibility } from "../../indicator-model";
import { formatVolume } from "../../volume-study";

/** BTCUSD / BTC/USDT -> BTC, the way the reference names the volume study. */
const baseTicker = (symbol: string) => symbol.split(/[/:]/).pop()!.replace(/(USDT|USDC|USD|EUR|PERP)$/, "") || symbol;
import styles from "./Legend.module.css";

interface LegendState {
  currentIndex: number;
  selected: boolean;
  volumeSelected: boolean;
  selectedInd: string | null;
  volumeShown: boolean;
  popup: { x: number; y: number } | null;
  menuLevels: MenuLevel[];
  tick: number;
}

interface MenuItem {
  ico?: ReactNode;
  label: string;
  key?: string;
  off?: boolean;
  inert?: boolean;
  sub?: Array<MenuItem | "sep">;
  run?: () => void;
}

type MenuLevel = {
  entries: Array<MenuItem | "sep">;
  x: number;
  y: number;
  flipTo?: number;
};

const UP = "#089981";
const DOWN = "#f23645";
const DESCRIPTION_AS_TICKER = true;
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const cx = (...tokens: Array<string | false | null | undefined>) => tokens.filter(Boolean).join(" ");

const hex2rgba = (hex: string, alpha: number) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return `rgba(255,255,255,${alpha})`;
  const value = parseInt(match[1], 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${alpha})`;
};

const isDark = (hex: string) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return false;
  const value = parseInt(match[1], 16);
  return 0.299 * (value >> 16) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255) < 128;
};

export class Legend extends Component<object, LegendState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: LegendState = {
    currentIndex: 0,
    selected: false,
    volumeSelected: false,
    selectedInd: null,
    volumeShown: true,
    popup: null,
    menuLevels: [],
    tick: 0,
  };

  private mainPillRef = createRef<HTMLDivElement>();
  private volumePillRef = createRef<HTMLSpanElement>();
  private liveRef = createRef<HTMLSpanElement>();
  private moreRef = createRef<HTMLButtonElement>();
  private popupRef = createRef<HTMLDivElement>();
  private menuEls = new Map<number, HTMLDivElement | null>();
  private byTime = new Map<number, number>();
  private unsubMarket: (() => void) | null = null;
  private unsubSettings: (() => void) | null = null;
  private unsubVolume: (() => void) | null = null;
  private unsubInd: (() => void) | null = null;
  private unsubPanes: (() => void) | null = null;
  private unsubHosts: (() => void) | null = null;
  private anchors: { series: ISeriesApi<SeriesType>; primitive: AnchorsPrimitive } | null = null;

  componentDidMount() {
    const { engine } = this.context;
    this.indexBars();
    this.unsubMarket = engine.market.subscribe(this.onMarketUpdate);
    this.unsubSettings = engine.settings.subscribe(this.onSettingsUpdate);
    this.unsubVolume = engine.onVolumeRemoved(this.onVolumeRemoved);
    this.unsubInd = engine.indicators.subscribe(this.onIndicatorsUpdate);
    this.unsubPanes = engine.panes.subscribe(this.onIndicatorsUpdate);
    engine.chart.subscribeCrosshairMove(this.onCrosshairMove);
    engine.chart.subscribeClick(this.onChartClick);
    document.addEventListener("pointerdown", this.onPointerDown, true);
    document.addEventListener("keydown", this.onKeyDown, true);
    this.unsubHosts = watchPaneHosts(engine.chart, this.refresh);
    this.setState({ currentIndex: Math.max(0, engine.market.bars.length - 1), volumeShown: !engine.isVolumeRemoved });
  }

  componentDidUpdate() {
    this.syncAnchors();
    if (this.state.menuLevels.length) this.state.menuLevels.forEach((_, index) => requestAnimationFrame(() => this.positionMenu(index)));
  }

  componentWillUnmount() {
    const { engine } = this.context;
    this.unsubMarket?.();
    this.unsubSettings?.();
    this.unsubVolume?.();
    this.unsubInd?.();
    this.unsubPanes?.();
    engine.chart.unsubscribeCrosshairMove(this.onCrosshairMove);
    engine.chart.unsubscribeClick(this.onChartClick);
    document.removeEventListener("pointerdown", this.onPointerDown, true);
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.unsubHosts?.();
    this.detachAnchors();
  }

  private refresh = () => this.setState((state) => ({ tick: state.tick + 1 }));

  private onMarketUpdate = () => {
    this.indexBars();
    const last = Math.max(0, this.context.engine.market.bars.length - 1);
    this.setState({ currentIndex: last, tick: this.state.tick + 1 });
  };

  private onSettingsUpdate = () => this.setState((state) => ({ tick: state.tick + 1 }));

  private onIndicatorsUpdate = () => {
    const { engine } = this.context;
    const gone = this.state.selectedInd !== null && !engine.indicators.get(this.state.selectedInd);
    this.setState((state) => ({ tick: state.tick + 1, selectedInd: gone ? null : state.selectedInd }));
  };

  private onVolumeRemoved = () => this.setState({ volumeShown: false });

  private onCrosshairMove = (params: MouseEventParams<Time>) => {
    if (this.state.popup || this.state.menuLevels.length) return;
    const bars = this.context.engine.market.bars;
    const hit = params.time !== undefined ? this.byTime.get(params.time as number) : undefined;
    const next = hit ?? Math.max(0, bars.length - 1);
    if (next !== this.state.currentIndex) this.setState({ currentIndex: next });
  };

  private onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node;
    if (this.state.popup && !this.liveRef.current?.contains(target) && !this.popupRef.current?.contains(target)) this.setState({ popup: null });
    const onMoreButton = target instanceof Element && !!target.closest('[data-act="more"],[data-act="imore"]');
    if (this.state.menuLevels.length && !this.isMenuTarget(target) && !onMoreButton) this.setState({ menuLevels: [] });
    if (this.state.selected && !this.mainPillRef.current?.contains(target) && !this.isMenuTarget(target)) this.setState({ selected: false });
    if (this.state.volumeSelected && !this.volumePillRef.current?.contains(target)) this.setState({ volumeSelected: false });
    if (this.state.selectedInd !== null && !this.isMenuTarget(target) && !(target instanceof Element && target.closest(`[data-ind="${this.state.selectedInd}"]`))) this.setState({ selectedInd: null });
  };

  /** TradingView-style hit test: a click on an indicator line, a candle or a volume bar activates that legend row. */
  private onChartClick = (params: MouseEventParams<Time>) => {
    const { engine } = this.context;
    if (!params.point || params.time === undefined) return;
    const tool = engine.ctl.getState().tool;
    if (!isCursorTool(tool) || tool === ERASER) return;
    const index = this.byTime.get(params.time as number);
    if (index === undefined) return;
    const bar = engine.market.bars[index];
    const timeScale = engine.chart.timeScale();
    const bx = timeScale.logicalToCoordinate(index as never);
    if (bx === null) return;
    const spacing = timeScale.options().barSpacing || 6;
    const host = engine.overlayHost.getBoundingClientRect().top;
    const paneY = (series: { getPane(): { getHTMLElement(): HTMLElement | null } }) => (series.getPane().getHTMLElement()?.getBoundingClientRect().top ?? host) - host;
    const x = params.point.x - engine.ctl.plotLeft();
    const y = params.point.y - paneY(engine.candles);
    const near = Math.max(4, spacing / 2);

    for (const ind of engine.indicators.list) {
      if (!engine.indicators.isShown(ind)) continue;
      for (const plot of ind.plots) {
        if (!ind.settings.plots[plot.def.id].visible) continue;
        const v = plot.values[index - this.shiftOf(ind, plot.def.id)];
        const iy = v === null || v === undefined ? null : plot.series.priceToCoordinate(v);
        const py = params.point.y - paneY(plot.series);
        if (iy !== null && Math.abs(iy - py) <= 6 && Math.abs(x - bx) <= near + 4) return this.selectIndicator(ind.id);
      }
    }

    const volume = engine.volume;
    if (volume && this.state.volumeShown) {
      const vy = volume.priceToCoordinate(bar.volume);
      const base = volume.priceToCoordinate(0);
      const volY = params.point.y - paneY(volume);
      const candleLow = engine.candles.priceToCoordinate(bar.low);
      const sameLane = volume.getPane() === engine.candles.getPane();
      const overCandle = sameLane && candleLow !== null && y <= candleLow + 4;
      if (vy !== null && base !== null && volY >= vy - 2 && volY <= base + 2 && Math.abs(x - bx) <= spacing / 2 && !overCandle) return this.selectVolume();
    }

    const high = engine.candles.priceToCoordinate(bar.high);
    const low = engine.candles.priceToCoordinate(bar.low);
    if (high !== null && low !== null && y >= high - 4 && y <= low + 4 && Math.abs(x - bx) <= near) return this.setSelected(true);
    this.setState({ selected: false, volumeSelected: false, selectedInd: null });
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const typing = event.target instanceof Element && !!event.target.closest("input, textarea, select, [contenteditable]");
    if ((event.key === "Delete" || event.key === "Backspace") && this.state.selectedInd !== null && !typing) {
      event.preventDefault();
      this.removeIndicator(this.state.selectedInd);
      return;
    }
    if (event.key !== "Escape") return;
    if (this.state.popup) this.setState({ popup: null });
    if (this.state.menuLevels.length) this.setState({ menuLevels: [] });
  };

  private isMenuTarget(target: Node) {
    return this.state.menuLevels.some((_, index) => this.menuEls.get(index)?.contains(target));
  }

  private indexBars() {
    this.byTime.clear();
    this.context.engine.market.bars.forEach((bar, index) => this.byTime.set(bar.time, index));
  }

  /** The selected line, candles or volume get their dots from a primitive on their own series, painted with the chart. */
  private syncAnchors() {
    const { engine } = this.context;
    const ind = this.state.selectedInd !== null ? engine.indicators.get(this.state.selectedInd) : undefined;
    const vol = this.state.volumeSelected && !ind ? engine.volume : null;
    const show = engine.market.bars.length > 0 && (ind ? engine.indicators.isShown(ind) : vol ? true : this.state.selected && this.eyeOn());
    if (!show) {
      this.detachAnchors();
      return;
    }
    const series = (ind ? ind.series : vol ?? engine.candles) as ISeriesApi<SeriesType>;
    if (this.anchors?.series === series) return;
    this.detachAnchors();
    const primitive = new AnchorsPrimitive(
      () => (ind ? ind.color : "#2962ff"),
      () => engine.market.bars.length,
      (index) => (ind ? ind.values[index - this.shiftOf(ind, ind.plots[0].def.id)] : vol ? engine.market.bars[index]?.volume : engine.market.bars[index]?.close),
    );
    series.attachPrimitive(primitive);
    this.anchors = { series, primitive };
  }

  private detachAnchors() {
    if (!this.anchors) return;
    const { series, primitive } = this.anchors;
    this.anchors = null;
    series.detachPrimitive(primitive);
  }

  private eyeOn() {
    return this.context.engine.candles.options().visible !== false;
  }

  private titleText() {
    const { engine } = this.context;
    const symbol = engine.market.symbol;
    const settings = engine.settings.data;
    const name = settings.titleMode === "ticker" || DESCRIPTION_AS_TICKER ? symbol.symbol : symbol.description;
    const text = settings.titleMode === "both" && !DESCRIPTION_AS_TICKER ? `${symbol.symbol}, ${symbol.description}` : name;
    return [text, engine.market.resolution.legend, engine.market.symbol.exchange].filter(Boolean).join(" · ");
  }

  private selectVolume = () => {
    this.setState({ selected: false, selectedInd: null, volumeSelected: true });
  };

  private selectIndicator = (id: string) => {
    this.setState({ selected: false, volumeSelected: false, selectedInd: id });
  };

  private toggleIndicator = (id: string) => {
    const manager = this.context.engine.indicators;
    const item = manager.get(id);
    if (!item) return;
    const was = item.visible;
    manager.setVisible(id, !was);
    this.context.engine.ctl.recordAction(`${was ? "hide" : "show"} ${indicatorLabel(item)}`, () => manager.get(id)?.visible !== was && manager.setVisible(id, was), () => manager.get(id)?.visible === was && manager.setVisible(id, !was));
  };

  private removeIndicator = (id: string) => {
    const { engine } = this.context;
    const manager = engine.indicators;
    const item = manager.get(id);
    if (!item) return;
    const label = indicatorLabel(item);
    let saved: IndicatorSnapshot = manager.snapshot(id)!;
    manager.remove(id);
    engine.ctl.recordAction(
      `remove ${label}`,
      () => {
        manager.restore(saved);
      },
      () => {
        saved = manager.snapshot(id) ?? saved;
        manager.remove(id);
      },
    );
  };

  private shiftOf(ind: IndicatorInstance, plotId: string) {
    return ind.spec.shift?.(ind.settings.inputs, plotId) ?? 0;
  }

  private setIntervals = (id: string, mode: IntervalVisibility) => {
    const { engine } = this.context;
    const manager = engine.indicators;
    const before = manager.get(id)?.settings;
    if (!before) return;
    const was = JSON.parse(JSON.stringify(before)) as typeof before;
    manager.setIntervalVisibility(id, mode);
    const after = manager.get(id)?.settings;
    if (!after) return;
    const next = JSON.parse(JSON.stringify(after)) as typeof after;
    engine.ctl.recordAction("change indicator visibility on intervals", () => manager.update(id, was), () => manager.update(id, next));
  };

  private openIndicatorMore = (id: string, button: HTMLElement) => {
    if (this.state.menuLevels.length) {
      this.setState({ menuLevels: [] });
      return;
    }
    const rect = button.getBoundingClientRect();
    this.selectIndicator(id);
    this.setState({ popup: null, menuLevels: [{ entries: this.buildIndicatorEntries(id), x: rect.right - 16.5, y: rect.top + 16.5 }] });
  };

  private buildIndicatorEntries(id: string): Array<MenuItem | "sep"> {
    const { engine } = this.context;
    const manager = engine.indicators;
    const ind = manager.get(id);
    if (!ind) return [];
    const { order, last } = manager.orderOf(ind);
    const paneIndex = manager.paneIndexOf(ind);
    const paneCount = engine.chart.panes().length;
    const alone = !manager.sharesPane(ind);
    const mode = intervalMode(ind.settings.visibility, engine.market.resolution.sec);
    const interval = (label: string, value: IntervalVisibility): MenuItem => ({ ico: this.tickIcon(mode === value), label, run: () => this.setIntervals(id, value) });
    const moveItems: MenuItem[] = [];
    if (paneIndex > 0) moveItems.push({ label: "Existing pane above", run: () => manager.moveTo(id, "above") });
    if (paneIndex < paneCount - 1) moveItems.push({ label: "Existing pane below", run: () => manager.moveTo(id, "below") });
    if (!alone) moveItems.push({ label: "New pane above", run: () => manager.moveTo(id, "new-above") }, { label: "New pane below", run: () => manager.moveTo(id, "new-below") });
    return [
      {
        ico: <LegendIcons.layers />,
        label: "Visual order",
        sub: [
          { label: "Bring to front", off: order >= last, run: () => manager.reorder(id, "front") },
          { label: "Send to back", off: order <= 0, run: () => manager.reorder(id, "back") },
          { label: "Bring forward", off: order >= last, run: () => manager.reorder(id, "forward") },
          { label: "Send backward", off: order <= 0, run: () => manager.reorder(id, "backward") },
        ],
      },
      {
        ico: <LegendIcons.info />,
        label: "Visibility on intervals",
        sub: [interval("Current interval and above", "above"), interval("Current interval and below", "below"), interval("Current interval only", "only"), interval("All intervals", "all")],
      },
      { ico: <LegendIcons.moveTo />, label: "Move to", sub: moveItems, off: !moveItems.length },
      "sep",
      { ico: ind.visible ? <LegendIcons.eyeOff /> : <Icons.eye />, label: ind.visible ? "Hide" : "Show", run: () => this.toggleIndicator(id) },
      { ico: <LegendIcons.trash />, label: "Remove", key: "⌫", run: () => this.removeIndicator(id) },
      "sep",
      { ico: <LegendIcons.gear />, label: "Settings…", run: () => this.context.ui.openIndicatorSettings(id) },
    ];
  }

  /** The values of an indicator's plots at the bar under the crosshair, coloured like the plots. */
  private indicatorValues(ind: IndicatorInstance) {
    const decimals = ind.settings.precision ?? ind.spec.decimals ?? this.context.engine.settings.step.decimals;
    return ind.plots
      .filter((plot) => ind.settings.plots[plot.def.id].visible)
      .map((plot) => {
        const style = ind.settings.plots[plot.def.id];
        const value = plot.values[this.state.currentIndex - this.shiftOf(ind, plot.def.id)];
        const missing = value === null || value === undefined || !Number.isFinite(value);
        return { id: plot.def.id, color: rgba(style.color, style.opacity), text: missing ? "∅" : value.toFixed(decimals).replace("-", "−") };
      });
  }

  private renderIndicator(ind: IndicatorInstance) {
    const { engine } = this.context;
    const settings = engine.settings.data;
    const shown = engine.indicators.isShown(ind);
    const title = indicatorTitle(ind);
    const source = externalOf(ind.kind)?.openSource;
    const eye = (
      <button className={styles.lgB} data-act="vhide" title={ind.visible ? "Hide" : "Show"} onClick={() => this.toggleIndicator(ind.id)}>
        {ind.visible ? <Icons.eye /> : <LegendIcons.eyeOff />}
      </button>
    );
    return (
      <div key={ind.id} className={cx(styles.lgRow, styles.lgInd)}>
        <span data-ind={ind.id} className={cx(styles.lgVpill, this.state.selectedInd === ind.id && styles.sel, !shown && styles.hid)}>
          <i className={styles.lgBox} />
          <span className={styles.lgTitle} title={ind.spec.name} onClick={() => this.selectIndicator(ind.id)} onDoubleClick={() => this.context.ui.openIndicatorSettings(ind.id)}>
            {title.name}
            {title.inputs.length ? <span className={styles.lgDim}> {title.inputs.join(" ")}</span> : null}
          </span>
          {ind.visible ? null : <span className={styles.lgEyeOff}>{eye}</span>}
          <span className={cx(styles.lgBtns, styles.lgVbtns)}>
            {ind.visible ? eye : null}
            <button className={styles.lgB} data-act="vset" title="Settings" onClick={() => this.context.ui.openIndicatorSettings(ind.id)}>
              <LegendIcons.gear />
            </button>
            {source ? (
              <button className={styles.lgB} data-act="vsrc" title="Source code" onClick={() => source()}>
                <LegendIcons.source />
              </button>
            ) : null}
            <button className={styles.lgB} data-act="vrm" title="Remove" onClick={() => this.removeIndicator(ind.id)}>
              <LegendIcons.trash />
            </button>
            <button className={styles.lgB} data-act="imore" title="More" onClick={(event) => this.openIndicatorMore(ind.id, event.currentTarget)}>
              <LegendIcons.dots />
            </button>
          </span>
        </span>
        {settings.indValues && ind.settings.valuesInStatus && shown
          ? this.indicatorValues(ind).map((value) => (
              <span key={value.id} className={styles.lgIvals} style={{ color: value.color }}>
                {value.text}
              </span>
            ))
          : null}
      </div>
    );
  }

  /** Indicator rows grouped by the pane they are drawn in. */
  private indicatorPanes() {
    const groups = new Map<number, IndicatorInstance[]>();
    this.context.engine.indicators.list.forEach((ind) => {
      const index = this.context.engine.indicators.paneIndexOf(ind);
      groups.set(index, [...(groups.get(index) ?? []), ind]);
    });
    return groups;
  }

  private setSelected = (selected: boolean) => {
    if (selected === this.state.selected) return;
    this.setState((prev) => ({ selected, volumeSelected: selected ? false : prev.volumeSelected, selectedInd: selected ? null : prev.selectedInd }));
  };

  private toggleSeries = () => {
    const { engine } = this.context;
    const was = this.eyeOn();
    const label = `${was ? "hide" : "show"} ${[engine.market.symbol.symbol, engine.market.symbol.exchange, engine.market.resolution.legend].filter(Boolean).join(", ")}`;
    const apply = (visible: boolean) => {
      engine.candles.applyOptions({ visible });
      this.setState((state) => ({ tick: state.tick + 1 }));
    };
    apply(!was);
    engine.ctl.recordAction(label, () => apply(was), () => apply(!was));
  };

  private toggleVolume = () => {
    const { engine } = this.context;
    if (!engine.volume) return;
    const study = engine.volumeStudy;
    const was = study.hidden;
    const apply = (hidden: boolean) => {
      engine.volumeStudy.setHidden(hidden);
      this.setState((state) => ({ tick: state.tick + 1 }));
    };
    apply(!was);
    engine.ctl.recordAction(`${was ? "show" : "hide"} Volume`, () => apply(was), () => apply(!was));
  };

  private openPopup = () => {
    const button = this.liveRef.current;
    if (!button) return;
    if (this.state.popup) {
      this.setState({ popup: null });
      return;
    }
    const rect = button.getBoundingClientRect();
    this.setState({ menuLevels: [], popup: { x: Math.max(4, rect.left - 14), y: rect.bottom + 4 } });
  };

  private settleVolume() {
    const { engine } = this.context;
    const volume = engine.volume;
    if (!volume) return;
    const alone = volume.getPane().getSeries().length === 1;
    volume.applyOptions({ priceScaleId: alone ? engine.ctl.scaleId : "vol" });
    volume.priceScale().applyOptions({ scaleMargins: { top: alone ? 0.1 : 0.75, bottom: 0 } });
    engine.volumeStudy.syncScale();
  }

  private afterPlacement() {
    this.settleVolume();
    this.refresh();
    this.context.engine.ctl.refreshPaneState();
  }

  private bubble(from: number, to: number) {
    const { engine } = this.context;
    for (let index = from; index > to; index--) engine.chart.swapPanes(index, index - 1);
  }

  private carryScale(change: () => void) {
    const { engine } = this.context;
    const options = engine.candles.priceScale().options();
    change();
    engine.candles.priceScale().applyOptions({ mode: options.mode, invertScale: options.invertScale, autoScale: options.autoScale, scaleMargins: options.scaleMargins });
  }

  private moveTo = (kind: "above" | "below" | "new-above" | "new-below") => {
    const { engine } = this.context;
    const pane = engine.candles.getPane().paneIndex();
    const mate = engine.candles.getPane().getSeries().find((series) => series !== engine.candles);
    const label = `move ${this.seriesLabel()} to ${kind.startsWith("new") ? "new pane" : "existing pane"} ${kind.endsWith("above") ? "above" : "below"}`;
    const apply = () =>
      this.carryScale(() => {
        const count = engine.chart.panes().length;
        if (kind === "above") engine.candles.moveToPane(pane - 1);
        else if (kind === "below") engine.candles.moveToPane(pane + 1);
        else {
          engine.candles.moveToPane(count);
          this.bubble(count, kind === "new-above" ? pane : pane + 1);
        }
        this.afterPlacement();
      });
    const undo = () =>
      this.carryScale(() => {
        if (mate) engine.candles.moveToPane(mate.getPane().paneIndex());
        else {
          const count = engine.chart.panes().length;
          engine.candles.moveToPane(count);
          this.bubble(count, pane);
        }
        this.afterPlacement();
      });
    apply();
    engine.ctl.recordAction(label, undo, apply);
  };

  private reorder = (to: (order: number, last: number) => number, label: string) => {
    const { engine } = this.context;
    const before = engine.candles.seriesOrder();
    const last = engine.candles.getPane().getSeries().length - 1;
    const after = Math.max(0, Math.min(last, to(before, last)));
    if (after === before) return;
    engine.candles.setSeriesOrder(after);
    engine.ctl.recordAction(label, () => engine.candles.setSeriesOrder(before), () => engine.candles.setSeriesOrder(after));
  };

  private pin = (side: "left" | "right") => {
    const { engine } = this.context;
    const before = engine.ctl.scaleId;
    const apply = (target: "left" | "right") => {
      engine.ctl.pinToScale(target);
      this.afterPlacement();
    };
    apply(side);
    engine.ctl.recordAction(`move ${this.seriesLabel()} to new ${side} scale`, () => apply(before), () => apply(side));
  };

  private seriesLabel() {
    const { engine } = this.context;
    return [engine.market.symbol.symbol, engine.market.symbol.exchange, engine.market.resolution.legend].filter(Boolean).join(", ");
  }

  private tickIcon(on: boolean) {
    return on ? <LegendIcons.check /> : null;
  }

  private buildMoreEntries(): Array<MenuItem | "sep"> {
    const { engine } = this.context;
    const price = engine.market.bars[this.state.currentIndex]?.close.toFixed(engine.settings.step.decimals) ?? "0";
    const pane = engine.candles.getPane();
    const alone = pane.getSeries().length === 1;
    const paneIndex = pane.paneIndex();
    const paneCount = engine.chart.panes().length;
    const order = engine.candles.seriesOrder();
    const last = pane.getSeries().length - 1;
    const side = engine.ctl.scaleId;
    const other = side === "left" ? "right" : "left";
    const moveItems: MenuItem[] = [];
    if (paneIndex > 0) moveItems.push({ label: "Existing pane above", run: () => this.moveTo("above") });
    if (paneIndex < paneCount - 1) moveItems.push({ label: "Existing pane below", run: () => this.moveTo("below") });
    if (!alone) moveItems.push({ label: "New pane above", run: () => this.moveTo("new-above") }, { label: "New pane below", run: () => this.moveTo("new-below") });
    const pinned: MenuItem = { ico: this.tickIcon(true), label: `Pinned to ${side} scale`, off: true };
    const toOther: MenuItem = { label: `Pin to new ${other} scale`, run: () => this.pin(other) };
    return [
      { ico: <LegendIcons.info />, label: "Symbol info…", inert: true },
      "sep",
      { label: `Copy price (${price})`, run: () => void navigator.clipboard?.writeText(price).catch(() => undefined) },
      { label: "Paste", key: "⌘V", run: () => engine.ctl.paste() },
      "sep",
      {
        ico: <LegendIcons.layers />,
        label: "Visual order",
        sub: [
          { label: "Bring to front", off: order >= last, run: () => this.reorder((_, end) => end, "bring to front") },
          { label: "Send to back", off: order <= 0, run: () => this.reorder(() => 0, "send to back") },
          { label: "Bring forward", off: order >= last, run: () => this.reorder((current) => current + 1, "bring forward") },
          { label: "Send backward", off: order <= 0, run: () => this.reorder((current) => current - 1, "send backward") },
        ],
      },
      { ico: <LegendIcons.moveTo />, label: "Move to", sub: moveItems, off: !moveItems.length },
      {
        ico: <LegendIcons.pin />,
        label: `Pin to scale (now ${side})`,
        sub: side === "right" ? [pinned, toOther, { label: "No scale (fullscreen)", off: true }] : [toOther, pinned, { label: "No scale (fullscreen)", off: true }],
      },
      { ico: this.eyeOn() ? <LegendIcons.eyeOff /> : <Icons.eye />, label: this.eyeOn() ? "Hide" : "Show", run: this.toggleSeries },
      "sep",
      {
        label: "Lines",
        sub: [
          { ico: this.tickIcon(engine.ctl.priceLineVisible), label: "Price line", run: () => engine.ctl.togglePriceLine() },
          { ico: this.tickIcon(engine.ctl.highLowVisible), label: "High and low price lines", run: () => engine.ctl.toggleHighLowLines() },
        ],
      },
      "sep",
      { ico: <LegendIcons.gear />, label: "Settings…", run: () => this.context.ui.openChartSettings("Symbol") },
    ];
  }

  private openMore = () => {
    const button = this.moreRef.current;
    if (!button) return;
    if (this.state.menuLevels.length) {
      this.setState({ menuLevels: [] });
      return;
    }
    const rect = button.getBoundingClientRect();
    this.setSelected(true);
    this.setState({ popup: null, menuLevels: [{ entries: this.buildMoreEntries(), x: rect.right - 16.5, y: rect.top + 16.5 }] });
  };

  private openSubmenu(depth: number, item: MenuItem, row: HTMLDivElement) {
    if (!item.sub || item.off) {
      this.setState((state) => ({ menuLevels: state.menuLevels.slice(0, depth + 1) }));
      return;
    }
    const parentRect = this.menuEls.get(depth)?.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const next: MenuLevel = { entries: item.sub, x: rowRect.right, y: rowRect.top - 6, flipTo: parentRect?.left };
    this.setState((state) => ({ menuLevels: [...state.menuLevels.slice(0, depth + 1), next] }));
  }

  private positionMenu(depth: number) {
    const menu = this.menuEls.get(depth);
    const level = this.state.menuLevels[depth];
    if (!menu || !level) return;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left = level.x;
    if (left + width > window.innerWidth) left = level.flipTo !== undefined ? level.flipTo - width : window.innerWidth - width - 4;
    menu.style.left = `${Math.max(4, left)}px`;
    menu.style.top = `${Math.max(4, Math.min(level.y, window.innerHeight - height - 4))}px`;
  }

  private renderMenu(depth: number, level: MenuLevel) {
    return (
      <div
        key={`legend-menu-${depth}`}
        ref={(node) => {
          this.menuEls.set(depth, node);
          if (node) requestAnimationFrame(() => this.positionMenu(depth));
        }}
        className={styles.lgMenu}
      >
        {level.entries.map((entry, index) => {
          if (entry === "sep") return <div key={`sep-${depth}-${index}`} className={styles.lgMsep} />;
          return (
            <div
              key={`${entry.label}-${index}`}
              className={cx(styles.lgMi, entry.off && styles.off)}
              onMouseEnter={(event) => this.openSubmenu(depth, entry, event.currentTarget)}
              onClick={() => {
                if (entry.off || entry.inert || entry.sub) return;
                this.setState({ menuLevels: [] });
                entry.run?.();
              }}
            >
              <span className={styles.lgMiIco}>{entry.ico}</span>
              <span className={styles.lgMiL}>{entry.label}</span>
              {entry.key ? <span className={styles.lgMiK}>{entry.key}</span> : null}
              {entry.sub ? <span className={styles.lgMiC}><LegendIcons.chev /></span> : null}
            </div>
          );
        })}
      </div>
    );
  }

  render() {
    const { engine } = this.context;
    const settings = engine.settings.data;
    const bars = engine.market.bars;
    const bar = bars[this.state.currentIndex] ?? bars[bars.length - 1];
    if (!bar) return null;
    const shown = this.eyeOn();
    const up = bar.close >= bar.open;
    const color = up ? UP : DOWN;
    const diff = bar.close - bar.open;
    const pct = (diff / bar.open) * 100;
    const sign = diff >= 0 ? "+" : "−";
    const format = (value: number) => value.toFixed(engine.settings.step.decimals).replace("-", "−");
    const volume = engine.volume;
    const study = engine.volumeStudy;
    const volumeHidden = volume ? study.hidden : false;
    const maValue = study.maAt(this.state.currentIndex);
    const volInputs = study.data.inputsInStatus && study.data.showMA ? ` ${study.data.maLength}` : "";
    const popupNow = new Date();
    const fraction = (popupNow.getUTCHours() * 3600 + popupNow.getUTCMinutes() * 60 + popupNow.getUTCSeconds()) / 86400;
    const indicatorGroups = this.indicatorPanes();
    const mainPane = engine.candles.getPane().paneIndex();
    const volumePane = volume ? volume.getPane().paneIndex() : -1;
    const mainRows = (
      <>
        <div className={styles.lgRow}>
          {settings.titleOn ? (
            <div ref={this.mainPillRef} className={cx(styles.lgPill, this.state.selected && styles.sel, !shown && styles.hid)}>
              <i className={styles.lgBox} />
              {this.context.ui.renderSymbolIcon?.(engine.market.symbol) ? (
                <span className={styles.lgIcon}>{this.context.ui.renderSymbolIcon(engine.market.symbol)}</span>
              ) : null}
              <span className={styles.lgTitle} onClick={() => this.setSelected(true)}>
                {this.titleText()}
              </span>
              {shown && settings.marketStatus ? (
                <span ref={this.liveRef} className={styles.lgLive} data-act="dot" title="Market open" onClick={this.openPopup}>
                  <i />
                </span>
              ) : null}
              <span className={styles.lgBtns}>
                <button className={styles.lgB} data-act="eye" title={shown ? "Hide" : "Show"} onClick={this.toggleSeries}>
                  {shown ? <Icons.eye /> : <LegendIcons.eyeOff />}
                </button>
                <button ref={this.moreRef} className={styles.lgB} data-act="more" title="More" onClick={this.openMore}>
                  <LegendIcons.dots />
                </button>
              </span>
            </div>
          ) : null}
        </div>
        <div className={styles.lgRow}>
          {shown && (settings.ohlc || settings.change || settings.volume) ? (
            <span className={styles.lgOhlc}>
              {settings.ohlc ? (
                <>
                  <span className={styles.lgP}><span>O</span><span style={{ color }}>{format(bar.open)}</span></span>
                  <span className={styles.lgP}><span>H</span><span style={{ color }}>{format(bar.high)}</span></span>
                  <span className={styles.lgP}><span>L</span><span style={{ color }}>{format(bar.low)}</span></span>
                  <span className={styles.lgP}><span>C</span><span style={{ color }}>{format(bar.close)}</span></span>
                </>
              ) : null}
              {settings.change ? <span style={{ color }}>{sign}{format(Math.abs(diff)).replace("−", "")} ({sign}{Math.abs(pct).toFixed(2)}%)</span> : null}
              {settings.volume ? <span className={styles.lgP}><span>Vol</span><span style={{ color }}>{formatVolume(bar.volume, study.data.precision)}</span></span> : null}
            </span>
          ) : null}
        </div>
        {shown ? (
          <div className={cx(styles.lgRow, styles.lgTrade)}>
            <button type="button" className={cx(styles.lgTb, styles.lgSell)} title="Sell">
              <span>{format(bar.close)}</span>
              <small>SELL</small>
            </button>
            <span className={styles.lgSpread}>{(0).toFixed(engine.settings.step.decimals)}</span>
            <button type="button" className={cx(styles.lgTb, styles.lgBuy)} title="Buy">
              <span>{format(bar.close)}</span>
              <small>BUY</small>
            </button>
          </div>
        ) : null}
      </>
    );
    const volumeRow =
      this.state.volumeShown && volume && (settings.indTitles || settings.indValues) ? (
        <div className={cx(styles.lgRow, styles.lgInd)}>
          <span ref={this.volumePillRef} className={cx(styles.lgVpill, this.state.volumeSelected && styles.sel, volumeHidden && styles.hid)}>
            <i className={styles.lgBox} />
            {settings.indTitles ? (
              <span className={styles.lgTitle} onClick={this.selectVolume}>
                Vol<span className={styles.lgDim}>{volInputs}</span> <span className={styles.lgDim}>· {baseTicker(engine.market.symbol.symbol)}</span>
              </span>
            ) : null}
            <span className={cx(styles.lgBtns, styles.lgVbtns)}>
              <button className={styles.lgB} data-act="vhide" title={volumeHidden ? "Show" : "Hide"} onClick={this.toggleVolume}>
                {volumeHidden ? <LegendIcons.eyeOff /> : <Icons.eye />}
              </button>
              <button className={styles.lgB} data-act="vset" title="Settings" onClick={() => this.context.ui.openVolumeSettings()}>
                <LegendIcons.gear />
              </button>
              <button className={styles.lgB} data-act="vrm" title="Remove" onClick={() => engine.removeVolume()}>
                <LegendIcons.trash />
              </button>
            </span>
          </span>
          {settings.indValues && study.data.valuesInStatus && !volumeHidden ? (
            <>
              <span className={styles.lgIvals} style={{ color }}>{formatVolume(bar.volume, study.data.precision)}</span>
              {maValue !== null ? <span className={styles.lgIvals} style={{ color: study.data.maColor }}>{formatVolume(maValue, study.data.precision)}</span> : null}
            </>
          ) : null}
        </div>
      ) : null;
    const dark = isDark(settings.bg);
    const legendStyle = { ["--lg-bg" as string]: hex2rgba(settings.bg, 0.5), ["--lg-ibg" as string]: settings.indBg ? hex2rgba(settings.bg, settings.indBgOpacity) : "transparent" };
    // Every pane's rows live inside that pane, so they move with it natively while a separator is dragged.
    const paneLegends = engine.chart.getControlContainers().map((host, index) => {
      const own = indicatorGroups.get(index) ?? [];
      const hasMain = index === mainPane;
      const hasVolume = volumeRow !== null && volumePane === index;
      if (!hasMain && !hasVolume && !own.length) return null;
      const collapsed = !hasMain && engine.panes.isCollapsed(index);
      return createPortal(
        <div className={cx(styles.legend, dark && styles.dark, collapsed && styles.lgCollapsed)} style={legendStyle}>
          {hasMain ? mainRows : null}
          {hasVolume ? volumeRow : null}
          {own.map((ind) => this.renderIndicator(ind))}
        </div>,
        host,
        `pane-${index}`,
      );
    });
    return (
      <>
        {paneLegends}
        {this.state.popup || this.state.menuLevels.length
          ? createPortal(
              <>
                {this.state.popup ? (
                  <div ref={this.popupRef} className={styles.lgPop} style={{ left: this.state.popup.x, top: this.state.popup.y }}>
                    <span className={styles.lgPopIco}><i /></span>
                    <div className={styles.lgPopBody}>
                      <div className={styles.lgPopTitle}>Market open</div>
                      <p className={styles.lgPopText}>All&apos;s well — Market is open.</p>
                      <div className={styles.lgPopWidget}>
                        <div className={styles.lgPopDay}>
                          <span className={styles.lgPopWd}>{WEEKDAYS[popupNow.getUTCDay()]}</span>
                          <span className={styles.lgPopSeg}><i className={styles.lgPopNow} style={{ left: `${(fraction * 170).toFixed(1)}px` }} /></span>
                        </div>
                        <div className={styles.lgPopMarks}><span>00:00</span><span>24:00</span></div>
                        <div className={styles.lgPopTz}>Exchange timezone: Etc/UTC</div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {this.state.menuLevels.map((level, index) => this.renderMenu(index, level))}
              </>,
              document.body,
            )
          : null}
      </>
    );
  }
}
