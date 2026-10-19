import { Component, createRef } from "react";
import { createPortal } from "react-dom";
import { ChartEngine } from "./engine";
import { LabContext, type LabContextValue, type UiActions } from "./context";
import { TopBar } from "../components/chrome/TopBar";
import { LeftBar } from "../components/chrome/LeftBar";
import { BottomBar } from "../components/chrome/BottomBar";
import { TabStrip, type TabInfo } from "../components/chrome/TabStrip";
import { GridLayout, GridLayoutModel, type GridLayoutPreset } from "@ui/gridlayout";
import "@ui/gridlayout/styles.css";
import { ChartCell } from "../components/layout/ChartCell";
import { LayoutPicker } from "../components/layout/LayoutPicker";
import {
  SymbolSearchDialog,
  TypeToSearch,
} from "../components/dialogs/SymbolSearchDialog";
import { GoToDialog } from "../components/dialogs/GoToDialog";
import { IndicatorsDialog } from "../components/dialogs/IndicatorDialogs";
import { IndicatorSettingsDialog } from "../components/dialogs/IndicatorSettingsDialog";
import { VolumeSettingsDialog } from "../components/dialogs/VolumeSettingsDialog";
import {
  ChartSettingsDialog,
  type ChartSettingsTab,
} from "../components/dialogs/ChartSettingsDialog";
import styles from "./ChartLab.module.css";
import "./lab-vars.css";
import type { IndicatorKind } from "../indicators";
import { CHART_LAB_ADD_INDICATOR, CHART_LAB_OPEN_SYMBOL, type AddIndicatorDetail, type OpenSymbolDetail } from "./events";
import { NO_EXCHANGE, SYMBOLS, type SymbolInfo } from "../symbols";
import { localStore, type ChartLabStore } from "./store";
import type { MarketOptions } from "../market";
import type { BrandLogoOptions } from "lightweight-charts-multi-pane";
import type { DrawingController } from "../controller";
import type { IDatafeedChartApi } from "lightweight-charts-multi-pane";
import { ObjectSettingsDialog } from "../components/dialogs/ObjectSettingsDialog";

export interface ChartLabProps {
  /** Size to the parent container instead of the viewport and skip the page-wide type-to-search shortcut. */
  embedded?: boolean;
  /** Extra controls rendered at the right end of the top bar. */
  topBarActions?: React.ReactNode;
  /** When set, the top bar is rendered into this element so the host page can place it across its full width. */
  topBarHost?: HTMLElement | null;
  /** Lets the host draw its own symbol icon (flags, logos) in the tabs, from the `meta` it passed when opening the symbol. */
  renderSymbolIcon?: (symbol: SymbolInfo) => React.ReactNode;
  /** Looks symbols up in the host's market data for the search dialog. */
  searchSymbols?: (query: string) => Promise<SymbolInfo[]>;
  /** Creates one market-data feed per chart. Without it charts show the built-in mock series. */
  createDatafeed?: () => IDatafeedChartApi;
  /** Persistence for tabs, layouts, symbols and resolutions. Defaults to localStorage. */
  store?: ChartLabStore;
  /** Reports the drawing controller of the focused chart (null when none), so the host can drive undo/redo. */
  onActiveController?: (ctl: DrawingController | null) => void;
  /** Custom brand-logo widget shown at the bottom-left of every chart (icon that expands on hover). */
  brandLogo?: BrandLogoOptions;
}

const DEFAULT_PRESET: GridLayoutPreset = "1-single";

interface Tab {
  id: string;
  model: GridLayoutModel<object>;
  /** Symbol of the tab's first cell, kept so it survives reloads and layout changes. */
  symbol?: SymbolInfo;
  resolution?: string;
}

const firstCellId = (tab: Tab) => tab.model.getItems()[0]?.id;

let tabSeq = 0;
const newTabId = () => `tab-${Date.now().toString(36)}-${tabSeq++}`;

function createTab(
  id = newTabId(),
  preset: GridLayoutPreset = DEFAULT_PRESET,
  symbol?: SymbolInfo,
  resolution?: string,
): Tab {
  const model = new GridLayoutModel<object>();
  model.setLayout(preset);
  return { id, model, symbol, resolution };
}

const hashSeed = (text: string) => {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 997;
  return h + 1;
};

/** Known mock symbol, or one synthesised from the host's data so any watchlist row can open a chart. */
function resolveSymbol(detail: OpenSymbolDetail): SymbolInfo {
  const name = detail.symbol.replace(/[/\s]/g, "").toUpperCase();
  const known = SYMBOLS.find((s) => s.symbol === name);
  if (known) return { ...known, exchange: detail.exchange ?? known.exchange, meta: detail.meta ?? known.meta };
  return {
    symbol: name,
    description: detail.description ?? name,
    type: detail.type ?? "crypto",
    exchange: detail.exchange ?? NO_EXCHANGE,
    meta: detail.meta,
    base: detail.price && detail.price > 0 ? detail.price : 100,
    seed: hashSeed(name),
  };
}

interface State {
  tabs: Tab[];
  activeTabId: string;
  /** Bumped on every layout, engine or symbol change so the shell re-reads what it derives from them. */
  version: number;
  symbolSearch: { initial?: string } | null;
  goTo: boolean;
  indicators: boolean;
  indicatorSettings: string | null;
  volumeSettings: boolean;
  chartSettings: { tab?: ChartSettingsTab } | null;
  objectSettings: { id: string } | null;
  objectTree: boolean;
}

/** Application shell: tab strip plus one set of chrome (top, left and bottom bars, dialogs) driving whichever chart of the visible grid is active. */
export class ChartLab extends Component<ChartLabProps, State> {
  private chartAreaRef = createRef<HTMLElement>();
  private engines = new Map<string, ChartEngine>();
  private engineSubs = new Map<string, () => void>();
  private modelSubs = new Map<string, () => void>();
  private contexts = new WeakMap<ChartEngine, LabContextValue>();

  constructor(props: ChartLabProps) {
    super(props);
    const stored = this.store.load();
    const tabs = stored?.tabs?.length
      ? stored.tabs.map((t) => createTab(t.id, t.preset as GridLayoutPreset, t.symbol, t.resolution))
      : [createTab()];
    const activeTabId = tabs.some((t) => t.id === stored?.active)
      ? stored!.active
      : tabs[0].id;
    this.state = {
      tabs,
      activeTabId,
      version: 0,
      symbolSearch: null,
      goTo: false,
      indicators: false,
      indicatorSettings: null,
      volumeSettings: false,
      chartSettings: null,
      objectSettings: null,
      objectTree: false,
    };
  }

  private get store(): ChartLabStore {
    return this.props.store ?? localStore;
  }

  private marketOptions = (cellId: string): MarketOptions => {
    // Every chart of a tab starts on the tab's symbol, so splitting a layout never shows a different one.
    const owner = this.state.tabs.find((t) => t.model.getItems().some((item) => item.id === cellId));
    return {
      datafeed: this.props.createDatafeed?.(),
      symbol: owner?.symbol,
      resolution: owner?.resolution,
      brandLogo: this.props.brandLogo,
    };
  };

  private ui: UiActions = {
    openSymbolSearch: (initial) => this.setState({ symbolSearch: { initial } }),
    openGoTo: () => this.setState({ goTo: true }),
    openIndicators: () => this.setState({ indicators: true }),
    openIndicatorSettings: (id) => this.setState({ indicatorSettings: id }),
    openVolumeSettings: () => this.setState({ volumeSettings: true }),
    openChartSettings: (tab) => this.setState({ chartSettings: { tab } }),
    openObjectSettings: (id) => this.setState({ objectSettings: { id } }),
    toggleObjectTree: () => this.setState((s) => ({ objectTree: !s.objectTree })),
    chartArea: () => this.chartAreaRef.current,
    renderSymbolIcon: (symbol) => this.props.renderSymbolIcon?.(symbol),
    searchSymbols: this.props.searchSymbols ? (query) => this.props.searchSymbols!(query) : undefined,
  };

  componentDidMount() {
    this.state.tabs.forEach((tab) => this.watch(tab));
    window.addEventListener(CHART_LAB_OPEN_SYMBOL, this.onOpenSymbol);
    window.addEventListener(CHART_LAB_ADD_INDICATOR, this.onAddIndicator);
  }

  private reportedController: DrawingController | null = null;

  private reportController(ctl: DrawingController | null) {
    if (ctl === this.reportedController) return;
    this.reportedController = ctl;
    this.props.onActiveController?.(ctl);
  }

  componentDidUpdate() {
    const id = this.activeTab.model.getActiveId();
    this.reportController((id && this.engines.get(id)?.ctl) || null);
  }

  componentWillUnmount() {
    this.reportController(null);
    window.removeEventListener(CHART_LAB_OPEN_SYMBOL, this.onOpenSymbol);
    window.removeEventListener(CHART_LAB_ADD_INDICATOR, this.onAddIndicator);
    this.modelSubs.forEach((unsub) => unsub());
    this.modelSubs.clear();
    this.engineSubs.forEach((unsub) => unsub());
    this.engineSubs.clear();
  }

  private bump = () => {
    this.syncSymbols();
    this.setState((s) => ({ version: s.version + 1 }));
  };

  private syncSymbols() {
    let changed = false;
    for (const tab of this.state.tabs) {
      const cells = tab.model
        .getItems()
        .map((item) => this.engines.get(item.id))
        .filter((e): e is ChartEngine => !!e);
      // The chart whose symbol moved away from the tab's is the one the user changed; the rest follow it.
      const moved = cells.filter((e) => e.market.symbol.symbol !== tab.symbol?.symbol);
      const source = moved.find((e) => e === this.engines.get(tab.model.getActiveId() ?? "")) ?? moved[0];
      if (source) {
        tab.symbol = source.market.symbol;
        changed = true;
        cells.forEach((e) => {
          if (e !== source) e.market.setSymbol(source.market.symbol);
        });
      }
      const cell = firstCellId(tab);
      const resolution = cell ? this.engines.get(cell)?.market.resolution.id : undefined;
      if (resolution && resolution !== tab.resolution) {
        tab.resolution = resolution;
        changed = true;
      }
    }
    if (changed) this.persist(this.state.tabs, this.state.activeTabId);
  }

  private watch(tab: Tab) {
    this.modelSubs.set(
      tab.id,
      tab.model.subscribe(() =>
        this.setState((s) => ({ version: s.version + 1, objectTree: false })),
      ),
    );
  }

  private persist(tabs: Tab[], activeTabId: string) {
    this.store.save({
      active: activeTabId,
      tabs: tabs.map((t) => ({
        id: t.id,
        preset: t.model.getPreset() ?? DEFAULT_PRESET,
        symbol: t.symbol,
        resolution: t.resolution,
      })),
    });
  }

  private get activeTab(): Tab {
    return this.state.tabs.find((t) => t.id === this.state.activeTabId)!;
  }

  private setPreset = (preset: GridLayoutPreset) => {
    const tab = this.activeTab;
    tab.model.setLayout(preset);
    this.persist(this.state.tabs, this.state.activeTabId);
  };

  private selectTab = (id: string) => {
    if (id === this.state.activeTabId) return;
    this.persist(this.state.tabs, id);
    this.setState({ activeTabId: id, objectTree: false });
  };

  private onAddIndicator = (event: Event) => {
    const kind = (event as CustomEvent<AddIndicatorDetail>).detail?.kind;
    const id = this.activeTab.model.getActiveId();
    if (kind && id) this.engines.get(id)?.addIndicator(kind as IndicatorKind);
  };

  private onOpenSymbol = (event: Event) => {
    const detail = (event as CustomEvent<OpenSymbolDetail>).detail;
    if (detail?.symbol) this.addTab(resolveSymbol(detail));
  };

  private addTab = (symbol?: SymbolInfo) => {
    const tab = createTab(undefined, undefined, symbol);
    this.watch(tab);
    const tabs = [...this.state.tabs, tab];
    this.persist(tabs, tab.id);
    this.setState({ tabs, activeTabId: tab.id, objectTree: false });
  };

  private reorderTab = (id: string, index: number) => {
    const tabs = [...this.state.tabs];
    const from = tabs.findIndex((t) => t.id === id);
    if (from < 0) return;
    const [moved] = tabs.splice(from, 1);
    tabs.splice(Math.max(0, Math.min(index, tabs.length)), 0, moved);
    this.persist(tabs, this.state.activeTabId);
    this.setState({ tabs });
  };

  private closeTab = (id: string) => {
    const { tabs, activeTabId } = this.state;
    if (tabs.length < 2) return;
    const index = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    const nextActive =
      id === activeTabId ? next[Math.min(index, next.length - 1)].id : activeTabId;
    this.modelSubs.get(id)?.();
    this.modelSubs.delete(id);
    this.persist(next, nextActive);
    this.setState({ tabs: next, activeTabId: nextActive, objectTree: false });
  };

  private onEngine = (id: string, engine: ChartEngine | null) => {
    this.engineSubs.get(id)?.();
    this.engineSubs.delete(id);
    if (engine) {
      this.engines.set(id, engine);
      this.engineSubs.set(id, engine.market.subscribe(this.bump));
    } else this.engines.delete(id);
    this.bump();
  };

  private activate = (tab: Tab, id: string) => {
    if (tab.model.getActiveId() !== id) tab.model.setActive(id);
  };

  private contextFor(engine: ChartEngine): LabContextValue {
    let value = this.contexts.get(engine);
    if (!value) {
      value = { engine, ui: this.ui };
      this.contexts.set(engine, value);
    }
    return value;
  }

  private tabInfo(tab: Tab): TabInfo {
    const id = tab.model.getActiveId();
    const symbol = (id && this.engines.get(id)?.market.symbol) || tab.symbol;
    return {
      id: tab.id,
      title: symbol?.symbol ?? "Chart",
      icon: symbol ? this.props.renderSymbolIcon?.(symbol) : undefined,
    };
  }

  render() {
    const {
      tabs,
      activeTabId,
      symbolSearch,
      goTo,
      indicators,
      indicatorSettings,
      volumeSettings,
      chartSettings,
      objectSettings,
      objectTree,
    } = this.state;
    const tab = this.activeTab;
    const activeId = tab.model.getActiveId();
    const engine = activeId ? this.engines.get(activeId) : undefined;
    const chrome = engine ? this.contextFor(engine) : null;
    const actions = (
      <>
        <LayoutPicker
          preset={tab.model.getPreset() ?? DEFAULT_PRESET}
          onChange={this.setPreset}
        />
        {this.props.topBarActions}
      </>
    );
    const chromeKey = `${tab.id}:${activeId}`;
    const tabStrip = (
      <TabStrip
        tabs={tabs.map((t) => this.tabInfo(t))}
        activeId={activeTabId}
        onSelect={this.selectTab}
        onAdd={() => this.addTab()}
        onClose={this.closeTab}
        onReorder={this.reorderTab}
      />
    );
    const topBarNode = chrome && (
      <TopBar key={chromeKey} actions={actions} tabs={tabStrip} />
    );
    const { topBarHost } = this.props;
    const topBar = topBarHost ? (
      createPortal(
        <LabContext.Provider value={chrome as LabContextValue}>
          <div className={styles.hosted}>{topBarNode}</div>
        </LabContext.Provider>,
        topBarHost,
      )
    ) : (
      <header className={styles.topbar}>{topBarNode}</header>
    );
    return (
      <>
        <div
          className={
            this.props.embedded ? `${styles.app} ${styles.embedded}` : styles.app
          }
        >
          <LabContext.Provider value={chrome as LabContextValue}>
            {topBar}
            <aside className={styles.leftbar}>
              {chrome && <LeftBar key={chromeKey} />}
            </aside>
          </LabContext.Provider>
          <div className={styles.card}>
            <main className={styles.chartHost} ref={this.chartAreaRef}>
              {tabs.map((t) => {
                const visible = t.id === activeTabId;
                return (
                  <div
                    key={t.id}
                    className={
                      visible ? styles.pane : `${styles.pane} ${styles.paneHidden}`
                    }
                  >
                    <GridLayout
                      model={t.model}
                      lineSize={4}
                      draggable={false}
                      renderDragHandle={() => null}
                      onRenderCell={(item, isActive) => (
                        <ChartCell
                          id={item.id}
                          ui={this.ui}
                          active={visible && isActive}
                          highlight={visible && isActive && t.model.getCellCount() > 1}
                          showObjectTree={visible && isActive && objectTree}
                          onCloseObjectTree={() => this.setState({ objectTree: false })}
                          onEngine={this.onEngine}
                          marketOptions={this.marketOptions}
                          onActivate={(id) => this.activate(t, id)}
                        />
                      )}
                    />
                  </div>
                );
              })}
            </main>
            <LabContext.Provider value={chrome as LabContextValue}>
              <footer className={styles.bottombar}>
                {chrome && <BottomBar key={chromeKey} />}
              </footer>
            </LabContext.Provider>
          </div>
        </div>
        {chrome && (
          <LabContext.Provider value={chrome}>
            {!this.props.embedded && <TypeToSearch key={chromeKey} />}
            {symbolSearch && (
              <SymbolSearchDialog
                initial={symbolSearch.initial}
                onClose={() => this.setState({ symbolSearch: null })}
              />
            )}
            {goTo && <GoToDialog onClose={() => this.setState({ goTo: false })} />}
            {indicators && <IndicatorsDialog onClose={() => this.setState({ indicators: false })} />}
            {indicatorSettings && <IndicatorSettingsDialog id={indicatorSettings} onClose={() => this.setState({ indicatorSettings: null })} />}
            {volumeSettings && <VolumeSettingsDialog onClose={() => this.setState({ volumeSettings: false })} />}
            {chartSettings && (
              <ChartSettingsDialog
                tab={chartSettings.tab}
                onClose={() => this.setState({ chartSettings: null })}
              />
            )}
            {objectSettings && (
              <ObjectSettingsDialog
                id={objectSettings.id}
                onClose={() => this.setState({ objectSettings: null })}
              />
            )}
          </LabContext.Provider>
        )}
      </>
    );
  }
}
