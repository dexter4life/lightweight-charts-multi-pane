import { Component, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import { Icons } from "../icons";
import styles from "./ContextMenu.module.css";
import { subscribeFloatingToolbarMenu, type FloatingToolbarMenuRequest } from "./menuBus";

interface ContextMenuState {
  levels: MenuLevel[];
}

interface Item {
  label: string;
  icon?: ReactNode;
  keys?: string;
  disabled?: boolean;
  run?: () => void;
  sub?: Item[];
  iconCell?: boolean;
}

type Entry = Item | "sep";

type MenuLevel = {
  entries: Entry[];
  x: number;
  y: number;
  flipTo?: number;
  iconCell?: boolean;
};

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const CMD = MAC ? "⌘" : "Ctrl+";
const cx = (...tokens: Array<string | false | null | undefined>) => tokens.filter(Boolean).join(" ");

export class ContextMenu extends Component<object, ContextMenuState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: ContextMenuState = { levels: [] };

  private menuEls = new Map<number, HTMLDivElement | null>();
  private unsubToolbar: (() => void) | null = null;

  componentDidMount() {
    const { engine } = this.context;
    const host = engine.chartHost;
    host.addEventListener("mousedown", this.onHostMouseDown, true);
    host.addEventListener("pointerdown", this.onHostPointerDown, true);
    host.addEventListener("contextmenu", this.onContextMenu);
    this.unsubToolbar = subscribeFloatingToolbarMenu(this.onToolbarMenu);
  }

  componentDidUpdate(_: object, prevState: ContextMenuState) {
    if (!prevState.levels.length && this.state.levels.length) {
      document.addEventListener("mousedown", this.onOutside, true);
      document.addEventListener("keydown", this.onEsc, true);
      window.addEventListener("blur", this.close);
    } else if (prevState.levels.length && !this.state.levels.length) {
      document.removeEventListener("mousedown", this.onOutside, true);
      document.removeEventListener("keydown", this.onEsc, true);
      window.removeEventListener("blur", this.close);
    }
  }

  componentWillUnmount() {
    const { engine } = this.context;
    const host = engine.chartHost;
    host.removeEventListener("mousedown", this.onHostMouseDown, true);
    host.removeEventListener("pointerdown", this.onHostPointerDown, true);
    host.removeEventListener("contextmenu", this.onContextMenu);
    document.removeEventListener("mousedown", this.onOutside, true);
    document.removeEventListener("keydown", this.onEsc, true);
    window.removeEventListener("blur", this.close);
    this.unsubToolbar?.();
  }

  private onHostMouseDown = (event: MouseEvent) => {
    if (event.button === 2) event.stopPropagation();
  };

  private onHostPointerDown = (event: PointerEvent) => {
    if (event.button === 2) event.stopPropagation();
  };

  private onOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (this.state.levels.some((_, index) => this.menuEls.get(index)?.contains(target))) return;
    this.close();
  };

  private onEsc = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.close();
  };

  private close = () => this.setState({ levels: [] });

  private onToolbarMenu = ({ x, y }: FloatingToolbarMenuRequest) => {
    if (!this.context.engine.ctl.getSelected()) return;
    this.show(this.moreEntries(), x, y);
  };

  private onContextMenu = (event: MouseEvent) => {
    const { engine } = this.context;
    event.preventDefault();
    const rect = engine.chartHost.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const hit = engine.ctl.manager.hitTest({ x: px, y: py });
    if (hit) {
      engine.ctl.manager.selectDrawing(hit.id);
      this.show(this.drawingEntries(), event.clientX, event.clientY);
      return;
    }
    this.show(this.chartEntries(engine.ctl.seriesApi.coordinateToPrice(py), px), event.clientX, event.clientY);
  };

  private show(entries: Entry[], x: number, y: number, iconCell = false) {
    this.setState({ levels: [{ entries, x, y, iconCell }] });
  }

  private chartEntries(price: number | null, x: number): Entry[] {
    const { engine } = this.context;
    return [
      { label: "Reset chart view", icon: <Icons.cmReset />, keys: MAC ? "⌥R" : "Alt+R", run: () => engine.ctl.resetView() },
      "sep",
      {
        label: price === null ? "Copy price" : `Copy price ${price.toFixed(2)}`,
        disabled: price === null,
        run: () => void navigator.clipboard?.writeText(String(price?.toFixed(2))).catch(() => undefined),
      },
      { label: "Paste", keys: `${CMD}V`, disabled: !engine.ctl.canPaste(), run: () => engine.ctl.paste() },
      "sep",
      { label: "Lock vertical cursor line by time", icon: engine.ctl.cursorLocked ? <Icons.cmCursor /> : undefined, run: () => engine.ctl.toggleCursorLock(x) },
      "sep",
      {
        label: "Lines",
        iconCell: true,
        sub: [
          { label: "Price line", icon: engine.ctl.priceLineVisible ? <Icons.cmCheck /> : undefined, run: () => engine.ctl.togglePriceLine() },
          { label: "High and low price lines", icon: engine.ctl.highLowVisible ? <Icons.cmCheck /> : undefined, run: () => engine.ctl.toggleHighLowLines() },
        ],
      },
      "sep",
      { label: "Remove drawings", run: () => engine.ctl.removeAll() },
      { label: "Remove indicators", disabled: true },
      "sep",
      { label: "Hide marks on bars", disabled: true },
      "sep",
      { label: "Settings…", icon: <Icons.gear />, disabled: true },
    ];
  }

  private drawingEntries(): Entry[] {
    const { engine, ui } = this.context;
    const locked = !!engine.ctl.getSelected()?.options.locked;
    const order = (label: string, position: "front" | "back" | "forward" | "backward"): Item => ({
      label,
      disabled: !engine.ctl.canReorder(position),
      run: () => engine.ctl.reorderSelected(position),
    });
    return [
      {
        label: "Visual order",
        icon: <Icons.cmOrder />,
        sub: [order("Bring to front", "front"), order("Send to back", "back"), order("Bring forward", "forward"), order("Send backward", "backward")],
      },
      {
        label: "Visibility on intervals",
        sub: ["Current interval and above", "Current interval and below", "Current interval only", "All intervals"].map((label) => ({ label })),
      },
      { label: "Object Tree…", run: () => ui.toggleObjectTree() },
      "sep",
      { label: "Clone", icon: <Icons.cmClone />, keys: `${CMD}Drag`, run: () => engine.ctl.cloneSelected() },
      { label: "Copy", keys: `${CMD}C`, run: () => engine.ctl.copySelected() },
      "sep",
      { label: locked ? "Unlock" : "Lock", icon: locked ? <Icons.ftbLockOpen /> : <Icons.ftbLock />, run: () => engine.ctl.toggleSelectedLock() },
      { label: "Hide", icon: <Icons.cmEyeOff />, run: () => engine.ctl.hideSelected() },
      { label: "Remove", icon: <Icons.ftbTrash />, keys: "⌫", disabled: locked, run: () => engine.ctl.removeSelected() },
      "sep",
      { label: "Settings…", icon: <Icons.gear />, run: () => engine.ctl.openSettings() },
    ];
  }

  private moreEntries(): Entry[] {
    const all = this.drawingEntries();
    const pick = (label: string) => all.find((entry): entry is Item => entry !== "sep" && entry.label === label)!;
    return [pick("Visual order"), pick("Visibility on intervals"), "sep", pick("Clone"), pick("Copy"), "sep", pick("Hide")];
  }

  private openSubmenu(depth: number, item: Item, row: HTMLDivElement) {
    if (!item.sub || item.disabled) {
      this.setState((state) => ({ levels: state.levels.slice(0, depth + 1) }));
      return;
    }
    const parentRect = this.menuEls.get(depth)?.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const next: MenuLevel = { entries: item.sub, x: rowRect.right, y: rowRect.top - 6, flipTo: parentRect?.left, iconCell: item.iconCell };
    this.setState((state) => ({ levels: [...state.levels.slice(0, depth + 1), next] }));
  }

  private positionMenu(depth: number) {
    const menu = this.menuEls.get(depth);
    const level = this.state.levels[depth];
    if (!menu || !level) return;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left = level.x;
    if (left + width > window.innerWidth - 4) left = level.flipTo !== undefined ? level.flipTo - width : window.innerWidth - width - 4;
    menu.style.left = `${Math.max(4, left)}px`;
    menu.style.top = `${Math.max(4, Math.min(level.y, window.innerHeight - height))}px`;
  }

  private renderMenu(depth: number, level: MenuLevel) {
    const items = level.entries.filter((entry): entry is Item => entry !== "sep");
    return (
      <div
        key={`menu-${depth}`}
        ref={(node) => {
          this.menuEls.set(depth, node);
          if (node) requestAnimationFrame(() => this.positionMenu(depth));
        }}
        className={cx(styles.cm, depth > 0 && styles.sub, !level.iconCell && depth > 0 && !items.some((item) => item.icon) && styles.noico)}
      >
        {level.entries.map((entry, index) => {
          if (entry === "sep") return <div key={`sep-${depth}-${index}`} className={styles.cmSep} />;
          const hot = depth < this.state.levels.length - 1 && this.state.levels[depth + 1]?.entries === entry.sub;
          return (
            <div
              key={`${entry.label}-${index}`}
              className={cx(styles.cmRow, entry.disabled && styles.dis, hot && styles.hot)}
              onMouseEnter={(event) => this.openSubmenu(depth, entry, event.currentTarget)}
              onClick={() => {
                if (entry.disabled || entry.sub) return;
                this.close();
                entry.run?.();
              }}
            >
              <span className={styles.cmIco}>{entry.icon}</span>
              <span className={styles.cmLabel}>{entry.label}</span>
              {entry.keys ? <span className={styles.cmKey}>{entry.keys}</span> : null}
              {entry.sub ? <span className={styles.cmArrow}><Icons.chevron /></span> : null}
            </div>
          );
        })}
      </div>
    );
  }

  render() {
    if (!this.state.levels.length) return null;
    return createPortal(<>{this.state.levels.map((level, index) => this.renderMenu(index, level))}</>, document.body);
  }
}
