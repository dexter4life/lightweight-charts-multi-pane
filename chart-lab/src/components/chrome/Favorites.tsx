import { Component, createRef } from "react";
import type * as React from "react";
import { createPortal } from "react-dom";
import type { DrawingController } from "../../controller";
import { Icons, toolIcons } from "../icons";
import { ALL_ITEMS } from "../../data/tool-groups";
import styles from "./Favorites.module.css";
import { clamp, cx, readStorage, writeStorage } from "./utils";

const POS_KEY = "chartlab.favorites.pos";

interface Props {
  ctl: DrawingController;
  host: HTMLElement;
  ids: string[];
  visible: boolean;
  activeTool: string;
}

interface State {
  left: number;
  top: number;
  ready: boolean;
}

export class Favorites extends Component<Props, State> {
  state: State = { left: 0, top: 0, ready: false };

  private barRef = createRef<HTMLDivElement>();
  private gripRef = createRef<HTMLSpanElement>();
  private raf = 0;
  private saved = readStorage<{ left: number; top: number } | null>(POS_KEY, null);
  private detachDrag: (() => void) | null = null;

  componentDidMount() {
    window.addEventListener("resize", this.schedulePlace);
    this.place();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.ids !== this.props.ids || prevProps.visible !== this.props.visible) this.schedulePlace();
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.schedulePlace);
    cancelAnimationFrame(this.raf);
    this.detachDrag?.();
  }

  private schedulePlace = () => {
    cancelAnimationFrame(this.raf);
    this.raf = window.requestAnimationFrame(this.place);
  };

  private place = () => {
    const bar = this.barRef.current;
    if (!bar || !this.props.ids.length || !this.props.visible) return;
    const { host } = this.props;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const baseLeft = this.saved ? this.saved.left : (width - 62) / 2 + 3;
    const baseTop = this.saved ? this.saved.top : 57;
    const left = clamp(baseLeft, 0, Math.max(0, width - bar.offsetWidth));
    const top = clamp(baseTop, 0, Math.max(0, height - bar.offsetHeight));
    if (!this.state.ready || this.state.left !== left || this.state.top !== top) this.setState({ left, top, ready: true });
  };

  private onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!this.gripRef.current?.contains(event.target as Node)) return;
    const bar = this.barRef.current;
    if (!bar) return;
    event.preventDefault();
    const hostRect = this.props.host.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const dx = event.clientX - barRect.left;
    const dy = event.clientY - barRect.top;
    const move = (next: MouseEvent) => {
      const left = clamp(next.clientX - hostRect.left - dx, 0, Math.max(0, this.props.host.clientWidth - bar.offsetWidth));
      const top = clamp(next.clientY - hostRect.top - dy, 0, Math.max(0, this.props.host.clientHeight - bar.offsetHeight));
      this.saved = { left, top };
      this.setState({ left, top, ready: true });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      this.detachDrag = null;
      if (this.saved) writeStorage(POS_KEY, this.saved);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    this.detachDrag = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
  };

  render() {
    const shown = this.props.ids
      .map((id) => ({ id, item: ALL_ITEMS.find((entry) => entry.id === id) }))
      .filter((entry): entry is { id: string; item: NonNullable<(typeof ALL_ITEMS)[number]> } => !!entry.item);
    const display = shown.length && this.props.visible ? "flex" : "none";
    const style = {
      display,
      left: this.state.ready ? `${this.state.left}px` : undefined,
      top: this.state.ready ? `${this.state.top}px` : undefined,
    };

    return createPortal(
      <div ref={this.barRef} className={styles.favTb} style={style} onMouseDown={this.onMouseDown}>
        <span ref={this.gripRef} className={styles.favGrip}>
          <Icons.ftbGrip />
        </span>
        {shown.map(({ id, item }) => {
          const Icon = toolIcons[id];
          return (
            <button key={id} type="button" className={cx(styles.favBtn, this.props.activeTool === id && styles.active)} title={item.label} aria-label={item.label} onClick={() => this.props.ctl.setTool(id)}>
              {Icon ? <Icon /> : null}
            </button>
          );
        })}
      </div>,
      this.props.host,
    );
  }
}
