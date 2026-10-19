import { Component, createRef } from "react";
import { createPortal } from "react-dom";
import topStyles from "../chrome/TopBar.module.css";
import { cx } from "../chrome/utils";
import { layouts } from "./layouts";
import styles from "./LayoutPicker.module.css";
import type { GridLayoutPreset } from "@ui/gridlayout";

interface Props {
  preset: GridLayoutPreset;
  onChange(preset: GridLayoutPreset): void;
}

interface State {
  open: boolean;
}

const SHAPES = layouts.flatMap((row) => row.shapes);

/** Top-bar button that opens the grid of chart-split presets and shows the active one. */
export class LayoutPicker extends Component<Props, State> {
  state: State = { open: false };

  private buttonRef = createRef<HTMLButtonElement>();
  private menuRef: HTMLDivElement | null = null;

  componentDidUpdate(_: Props, prevState: State) {
    if (prevState.open === this.state.open) return;
    if (this.state.open) {
      document.addEventListener("mousedown", this.onOutside, true);
      document.addEventListener("keydown", this.onEscape, true);
    } else this.detach();
  }

  componentWillUnmount() {
    this.detach();
  }

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

  render() {
    const { preset, onChange } = this.props;
    const current = SHAPES.find((shape) => shape.preset === preset) ?? SHAPES[0];
    const rect = this.buttonRef.current?.getBoundingClientRect();
    return (
      <>
        <button
          ref={this.buttonRef}
          type="button"
          className={cx(topStyles.topBtn, styles.btn, this.state.open && topStyles.menuOn)}
          title="Chart layout"
          onClick={() => this.setState((state) => ({ open: !state.open }))}
        >
          {current.icon}
        </button>
        {this.state.open &&
          rect &&
          createPortal(
            <div
              ref={(node) => {
                this.menuRef = node;
              }}
              className={styles.menu}
              style={{ left: Math.max(8, Math.min(rect.left, window.innerWidth - 330)), top: rect.bottom + 2 }}
              role="menu"
            >
              {layouts.map((row) => (
                <div key={row.panes} className={styles.row}>
                  <span className={styles.count}>{row.panes}</span>
                  <div className={styles.shapes}>
                    {row.shapes.map((shape) => (
                      <button
                        key={shape.preset}
                        type="button"
                        role="menuitemradio"
                        aria-checked={shape.preset === current.preset}
                        aria-label={shape.preset}
                        className={cx(styles.item, shape.preset === current.preset && styles.on)}
                        onClick={() => {
                          onChange(shape.preset);
                          this.setState({ open: false });
                        }}
                      >
                        {shape.icon}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>,
            document.body,
          )}
      </>
    );
  }
}
