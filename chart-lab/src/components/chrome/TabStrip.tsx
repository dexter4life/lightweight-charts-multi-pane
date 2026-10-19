import { Component, createRef } from "react";
import { createPortal } from "react-dom";
import { Icons } from "../icons";
import styles from "./TabStrip.module.css";
import { cx } from "./utils";

export interface TabInfo {
  id: string;
  title: string;
  /** Host-provided symbol icon; falls back to the first letter. */
  icon?: React.ReactNode;
}

interface Props {
  tabs: TabInfo[];
  activeId: string;
  onSelect(id: string): void;
  onAdd(): void;
  onClose(id: string): void;
  /** Moves a tab so it ends up at `index` of the resulting order. */
  onReorder(id: string, index: number): void;
}

interface State {
  open: boolean;
  dragId: string | null;
  /** Insertion slot in the current order (0..tabs.length) shown as a marker while dragging. */
  slot: number | null;
}

/** One tab per workspace; each tab owns its own chart grid. */
export class TabStrip extends Component<Props, State> {
  state: State = { open: false, dragId: null, slot: null };

  private stripRef = createRef<HTMLDivElement>();
  private buttonRef = createRef<HTMLButtonElement>();
  private menuRef: HTMLDivElement | null = null;

  componentDidMount() {
    this.reveal(this.props.activeId);
  }

  componentDidUpdate(prev: Props, prevState: State) {
    if (prev.activeId !== this.props.activeId || prev.tabs.length !== this.props.tabs.length) this.reveal(this.props.activeId);
    if (prevState.open === this.state.open) return;
    if (this.state.open) {
      document.addEventListener("mousedown", this.onOutside, true);
      document.addEventListener("keydown", this.onEscape, true);
    } else this.detach();
  }

  componentWillUnmount() {
    this.detach();
  }

  /** Keeps the active tab visible when the strip overflows. */
  private reveal(id: string) {
    const node = this.stripRef.current?.querySelector<HTMLElement>(`[data-tab-id="${id}"]`);
    node?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  private onDragStart = (event: React.DragEvent, id: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    this.setState({ dragId: id });
  };

  private onDragOver = (event: React.DragEvent, index: number) => {
    if (!this.state.dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const slot = event.clientX < rect.left + rect.width / 2 ? index : index + 1;
    if (slot !== this.state.slot) this.setState({ slot });
  };

  private onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const { dragId, slot } = this.state;
    this.endDrag();
    if (!dragId || slot === null) return;
    const from = this.props.tabs.findIndex((t) => t.id === dragId);
    if (from < 0) return;
    const to = slot > from ? slot - 1 : slot;
    if (to !== from) this.props.onReorder(dragId, to);
  };

  private endDrag = () => this.setState({ dragId: null, slot: null });

  private detach() {
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

  private renderMenu() {
    const { tabs, activeId, onSelect, onAdd, onClose } = this.props;
    const rect = this.buttonRef.current?.getBoundingClientRect();
    if (!this.state.open || !rect) return null;
    return createPortal(
      <div
        ref={(node) => {
          this.menuRef = node;
        }}
        className={styles.menu}
        style={{ left: Math.max(8, Math.min(rect.right - 240, window.innerWidth - 248)), top: rect.bottom + 2 }}
        role="menu"
      >
        <div className={styles.menuHead}>Open tabs ({tabs.length})</div>
        <div className={styles.menuList}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              role="menuitemradio"
              aria-checked={tab.id === activeId}
              className={cx(styles.menuItem, tab.id === activeId && styles.menuOn)}
              onClick={() => {
                onSelect(tab.id);
                this.reveal(tab.id);
                this.setState({ open: false });
              }}
            >
              {tab.icon ? (
                <span className={styles.icon}>{tab.icon}</span>
              ) : (
                <span className={styles.badge}>{tab.title.charAt(0)}</span>
              )}
              <span className={styles.title}>{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  className={styles.close}
                  title="Close tab"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(tab.id);
                  }}
                >
                  <Icons.close />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.menuNew}
          onClick={() => {
            onAdd();
            this.setState({ open: false });
          }}
        >
          + New tab
        </button>
      </div>,
      document.body,
    );
  }

  render() {
    const { tabs, activeId, onSelect, onClose } = this.props;
    return (
      <div className={styles.wrap}>
        <div className={styles.strip} role="tablist" ref={this.stripRef}>
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              role="tab"
              aria-selected={tab.id === activeId}
              draggable
              onDragStart={(event) => this.onDragStart(event, tab.id)}
              onDragOver={(event) => this.onDragOver(event, index)}
              onDrop={this.onDrop}
              onDragEnd={this.endDrag}
              className={cx(
                styles.tab,
                tab.id === activeId && styles.on,
                tab.id === this.state.dragId && styles.dragging,
                this.state.dragId && this.state.slot === index && styles.dropBefore,
                this.state.dragId && this.state.slot === index + 1 && index === tabs.length - 1 && styles.dropAfter,
              )}
              onMouseDown={(event) => {
                if (event.button === 1 && tabs.length > 1) onClose(tab.id);
                else if (event.button === 0) onSelect(tab.id);
              }}
            >
              {tab.icon ? (
                <span className={styles.icon}>{tab.icon}</span>
              ) : (
                <span className={styles.badge}>{tab.title.charAt(0)}</span>
              )}
              <span className={styles.title}>{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  className={styles.close}
                  title="Close tab"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => onClose(tab.id)}
                >
                  <Icons.close />
                </button>
              )}
            </div>
          ))}
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <button
          ref={this.buttonRef}
          type="button"
          className={cx(styles.add, this.state.open && styles.addOn)}
          title="Show all tabs"
          aria-haspopup="menu"
          aria-expanded={this.state.open}
          onClick={() => this.setState((state) => ({ open: !state.open }))}
        >
          <Icons.snapCopy />
        </button>
        {this.renderMenu()}
      </div>
    );
  }
}
