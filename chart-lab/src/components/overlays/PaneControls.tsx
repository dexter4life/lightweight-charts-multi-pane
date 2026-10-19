import { Component } from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import { watchPaneHosts } from "../../app/paneHosts";
import { PaneIcons } from "../icons/ui";
import styles from "./PaneControls.module.css";

interface State {
  tick: number;
}

const cx = (...tokens: Array<string | false | null | undefined>) => tokens.filter(Boolean).join(" ");

const isDark = (hex: string) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return false;
  const value = parseInt(match[1], 16);
  return 0.299 * (value >> 16) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255) < 128;
};

/** The buttons in the top-right corner of every pane once the chart has more than one: move, delete, collapse, maximize. */
export class PaneControls extends Component<object, State> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: State = { tick: 0 };

  private unsubLayout: (() => void) | null = null;
  private unsubSettings: (() => void) | null = null;
  private unsubInd: (() => void) | null = null;
  private unsubHosts: (() => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;

  componentDidMount() {
    const { engine } = this.context;
    this.unsubLayout = engine.panes.subscribe(this.refresh);
    this.unsubSettings = engine.settings.subscribe(this.refresh);
    this.unsubInd = engine.indicators.subscribe(this.refresh);
    this.unsubHosts = watchPaneHosts(engine.chart, this.refresh);
    this.resizeObserver = new ResizeObserver(() => engine.panes.resize());
    this.resizeObserver.observe(engine.overlayHost);
  }

  componentWillUnmount() {
    this.unsubLayout?.();
    this.unsubSettings?.();
    this.unsubInd?.();
    this.unsubHosts?.();
    this.resizeObserver?.disconnect();
  }

  private refresh = () => this.setState((state) => ({ tick: state.tick + 1 }));

  private deletePane = (index: number) => {
    const { engine } = this.context;
    const saved = engine.indicators.inPane(index).flatMap((ind) => engine.indicators.snapshot(ind.id) ?? []);
    if (!saved.length) return;
    engine.panes.remove(index);
    engine.ctl.recordAction(
      "delete pane",
      () => saved.forEach((snap) => engine.indicators.restore(snap)),
      () => saved.forEach((snap) => engine.indicators.remove(snap.id)),
    );
  };

  render() {
    const { engine } = this.context;
    const layout = engine.panes;
    const count = layout.count();
    if (count < 2) return null;
    const dark = isDark(engine.settings.data.bg);
    // The buttons are children of each pane's control container, so they follow the pane natively as it is resized or moved.
    const hosts = engine.chart.getControlContainers().slice(0, count);
    return (
      <>
        {hosts.map((host, index) => {
          if (layout.isHidden(index)) return null;
          const maximized = layout.isMaximized(index);
          const collapsed = layout.isCollapsed(index);
          return createPortal(
            <div className={cx(styles.bar, dark && styles.dark)}>
              {layout.canMoveUp(index) ? (
                <button type="button" className={styles.button} title="Move pane up" onClick={() => layout.move(index, -1)}>
                  <PaneIcons.up />
                </button>
              ) : null}
              {layout.canMoveDown(index) ? (
                <button type="button" className={styles.button} title="Move pane down" onClick={() => layout.move(index, 1)}>
                  <PaneIcons.down />
                </button>
              ) : null}
              {!maximized && layout.canDelete(index) ? (
                <button type="button" className={styles.button} title="Delete pane" onClick={() => this.deletePane(index)}>
                  <PaneIcons.close />
                </button>
              ) : null}
              {!maximized && layout.canCollapse(index) ? (
                <button type="button" className={cx(styles.button, collapsed && styles.active)} title={collapsed ? "Restore pane" : "Collapse pane"} onClick={() => layout.toggleCollapsed(index)}>
                  {collapsed ? <PaneIcons.restore /> : <PaneIcons.collapse />}
                </button>
              ) : null}
              <button type="button" className={cx(styles.button, maximized && styles.active)} title={maximized ? "Restore pane" : "Maximize pane"} onClick={() => layout.toggleMaximized(index)}>
                <PaneIcons.maximize />
              </button>
            </div>,
            host,
            `pane-${index}`,
          );
        })}
      </>
    );
  }
}
