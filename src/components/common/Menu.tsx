import { Component, createRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Menu.module.css";

export interface MenuItem {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface MenuProps {
  anchor: HTMLElement;
  items: MenuItem[];
  current: string;
  onPick(v: string): void;
  onClose(): void;
  width?: number;
  className?: string;
  itemClassName?: string;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

export class Menu extends Component<MenuProps> {
  private menuRef = createRef<HTMLDivElement>();
  private listenTimer: number | null = null;

  componentDidMount() {
    this.place();
    this.listenTimer = window.setTimeout(() => {
      document.addEventListener("mousedown", this.handleAway, true);
      document.addEventListener("keydown", this.handleKey, true);
    });
    window.addEventListener("resize", this.place);
  }

  componentDidUpdate(prevProps: MenuProps) {
    if (prevProps.anchor !== this.props.anchor || prevProps.items !== this.props.items || prevProps.width !== this.props.width) {
      this.place();
    }
  }

  componentWillUnmount() {
    if (this.listenTimer !== null) window.clearTimeout(this.listenTimer);
    document.removeEventListener("mousedown", this.handleAway, true);
    document.removeEventListener("keydown", this.handleKey, true);
    window.removeEventListener("resize", this.place);
  }

  private handleAway = (e: MouseEvent) => {
    const menu = this.menuRef.current;
    if (menu && !menu.contains(e.target as Node)) this.props.onClose();
  };

  private handleKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    this.props.onClose();
  };

  private place = () => {
    const menu = this.menuRef.current;
    if (!menu) return;
    const rect = this.props.anchor.getBoundingClientRect();
    menu.style.minWidth = `${this.props.width ?? rect.width}px`;
    menu.style.left = `${rect.left}px`;
    let top = rect.bottom + 4;
    if (top + menu.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - menu.offsetHeight - 4);
    menu.style.top = `${top}px`;
  };

  private pick = (value: string) => {
    this.props.onClose();
    this.props.onPick(value);
  };

  render() {
    return createPortal(
      <div className={cx(styles.sdMenu, this.props.className)} data-popup="" ref={this.menuRef}>
        {this.props.items.map((item) => (
          <button
            key={item.value}
            type="button"
            className={cx(styles.sdMi, this.props.itemClassName, item.value === this.props.current && styles.sel)}
            onClick={() => this.pick(item.value)}
          >
            {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
            <span>{item.label}</span>
          </button>
        ))}
      </div>,
      document.body,
    );
  }
}
