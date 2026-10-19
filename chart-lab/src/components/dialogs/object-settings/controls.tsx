import { Component, createRef, type CSSProperties, type ReactNode, type ChangeEvent, type PointerEvent as ReactPointerEvent, type HTMLAttributes, type ComponentProps } from "react";
import { Checkbox as CommonCheckbox } from "../../common/Checkbox";
import { ColorPalette } from "../../common/ColorPalette";
import { Menu, type MenuItem } from "../../common/Menu";
import { Select as CommonSelect } from "../../common/Select";
import { GlyphPicker, type GlyphPickerOptions } from "../../common/GlyphPicker";
import { CHECKER, dashKey, DASHES, DASH_VALUES, ICON, lwPreview, swatch } from "./constants";
import { composeColor, parseColor } from "../../common/color";
import styles from "./ObjectSettingsDialog.module.css";

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

export class Checkbox extends Component<ComponentProps<typeof CommonCheckbox>> {
  render() {
    return <CommonCheckbox {...this.props} className={cx(styles.sdCheck, this.props.className)} boxClassName={styles.sdBox} labelClassName={styles.sdCl} />;
  }
}

export class Select extends Component<ComponentProps<typeof CommonSelect>> {
  render() {
    return <CommonSelect {...this.props} className={cx(styles.sdSelect, this.props.className)} />;
  }
}

interface DialogRowProps {
  className?: string;
  style?: CSSProperties;
  label?: ReactNode;
  children?: ReactNode;
}

export class DialogRow extends Component<DialogRowProps> {
  render() {
    return (
      <div className={this.props.className ?? styles.sdXr} style={this.props.style}>
        {this.props.label === undefined ? null : typeof this.props.label === "string" ? <span className={styles.sdLbl}>{this.props.label}</span> : this.props.label}
        {this.props.children}
      </div>
    );
  }
}

interface SectionLabelProps {
  className?: string;
  children: ReactNode;
}

export class SectionLabel extends Component<SectionLabelProps> {
  render() {
    return <div className={this.props.className ?? styles.sdSection}>{this.props.children}</div>;
  }
}

interface ToggleButtonProps {
  active: boolean;
  content: ReactNode;
  className: string;
  onClick(): void;
  disabled?: boolean;
}

export class ToggleButton extends Component<ToggleButtonProps> {
  render() {
    const className = cx(this.props.className, this.props.active && styles.on);
    return <button type="button" className={className} disabled={this.props.disabled} onClick={this.props.onClick}>{this.props.content}</button>;
  }
}

interface PopupButtonProps {
  items: MenuItem[];
  current: string;
  onPick(v: string): void;
  width?: number;
  className?: string;
  menuClassName?: string;
  itemClassName?: string;
  disabled?: boolean;
  children?: ReactNode;
}

interface PopupButtonState { open: boolean }

export class PopupButton extends Component<PopupButtonProps, PopupButtonState> {
  state: PopupButtonState = { open: false };
  private ref = createRef<HTMLButtonElement>();
  private close = () => this.setState({ open: false });

  render() {
    return (
      <>
        <button type="button" className={this.props.className ?? cx(styles.sdBtn, styles.sdIco)} ref={this.ref} disabled={this.props.disabled} onClick={() => this.setState({ open: true })}>
          {this.props.children}
        </button>
        {this.state.open && this.ref.current ? (
          <Menu anchor={this.ref.current} items={this.props.items} current={this.props.current} onPick={(value) => { this.close(); this.props.onPick(value); }} onClose={this.close} width={this.props.width} className={this.props.menuClassName} itemClassName={this.props.itemClassName} />
        ) : null}
      </>
    );
  }
}

interface ColorButtonProps {
  color: string;
  width?: number;
  onChange(color: string, opacity: number, width?: number): void;
  className?: string;
  disabled?: boolean;
  checker?: boolean;
  line?: boolean;
  thickness?: boolean;
  lineColor?: string;
  lineVisible?: boolean;
}

interface ColorButtonState { open: boolean }

export class ColorButton extends Component<ColorButtonProps, ColorButtonState> {
  state: ColorButtonState = { open: false };
  private ref = createRef<HTMLButtonElement>();
  private close = () => this.setState({ open: false });

  private swatchBackground() {
    return this.props.checker ? `linear-gradient(${this.props.color},${this.props.color}), ${CHECKER}` : this.props.color;
  }

  render() {
    const parsed = parseColor(this.props.color);
    return (
      <>
        <button type="button" className={this.props.className ?? cx(styles.sdBtn, styles.sdCol)} ref={this.ref} disabled={this.props.disabled} onClick={() => this.setState({ open: true })}>
          <i className={styles.sdSw} style={{ background: this.swatchBackground() }} />
          {this.props.line ? <i className={styles.sdLn} style={{ background: this.props.lineColor ?? this.props.color, height: `${this.props.width ?? 1}px`, display: this.props.lineVisible === false ? "none" : undefined }} /> : null}
        </button>
        {this.state.open && this.ref.current ? (
          <ColorPalette
            anchor={this.ref.current}
            value={{ color: parsed.hex, opacity: parsed.alpha, width: this.props.width }}
            thickness={this.props.thickness}
            onChange={(value) => this.props.onChange(value.color, value.opacity, value.width)}
            onClose={this.close}
          />
        ) : null}
      </>
    );
  }
}

interface DashButtonProps {
  dash?: number[];
  onChange(dash: number[]): void;
  disabled?: boolean;
}

export class DashButton extends Component<DashButtonProps> {
  render() {
    const current = dashKey(this.props.dash);
    const Icon = ICON[current as keyof typeof ICON];
    return (
      <PopupButton items={DASHES} current={current} disabled={this.props.disabled} width={160} onPick={(value) => this.props.onChange(DASH_VALUES[value])}>
        <Icon />
      </PopupButton>
    );
  }
}

interface SimpleColorButtonProps {
  color: string;
  onChange(color: string, opacity: number): void;
  disabled?: boolean;
  className?: string;
}

export class SimpleColorButton extends Component<SimpleColorButtonProps> {
  render() {
    return <ColorButton color={this.props.color} onChange={(color, opacity) => this.props.onChange(color, opacity)} disabled={this.props.disabled} className={this.props.className ?? cx(styles.sdBtn, styles.sdCol, styles.sdBgsw)} checker />;
  }
}

interface EndButtonProps {
  items: MenuItem[];
  current: string;
  onPick(v: string): void;
  icon: ReactNode;
}

export class EndButton extends Component<EndButtonProps> {
  render() {
    return (
      <PopupButton items={this.props.items} current={this.props.current} width={160} onPick={this.props.onPick}>
        {this.props.icon}
      </PopupButton>
    );
  }
}

interface ThicknessButtonProps {
  value: number;
  onChange(v: number): void;
  disabled?: boolean;
}

export class ThicknessButton extends Component<ThicknessButtonProps> {
  render() {
    const items = [1, 2, 3, 4].map((width) => ({ value: String(width), label: "", icon: lwPreview(width) }));
    return (
      <PopupButton className={cx(styles.sdSelect, styles.sdLwsel)} items={items} current={String(this.props.value)} onPick={(value) => this.props.onChange(Number(value))} disabled={this.props.disabled} itemClassName={styles.sdMiWidth}>
        {lwPreview(this.props.value)}
      </PopupButton>
    );
  }
}

interface OpacitySliderProps {
  value: number;
  onChange(v: number): void;
  className?: string;
  disabled?: boolean;
  inverted?: boolean;
  checker?: boolean;
}

interface OpacitySliderState { dragging: boolean }

export class OpacitySlider extends Component<OpacitySliderProps, OpacitySliderState> {
  state: OpacitySliderState = { dragging: false };
  private ref = createRef<HTMLDivElement>();
  private activePointer: number | null = null;

  private setFromClientX(clientX: number) {
    const node = this.ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const raw = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = Math.round((this.props.inverted ? 1 - raw : raw) * 100) / 100;
    this.props.onChange(next);
  }

  private onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (this.props.disabled) return;
    this.activePointer = event.pointerId;
    this.setState({ dragging: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    this.setFromClientX(event.clientX);
  };

  private onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (this.activePointer !== event.pointerId || this.props.disabled) return;
    this.setFromClientX(event.clientX);
  };

  private onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (this.activePointer !== event.pointerId) return;
    this.activePointer = null;
    this.setState({ dragging: false });
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  render() {
    const pos = `${(this.props.inverted ? 1 - this.props.value : this.props.value) * 100}%`;
    const className = cx(this.props.className ?? (this.props.checker ? styles.sdOpac : styles.sdOp), this.props.disabled && styles.off);
    return (
      <div className={className} ref={this.ref} onPointerDown={this.onPointerDown} onPointerMove={this.onPointerMove} onPointerUp={this.onPointerUp} onPointerCancel={this.onPointerUp}>
        <i className={this.props.checker ? styles.sdOpg : styles.sdOpT} />
        <b className={this.props.checker ? styles.sdOpt : styles.sdOpTh} style={{ left: pos }} />
      </div>
    );
  }
}

interface NumberInputProps {
  value: string;
  className?: string;
  disabled?: boolean;
  step?: string;
  min?: number;
  max?: number;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  onCommit(value: string): void;
  onFocus?(): void;
}

interface NumberInputState { draft: string }

export class NumberInput extends Component<NumberInputProps, NumberInputState> {
  state: NumberInputState = { draft: this.props.value };

  componentDidUpdate(prevProps: NumberInputProps) {
    if (prevProps.value !== this.props.value && this.props.value !== this.state.draft) this.setState({ draft: this.props.value });
  }

  private commit = () => this.props.onCommit(this.state.draft);

  render() {
    return (
      <input
        className={this.props.className ?? styles.sdNum}
        type="number"
        value={this.state.draft}
        disabled={this.props.disabled}
        step={this.props.step}
        min={this.props.min}
        max={this.props.max}
        inputMode={this.props.inputMode}
        onFocus={this.props.onFocus}
        onChange={(event: ChangeEvent<HTMLInputElement>) => this.setState({ draft: event.target.value })}
        onBlur={this.commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
    );
  }
}

interface GlyphButtonProps {
  label: string;
  emoji?: string;
  options?: GlyphPickerOptions;
  disabled?: boolean;
  className?: string;
}

interface GlyphButtonState { open: boolean }

export class GlyphButton extends Component<GlyphButtonProps, GlyphButtonState> {
  state: GlyphButtonState = { open: false };
  private ref = createRef<HTMLButtonElement>();

  render() {
    return (
      <>
        <button type="button" ref={this.ref} disabled={this.props.disabled} className={this.props.className ?? cx(styles.sdBtn, styles.sdIco, styles.sdSgemoji)} onClick={() => this.setState({ open: true })}>
          {this.props.label}
        </button>
        {this.state.open && this.ref.current ? <GlyphPicker anchor={this.ref.current} options={this.props.options} onClose={() => this.setState({ open: false })} /> : null}
      </>
    );
  }
}

interface VisibilitySliderProps {
  enabled: boolean;
  min: number;
  max: number;
  currentMin: number;
  currentMax: number;
  onChange(min: number, max: number): void;
}

interface VisibilitySliderState { min: number; max: number }

export class VisibilitySlider extends Component<VisibilitySliderProps, VisibilitySliderState> {
  state: VisibilitySliderState = { min: this.props.currentMin, max: this.props.currentMax };
  private ref = createRef<HTMLDivElement>();
  private active: "min" | "max" | null = null;

  componentDidUpdate(prevProps: VisibilitySliderProps) {
    if (prevProps.currentMin !== this.props.currentMin || prevProps.currentMax !== this.props.currentMax) {
      this.setState({ min: this.props.currentMin, max: this.props.currentMax });
    }
  }

  private setFromPointer(clientX: number) {
    const node = this.ref.current;
    if (!node || !this.active) return;
    const rect = node.getBoundingClientRect();
    const value = Math.round(this.props.min + Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * (this.props.max - this.props.min));
    this.setState((state) => this.active === "min" ? { min: Math.min(value, state.max), max: state.max } : { min: state.min, max: Math.max(value, state.min) });
  }

  private commit = () => this.props.onChange(this.state.min, this.state.max);

  render() {
    const span = this.props.max - this.props.min || 1;
    const lo = ((this.state.min - this.props.min) / span) * 100;
    const hi = ((this.state.max - this.props.min) / span) * 100;
    return (
      <div className={styles.sdRange} ref={this.ref}>
        <i className={styles.sdRt} />
        <i className={styles.sdRf} style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
        <b
          className={cx(styles.sdTh, styles.lo)}
          style={{ left: `${lo}%` }}
          onPointerDown={(event) => {
            this.active = "min";
            event.currentTarget.setPointerCapture(event.pointerId);
            this.setFromPointer(event.clientX);
          }}
          onPointerMove={(event) => {
            if (this.active !== "min") return;
            this.setFromPointer(event.clientX);
          }}
          onPointerUp={(event) => {
            if (this.active !== "min") return;
            this.active = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
            this.commit();
          }}
        />
        <b
          className={cx(styles.sdTh, styles.hi)}
          style={{ left: `${hi}%` }}
          onPointerDown={(event) => {
            this.active = "max";
            event.currentTarget.setPointerCapture(event.pointerId);
            this.setFromPointer(event.clientX);
          }}
          onPointerMove={(event) => {
            if (this.active !== "max") return;
            this.setFromPointer(event.clientX);
          }}
          onPointerUp={(event) => {
            if (this.active !== "max") return;
            this.active = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
            this.commit();
          }}
        />
      </div>
    );
  }
}

export { composeColor, parseColor, swatch };
