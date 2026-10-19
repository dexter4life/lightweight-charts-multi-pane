import { Component, createRef, type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ColorPaletteIcons } from "../icons";
import { composeColor, parseColor, type PaletteValue } from "./color";
import styles from "./ColorPalette.module.css";

const GRAYS = ["#ffffff", "#d1d4dc", "#b2b5be", "#9598a1", "#787b86", "#5d606b", "#434651", "#2a2e39", "#1f1f1f", "#000000"];
const HUES = ["#f23645", "#ff9800", "#ffeb3b", "#4caf50", "#089981", "#00bcd4", "#2962ff", "#673ab7", "#9c27b0", "#e91e63"];
const SHADES = [
  ["#fccbcd", "#ffe0b2", "#fff9c4", "#c8e6c9", "#ace5dc", "#b2ebf2", "#bbd9fb", "#d1c4e9", "#e1bee7", "#f8bbd0"],
  ["#faa1a4", "#ffcc80", "#fff59d", "#a5d6a7", "#70ccbd", "#80deea", "#90bff9", "#b39ddb", "#ce93d8", "#f48fb1"],
  ["#f77c80", "#ffb74d", "#fff176", "#81c784", "#42bda8", "#4dd0e1", "#5b9cf6", "#9575cd", "#ba68c8", "#f06292"],
  ["#f7525f", "#ffa726", "#ffee58", "#66bb6a", "#22ab94", "#26c6da", "#3179f5", "#7e57c2", "#ab47bc", "#ec407a"],
  ["#b22833", "#f57c00", "#fbc02d", "#388e3c", "#056656", "#0097a7", "#1848cc", "#512da8", "#7b1fa2", "#c2185b"],
  ["#801922", "#e65100", "#f57f17", "#1b5e20", "#00332a", "#006064", "#0c3299", "#311b92", "#4a148c", "#880e4f"],
];
interface ColorPaletteProps {
  anchor: HTMLElement;
  value: PaletteValue;
  thickness?: boolean;
  onChange(v: PaletteValue): void;
  onClose(): void;
}

interface ColorPaletteState {
  hex: string;
  alpha: number;
  width?: number;
  dash?: PaletteValue["dash"];
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

function deriveState(value: PaletteValue): ColorPaletteState {
  const parsed = parseColor(value.color);
  return { hex: parsed.hex, alpha: value.opacity ?? parsed.alpha, width: value.width, dash: value.dash };
}

function sameValue(a: PaletteValue, b: PaletteValue): boolean {
  return a.color === b.color && a.opacity === b.opacity && a.width === b.width && a.dash === b.dash;
}

export class ColorPalette extends Component<ColorPaletteProps, ColorPaletteState> {
  state: ColorPaletteState = deriveState(this.props.value);

  private paletteRef = createRef<HTMLDivElement>();
  private sliderRef = createRef<HTMLDivElement>();
  private customRef = createRef<HTMLInputElement>();
  private listenTimer: number | null = null;
  private activePointerId: number | null = null;

  componentDidMount() {
    this.place();
    this.listenTimer = window.setTimeout(() => {
      document.addEventListener("mousedown", this.handleAway, true);
      document.addEventListener("keydown", this.handleKey, true);
    });
    window.addEventListener("resize", this.place);
  }

  componentDidUpdate(prevProps: ColorPaletteProps) {
    if (!sameValue(prevProps.value, this.props.value)) {
      const next = deriveState(this.props.value);
      if (next.hex !== this.state.hex || next.alpha !== this.state.alpha || next.width !== this.state.width || next.dash !== this.state.dash) {
        this.setState(next);
        return;
      }
    }
    if (prevProps.anchor !== this.props.anchor || prevProps.thickness !== this.props.thickness) this.place();
  }

  componentWillUnmount() {
    if (this.listenTimer !== null) window.clearTimeout(this.listenTimer);
    document.removeEventListener("mousedown", this.handleAway, true);
    document.removeEventListener("keydown", this.handleKey, true);
    window.removeEventListener("resize", this.place);
  }

  private handleAway = (e: MouseEvent) => {
    const palette = this.paletteRef.current;
    if (!palette) return;
    const target = e.target as Node;
    if (!palette.contains(target) && !this.props.anchor.contains(target)) this.props.onClose();
  };

  private handleKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    this.props.onClose();
  };

  private place = () => {
    const palette = this.paletteRef.current;
    if (!palette) return;
    const rect = this.props.anchor.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - palette.offsetWidth - 8);
    let top = rect.bottom + 4;
    if (top + palette.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - palette.offsetHeight - 4);
    palette.style.left = `${left}px`;
    palette.style.top = `${top}px`;
  };

  private emit(next: Partial<ColorPaletteState>) {
    const value = {
      hex: next.hex ?? this.state.hex,
      alpha: next.alpha ?? this.state.alpha,
      width: next.width === undefined ? this.state.width : next.width,
      dash: next.dash === undefined ? this.state.dash : next.dash,
    };
    this.props.onChange({ color: composeColor(value.hex, value.alpha), opacity: value.alpha, width: value.width, dash: value.dash });
  }

  private selectColor = (hex: string) => {
    this.setState({ hex });
    this.emit({ hex });
  };

  private selectWidth = (width: number) => {
    this.setState({ width });
    this.emit({ width });
  };

  private selectDash = (dash: NonNullable<PaletteValue["dash"]>) => {
    this.setState({ dash });
    this.emit({ dash });
  };

  private openCustom = () => {
    const input = this.customRef.current;
    if (!input) return;
    input.value = this.state.hex;
    input.click();
  };

  private onCustomInput = (e: ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    this.setState({ hex });
    this.emit({ hex });
  };

  private setAlphaFromPointer = (clientX: number) => {
    const slider = this.sliderRef.current;
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    const alpha = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    this.setState({ alpha });
    this.emit({ alpha });
  };

  private onSliderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    this.activePointerId = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    this.setAlphaFromPointer(e.clientX);
  };

  private onSliderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (this.activePointerId !== e.pointerId) return;
    this.setAlphaFromPointer(e.clientX);
  };

  private onSliderPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (this.activePointerId !== e.pointerId) return;
    this.activePointerId = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  private onPercentChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(100, Math.max(0, Number(e.target.value) || 0));
    const alpha = value / 100;
    this.setState({ alpha });
    this.emit({ alpha });
  };

  render() {
    const opacity = Math.round(this.state.alpha * 100);
    return createPortal(
      <div className={cx(styles.pal, !this.props.thickness && styles.noTh, this.state.dash !== undefined && styles.hasDash)} data-popup="" ref={this.paletteRef}>
        <div className={styles.palGrid}>
          {GRAYS.map((color) => (
            <button
              key={color}
              type="button"
              className={cx(styles.palSw, color === this.state.hex && styles.sel)}
              data-c={color}
              style={{ background: color }}
              onClick={() => this.selectColor(color)}
            />
          ))}
          {HUES.map((color) => (
            <button
              key={color}
              type="button"
              className={cx(styles.palSw, color === this.state.hex && styles.sel)}
              data-c={color}
              style={{ background: color }}
              onClick={() => this.selectColor(color)}
            />
          ))}
          {SHADES.flat().map((color) => (
            <button
              key={color}
              type="button"
              className={cx(styles.palSw, color === this.state.hex && styles.sel)}
              data-c={color}
              style={{ background: color }}
              onClick={() => this.selectColor(color)}
            />
          ))}
        </div>
        <div className={styles.palSep} />
        <button type="button" className={styles.palPlus} title="Add custom color" onClick={this.openCustom}>
          <ColorPaletteIcons.plus aria-hidden="true" />
        </button>
        <div className={cx(styles.palSep, styles.palSep2)} />
        <div className={cx(styles.palLbl, styles.palOp)}>Opacity</div>
        <div
          className={styles.palSlider}
          ref={this.sliderRef}
          style={{ ["--c" as "--c"]: this.state.hex } as CSSProperties}
          onPointerDown={this.onSliderPointerDown}
          onPointerMove={this.onSliderPointerMove}
          onPointerUp={this.onSliderPointerUp}
          onPointerCancel={this.onSliderPointerUp}
        >
          <i className={styles.palTrack} />
          <i className={styles.palThumb} style={{ left: `${this.state.alpha * 100}%` }} />
        </div>
        <div className={styles.palPct}>
          <input value={opacity} onChange={this.onPercentChange} />
          <span>%</span>
        </div>
        {this.props.thickness ? (
          <>
            <div className={cx(styles.palLbl, styles.palTh)}>Thickness</div>
            <div className={styles.palWidths}>
              {[1, 2, 3, 4].map((width) => (
                <button key={width} type="button" className={cx(styles.palW, width === this.state.width && styles.sel)} data-w={width} onClick={() => this.selectWidth(width)}>
                  <i style={{ height: `${width}px` }} />
                </button>
              ))}
            </div>
          </>
        ) : null}
        {this.props.thickness && this.state.dash !== undefined ? (
          <>
            <div className={cx(styles.palLbl, styles.palLs)}>Line style</div>
            <div className={cx(styles.palWidths, styles.palDashes)}>
              {(["solid", "dashed", "dotted"] as const).map((dash) => (
                <button key={dash} type="button" className={cx(styles.palW, dash === this.state.dash && styles.sel)} title={dash} onClick={() => this.selectDash(dash)}>
                  <i className={styles[dash]} />
                </button>
              ))}
            </div>
          </>
        ) : null}
        <input ref={this.customRef} type="color" className={styles.palNative} onChange={this.onCustomInput} />
      </div>,
      document.body,
    );
  }
}
