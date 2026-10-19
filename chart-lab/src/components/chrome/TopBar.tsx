import { Component, Fragment, createRef } from "react";
import type * as React from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import type { ControllerState } from "../../controller";
import { CHART_TYPES, type ChartTypeId } from "../../chart-type";
import { Icons, TopBarIcons, type IconComponent } from "../icons";
import { RESOLUTIONS, type Resolution } from "../../market";
import styles from "./TopBar.module.css";
import { cx, readStorage, writeStorage } from "./utils";

const INTERVAL_FAVORITES_KEY = "chartlab.intervalFavorites";
const GROUPS: Resolution["group"][] = ["Minutes", "Hours", "Days"];

const snapshotStamp = () => new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");

interface TopBarState {
  symbol: string;
  ctlState: ControllerState;
  fullscreen: boolean;
}

export class TopBar extends Component<{ actions?: React.ReactNode; tabs?: React.ReactNode }, TopBarState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  private unsubscribers: Array<() => void> = [];

  constructor(props: object, context: React.ContextType<typeof LabContext>) {
    super(props, context);
    const { engine } = context;
    this.state = {
      symbol: engine.market.symbol.symbol,
      ctlState: engine.ctl.getState(),
      fullscreen: !!document.fullscreenElement,
    };
  }

  componentDidMount() {
    const { engine } = this.context;
    this.unsubscribers.push(engine.market.subscribe(() => this.setState({ symbol: engine.market.symbol.symbol })));
    this.unsubscribers.push(engine.ctl.subscribe(() => this.setState({ ctlState: engine.ctl.getState() })));
    document.addEventListener("fullscreenchange", this.onFullscreenChange);
  }

  componentWillUnmount() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    document.removeEventListener("fullscreenchange", this.onFullscreenChange);
  }

  private onFullscreenChange = () => {
    this.setState({ fullscreen: !!document.fullscreenElement });
  };

  private toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  render() {
    const { engine, ui } = this.context;
    const { fullscreen, ctlState } = this.state;
    const fullscreenTitle = fullscreen ? "Exit fullscreen mode" : "Fullscreen mode";
    const FullscreenIcon = fullscreen ? Icons.fullscreenExit : Icons.fullscreen;

    return (
      <>
        <button type="button" className={cx(styles.topBtn, styles.history)} title="Undo" aria-label="Undo" disabled={!ctlState.canUndo} onClick={() => engine.ctl.undo()}>
          <Icons.undo />
        </button>
        <button type="button" className={cx(styles.topBtn, styles.history, styles.historyEnd)} title="Redo" aria-label="Redo" disabled={!ctlState.canRedo} onClick={() => engine.ctl.redo()}>
          <Icons.redo />
        </button>
        <button type="button" className={cx(styles.topBtn, styles.pill)} title="Create Alert">
          <Icons.alarm />
          <span>Alert</span>
        </button>
        <IntervalControl />
        <ChartTypeControl />
        <button type="button" className={cx(styles.topBtn, styles.pill)} title="Indicators & Strategies" onClick={() => ui.openIndicators()}>
          <Icons.indicators />
          <span>Indicator</span>
        </button>
        <button type="button" className={cx(styles.topBtn, styles.pill, styles.pillIcon)} title="Compare or Add Symbol" onClick={() => ui.openSymbolSearch()}>
          <Icons.plus />
        </button>
        {this.props.tabs ?? null}
        {!this.props.tabs && <div className={styles.grow} />}
        <div className={styles.right}>
          {this.props.actions}
          <button type="button" className={styles.topBtn} title={fullscreenTitle} onClick={this.toggleFullscreen}>
            <FullscreenIcon />
          </button>
          <button type="button" className={styles.topBtn} title="Chart settings" onClick={() => ui.openChartSettings()}>
            <Icons.settings />
          </button>
          <SnapshotButton />
        </div>
      </>
    );
  }
}

interface IntervalState {
  favorites: string[];
  collapsed: string[];
  open: boolean;
  currentId: string;
}

class IntervalControl extends Component<object, IntervalState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  private wrapRef = createRef<HTMLDivElement>();
  private menuRef: HTMLDivElement | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(props: object, context: React.ContextType<typeof LabContext>) {
    super(props, context);
    this.state = {
      favorites: this.loadFavorites(),
      collapsed: [],
      open: false,
      currentId: context.engine.market.resolution.id,
    };
  }

  componentDidMount() {
    this.unsubscribe = this.context.engine.market.subscribe(() => this.setState({ currentId: this.context.engine.market.resolution.id }));
  }

  componentDidUpdate(_: object, prevState: IntervalState) {
    if (prevState.open !== this.state.open) {
      if (this.state.open) {
        document.addEventListener("mousedown", this.onOutside, true);
        document.addEventListener("keydown", this.onEscape, true);
      } else {
        document.removeEventListener("mousedown", this.onOutside, true);
        document.removeEventListener("keydown", this.onEscape, true);
      }
    }
  }

  componentWillUnmount() {
    this.unsubscribe?.();
    document.removeEventListener("mousedown", this.onOutside, true);
    document.removeEventListener("keydown", this.onEscape, true);
  }

  private loadFavorites() {
    const stored = readStorage<unknown[]>(INTERVAL_FAVORITES_KEY, []);
    return stored.filter((id): id is string => typeof id === "string" && RESOLUTIONS.some((resolution) => resolution.id === id));
  }

  private onOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (this.wrapRef.current?.contains(target) || this.menuRef?.contains(target)) return;
    this.setState({ open: false });
  };

  private onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.setState({ open: false });
  };

  private toggleMenu = () => {
    this.setState((state) => ({ open: !state.open }));
  };

  private toggleFavorite = (id: string) => {
    this.setState((state) => {
      const favorites = state.favorites.includes(id) ? state.favorites.filter((entry) => entry !== id) : [...state.favorites, id];
      writeStorage(INTERVAL_FAVORITES_KEY, favorites);
      return { favorites };
    });
  };

  private toggleCollapsed = (group: Resolution["group"]) => {
    this.setState((state) => ({
      collapsed: state.collapsed.includes(group) ? state.collapsed.filter((entry) => entry !== group) : [...state.collapsed, group],
    }));
  };

  render() {
    const market = this.context.engine.market;
    const current = market.resolution;
    const shown = this.state.favorites.length ? [...this.state.favorites, ...(this.state.favorites.includes(current.id) ? [] : [current.id])] : [current.id];
    const single = this.state.favorites.length === 0;
    const rect = this.wrapRef.current?.getBoundingClientRect();

    return (
      <div ref={this.wrapRef} className={styles.ivWrap}>
        {shown.map((id) => {
          const resolution = RESOLUTIONS.find((entry) => entry.id === id)!;
          const style = !single ? { minWidth: `${12 + (resolution.label.length === 1 ? 10 : 8.5 * resolution.label.length)}px` } : undefined;
          return (
            <button
              key={id}
              type="button"
              className={cx(styles.ivBtn, single && styles.single, id === current.id && !single && styles.active)}
              title={resolution.title}
              style={style}
              onClick={() => (single ? this.toggleMenu() : market.setResolution(id))}
            >
              {resolution.label}
            </button>
          );
        })}
        {!single && (
          <button type="button" className={styles.ivArrow} title="Time Interval" onClick={this.toggleMenu}>
            <TopBarIcons.chevron />
          </button>
        )}
        {this.state.open &&
          rect &&
          createPortal(
            <div
              ref={(node) => {
                this.menuRef = node;
              }}
              className={styles.ivMenu}
              style={{ left: rect.left, top: rect.bottom + 2 }}
            >
              {GROUPS.map((group, groupIndex) => {
                const collapsed = this.state.collapsed.includes(group);
                const groupRows = RESOLUTIONS.filter((resolution) => resolution.group === group);
                return (
                  <Fragment key={group}>
                    {groupIndex > 0 && <div className={styles.ivSep} />}
                    <div className={styles.ivHead} onClick={() => this.toggleCollapsed(group)}>
                      <span>{group}</span>
                      <span className={styles.ivCaret}>
                        <TopBarIcons.chevron up={!collapsed} />
                      </span>
                    </div>
                    {!collapsed &&
                      groupRows.map((resolution) => {
                        const favorite = this.state.favorites.includes(resolution.id);
                        return (
                          <div
                            key={resolution.id}
                            className={cx(styles.ivItem, resolution.id === current.id && styles.active)}
                            onClick={() => {
                              this.setState({ open: false });
                              market.setResolution(resolution.id);
                            }}
                          >
                            <span className={styles.ivLabel}>{resolution.title}</span>
                            <span
                              className={cx(styles.ivStar, favorite && styles.starOn)}
                              title={favorite ? "Remove from favorites" : "Add to favorites"}
                              onClick={(event) => {
                                event.stopPropagation();
                                this.toggleFavorite(resolution.id);
                              }}
                            >
                              <TopBarIcons.star filled={favorite} />
                            </span>
                          </div>
                        );
                      })}
                  </Fragment>
                );
              })}
            </div>,
            document.body,
          )}
      </div>
    );
  }
}

interface ChartTypeState {
  open: boolean;
  type: ChartTypeId;
}

class ChartTypeControl extends Component<object, ChartTypeState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  private buttonRef = createRef<HTMLButtonElement>();
  private menuRef: HTMLDivElement | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(props: object, context: React.ContextType<typeof LabContext>) {
    super(props, context);
    this.state = { open: false, type: context.engine.style.type };
  }

  componentDidMount() {
    this.unsubscribe = this.context.engine.style.subscribe(() => this.setState({ type: this.context.engine.style.type }));
  }

  componentDidUpdate(_: object, prevState: ChartTypeState) {
    if (prevState.open !== this.state.open) {
      if (this.state.open) {
        document.addEventListener("mousedown", this.onOutside, true);
        document.addEventListener("keydown", this.onEscape, true);
      } else {
        document.removeEventListener("mousedown", this.onOutside, true);
        document.removeEventListener("keydown", this.onEscape, true);
      }
    }
  }

  componentWillUnmount() {
    this.unsubscribe?.();
    document.removeEventListener("mousedown", this.onOutside, true);
    document.removeEventListener("keydown", this.onEscape, true);
  }

  private onOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (this.buttonRef.current?.contains(target) || this.menuRef?.contains(target)) return;
    this.setState({ open: false });
  };

  private onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.setState({ open: false });
  };

  render() {
    const current = CHART_TYPES.find((entry) => entry.id === this.state.type)!;
    const CurrentIcon = Icons[current.icon as keyof typeof Icons] as IconComponent;
    const rect = this.buttonRef.current?.getBoundingClientRect();
    return (
      <>
        <button
          ref={this.buttonRef}
          type="button"
          className={cx(styles.topBtn, styles.pill, styles.pillIcon, this.state.open && styles.menuOn)}
          title={current.label}
          onClick={() => this.setState((state) => ({ open: !state.open }))}
        >
          <CurrentIcon />
        </button>
        {this.state.open &&
          rect &&
          createPortal(
            <div
              ref={(node) => {
                this.menuRef = node;
              }}
              className={styles.ctMenu}
              style={{ left: rect.left, top: rect.bottom + 2 }}
            >
              {CHART_TYPES.map((type) => (
                <Fragment key={type.id}>
                  {type.id === "ha" && <div className={styles.ctSep} />}
                  <ChartTypeItem
                    active={type.id === this.state.type}
                    iconName={type.icon}
                    label={type.label}
                    onClick={() => {
                      this.context.engine.style.set(type.id);
                      this.setState({ open: false });
                    }}
                  />
                </Fragment>
              ))}
            </div>,
            document.body,
          )}
      </>
    );
  }
}

interface SnapshotState {
  open: boolean;
}

class SnapshotButton extends Component<object, SnapshotState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: SnapshotState = { open: false };
  private buttonRef = createRef<HTMLButtonElement>();
  private menuRef: HTMLDivElement | null = null;

  componentDidMount() {
    document.addEventListener("keydown", this.onShortcut);
  }

  componentDidUpdate(_: object, prevState: SnapshotState) {
    if (prevState.open !== this.state.open) {
      if (this.state.open) {
        document.addEventListener("mousedown", this.onOutside, true);
        document.addEventListener("keydown", this.onEscape, true);
      } else {
        document.removeEventListener("mousedown", this.onOutside, true);
        document.removeEventListener("keydown", this.onEscape, true);
      }
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onShortcut);
    document.removeEventListener("mousedown", this.onOutside, true);
    document.removeEventListener("keydown", this.onEscape, true);
  }

  private toBlob() {
    return new Promise<Blob>((resolve, reject) =>
      this.context.engine.chart.takeScreenshot(true).toBlob((blob) => (blob ? resolve(blob) : reject(new Error("empty screenshot"))), "image/png"),
    );
  }

  private async save() {
    const symbol = this.context.engine.market.symbol.symbol;
    const url = URL.createObjectURL(await this.toBlob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${symbol}_${snapshotStamp()}.png`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async copy() {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": this.toBlob() })]);
  }

  private async openImage() {
    const url = URL.createObjectURL(await this.toBlob());
    window.open(url, "_blank");
  }

  private onShortcut = (event: KeyboardEvent) => {
    if (!this.context.engine.keysEnabled || !event.metaKey || event.code !== "KeyS") return;
    if (event.altKey) void this.save();
    else if (event.shiftKey) void this.copy().catch(() => undefined);
    else return;
    event.preventDefault();
  };

  private onOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (this.buttonRef.current?.contains(target) || this.menuRef?.contains(target)) return;
    this.setState({ open: false });
  };

  private onEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.setState({ open: false });
  };

  render() {
    const rect = this.buttonRef.current?.getBoundingClientRect();
    const rows: Array<{ Icon: IconComponent; label: string; key?: string; run?: () => Promise<void> | void }> = [
      { Icon: Icons.snapSave, label: "Save chart image", key: "⌥⌘S", run: () => this.save() },
      { Icon: Icons.snapCopy, label: "Copy chart image", key: "⇧⌘S", run: () => this.copy() },
      { Icon: Icons.snapLink, label: "Copy link to the chart image", key: "⌥S" },
      { Icon: Icons.snapOpen, label: "Open image in new tab", run: () => this.openImage() },
      { Icon: Icons.snapTweet, label: "Tweet chart image" },
    ];

    return (
      <>
        <button
          ref={this.buttonRef}
          type="button"
          className={cx(styles.topBtn, this.state.open && styles.menuOn)}
          title="Take a snapshot"
          onClick={() => this.setState((state) => ({ open: !state.open }))}
        >
          <Icons.camera />
        </button>
        {this.state.open &&
          rect &&
          createPortal(
            <div
              ref={(node) => {
                this.menuRef = node;
              }}
              className={styles.snapMenu}
              style={{ top: rect.bottom + 2 }}
            >
              {rows.map((row) => (
                <div
                  key={row.label}
                  className={cx(styles.snapItem, !row.run && styles.off)}
                  onClick={() => {
                    if (!row.run) return;
                    this.setState({ open: false });
                    void row.run();
                  }}
                >
                  <span className={styles.snapIco}>
                    <row.Icon />
                  </span>
                  <span className={styles.snapLabel}>{row.label}</span>
                  {row.key && <span className={styles.snapKey}>{row.key}</span>}
                </div>
              ))}
            </div>,
            document.body,
          )}
      </>
    );
  }
}

interface ChartTypeItemProps {
  active: boolean;
  iconName: keyof typeof Icons;
  label: string;
  onClick(): void;
}

class ChartTypeItem extends Component<ChartTypeItemProps> {
  render() {
    const Icon = Icons[this.props.iconName] as IconComponent;
    return (
      <div className={cx(styles.ctItem, this.props.active && styles.active)} onClick={this.props.onClick}>
        <span>
          <Icon />
        </span>
        <span>{this.props.label}</span>
      </div>
    );
  }
}
