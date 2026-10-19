import { Component, createRef, type ContextType, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DATE_FORMATS, PRECISIONS, type ChartSettings, type SettingsData } from "../../chart-settings";
import { EXCHANGE_ZONE, TIMEZONES, UTC_ZONE, offsetLabel } from "../../timezones";
import { LabContext } from "../../app/context";
import { Checkbox } from "../common/Checkbox";
import { ColorPalette } from "../common/ColorPalette";
import { Menu, type MenuItem } from "../common/Menu";
import { composeColor, parseColor, type PaletteValue } from "../common/color";
import { makeDraggable } from "../common/draggable";
import { ChartSettingsLineIcons, ChartSettingsTabIcons, CommonIcons } from "../icons";
import styles from "./ChartSettingsDialog.module.css";

export type ChartSettingsTab = "Symbol" | "Status line" | "Scales" | "Appearance";

const TABS: ChartSettingsTab[] = ["Symbol", "Status line", "Scales", "Appearance"];
const HEIGHT = 706;
const LABEL_W: Record<ChartSettingsTab, number> = { Symbol: 121.6, "Status line": 116, Scales: 179.5, Appearance: 108.5 };

const STYLE_ITEMS: MenuItem[] = [
  { value: "0", label: "Line", icon: <ChartSettingsLineIcons.solid /> },
  { value: "2", label: "Dashed line", icon: <ChartSettingsLineIcons.dashed /> },
  { value: "4", label: "Dotted line", icon: <ChartSettingsLineIcons.dotted /> },
];
const styleIcon = (n: number) => {
  if (n === 0) return ChartSettingsLineIcons.solid;
  return n === 1 || n === 4 ? ChartSettingsLineIcons.dotted : ChartSettingsLineIcons.dashed;
};
const styleKey = (n: number) => (n === 0 ? "0" : n === 1 || n === 4 ? "4" : "2");

const CHECKER = "repeating-conic-gradient(#c0c3cb 0% 25%, #fff 0% 50%) 0 0 / 12px 12px";
const AUTO_SWATCH = "linear-gradient(135deg, #089981 50%, #f23645 50%)";

const NAV_ITEMS: MenuItem[] = [
  { value: "hover", label: "Visible on mouse over" },
  { value: "always", label: "Always visible" },
  { value: "never", label: "Always invisible" },
];

const LABELS: Partial<Record<keyof SettingsData, string>> = {
  colorByPrev: "color bars based on previous close",
  body: "candle body",
  border: "candle borders",
  wick: "candle wick",
  lastLine: "last price line",
  hiLoLine: "high and low price lines",
  precision: "precision",
  timezone: "timezone",
  titleOn: "title visibility",
  titleMode: "title mode",
  marketStatus: "market status visibility",
  ohlc: "OHLC values visibility",
  change: "bar change values visibility",
  volume: "volume values visibility",
  indTitles: "indicator titles visibility",
  indArgs: "indicator arguments visibility",
  indValues: "indicator values visibility",
  indBg: "indicator background visibility",
  indBgOpacity: "indicator background opacity",
  symName: "symbol name label visibility",
  lastPriceOn: "symbol last price label visibility",
  lastPriceMode: "symbol last price label mode",
  hiLoLabel: "high and low price label visibility",
  indName: "indicator name label visibility",
  indValue: "indicator value label visibility",
  noOverlap: "no overlapping labels",
  countdown: "countdown to bar close",
  lockRatio: "lock price to bar ratio",
  placement: "scales placement",
  dateFormat: "date format",
  hours: "time hours format",
  bgType: "background type",
  bg: "background color",
  bgTop: "background color",
  bgBottom: "background color",
  vertGrid: "vert grid lines color",
  horzGrid: "horz grid lines color",
  crosshair: "crosshair",
  watermark: "watermark",
  textColor: "scales text color",
  fontSize: "scales font size",
  scaleLines: "scales lines color",
  navVis: "navigation buttons visibility",
  paneVis: "pane buttons visibility",
  marginTop: "top margin",
  marginBottom: "bottom margin",
  marginRight: "right margin",
};

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

let lastTab: ChartSettingsTab = "Symbol";

type PopupHandle = { close(): void };
let activeColorButton: PopupHandle | null = null;
let activeStyleButton: PopupHandle | null = null;
let activePopupSelect: PopupHandle | null = null;

interface ChartSettingsDialogProps {
  tab?: ChartSettingsTab;
  onClose: () => void;
}

interface ChartSettingsDialogState {
  activeTab: ChartSettingsTab;
  version: number;
  templateMenuOpen: boolean;
  closeNonce: number;
}

interface NumberFieldProps {
  value: number;
  suffix: string;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}

interface NumberFieldState {
  text: string;
}

interface PopupSelectProps {
  popupId: string;
  items: MenuItem[];
  value: string;
  width: 100 | 150 | 180;
  closeNonce: number;
  onChange: (value: string) => void;
  onOpenChange: (id: string, open: boolean) => void;
}

interface PopupSelectState {
  open: boolean;
}

interface ColorButtonProps {
  popupId: string;
  color: string | null;
  onChange: (color: string, width?: number) => void;
  onOpenChange: (id: string, open: boolean) => void;
  closeNonce: number;
  line?: { width: number; style: number } | null;
  thickness?: boolean;
  enabled?: boolean;
}

interface ColorButtonState {
  open: boolean;
}

interface StyleButtonProps {
  popupId: string;
  value: number;
  onChange: (n: number) => void;
  onOpenChange: (id: string, open: boolean) => void;
  closeNonce: number;
  enabled?: boolean;
}

interface StyleButtonState {
  open: boolean;
}

class NumberField extends Component<NumberFieldProps, NumberFieldState> {
  state: NumberFieldState = { text: String(this.props.value) };

  componentDidUpdate(prevProps: NumberFieldProps) {
    if (prevProps.value !== this.props.value && this.state.text !== String(this.props.value)) {
      this.setState({ text: String(this.props.value) });
    }
  }

  private onInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    this.setState({ text });
    const value = Number(text);
    if (text.trim() !== "" && Number.isFinite(value) && value >= this.props.min && value <= this.props.max) this.props.onChange(value);
  };

  private onBlur = () => {
    const value = Math.min(this.props.max, Math.max(this.props.min, Number(this.state.text) || 0));
    this.setState({ text: String(value) });
    this.props.onChange(value);
  };

  render() {
    return (
      <div className={styles.numWrap}>
        <input className={styles.num} value={this.state.text} disabled={this.props.disabled} onChange={this.onInput} onBlur={this.onBlur} />
        <span className={styles.suffix}>{this.props.suffix}</span>
      </div>
    );
  }
}

class PopupSelect extends Component<PopupSelectProps, PopupSelectState> implements PopupHandle {
  state: PopupSelectState = { open: false };

  private buttonRef = createRef<HTMLButtonElement>();

  componentDidUpdate(prevProps: PopupSelectProps) {
    if (prevProps.closeNonce !== this.props.closeNonce && this.state.open) this.close();
  }

  componentWillUnmount() {
    if (this.state.open) this.props.onOpenChange(this.props.popupId, false);
    if (activePopupSelect === this) activePopupSelect = null;
  }

  close = () => {
    if (!this.state.open) return;
    if (activePopupSelect === this) activePopupSelect = null;
    this.props.onOpenChange(this.props.popupId, false);
    this.setState({ open: false });
  };

  private open = () => {
    activePopupSelect?.close();
    activePopupSelect = this;
    this.props.onOpenChange(this.props.popupId, true);
    this.setState({ open: true });
  };

  private toggle = () => {
    if (this.state.open) this.close();
    else this.open();
  };

  render() {
    const label = this.props.items.find((item) => item.value === this.props.value)?.label ?? this.props.value;
    const widthClass = this.props.width === 100 ? styles.select100 : this.props.width === 150 ? styles.select150 : styles.select180;
    return (
      <>
        <button ref={this.buttonRef} className={cx(styles.select, widthClass)} onClick={this.toggle}>
          <span className={styles.selectLabel}>{label}</span>
          <CommonIcons.chevron />
        </button>
        {this.state.open && this.buttonRef.current && (
          <Menu
            anchor={this.buttonRef.current}
            items={this.props.items}
            current={this.props.value}
            onPick={(value) => {
              this.props.onChange(value);
              this.close();
            }}
            onClose={this.close}
          />
        )}
      </>
    );
  }
}

class OpacitySlider extends Component<{ value: number; enabled: boolean; onChange: (v: number) => void }> {
  private ref = createRef<HTMLDivElement>();

  private setFromClientX(clientX: number) {
    const node = this.ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const value = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    this.props.onChange(Math.round(value * 100) / 100);
  }

  private onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!this.props.enabled) return;
    const node = this.ref.current;
    if (!node) return;
    node.setPointerCapture(event.pointerId);
    this.setFromClientX(event.clientX);
    const move = (moveEvent: PointerEvent) => this.setFromClientX(moveEvent.clientX);
    const up = () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up, { once: true });
  };

  render() {
    const percent = this.props.value * 100;
    return (
      <div ref={this.ref} className={cx(styles.slider, !this.props.enabled && styles.sliderOff)} onPointerDown={this.onPointerDown}>
        <i className={styles.sliderTrack} />
        <i className={styles.sliderFill} />
        <i className={styles.sliderThumb} style={{ left: `${percent}%` }} />
      </div>
    );
  }
}

class ColorButton extends Component<ColorButtonProps, ColorButtonState> implements PopupHandle {
  state: ColorButtonState = { open: false };

  private ref = createRef<HTMLButtonElement>();

  componentDidUpdate(prevProps: ColorButtonProps) {
    if (prevProps.closeNonce !== this.props.closeNonce && this.state.open) this.close();
    if (prevProps.enabled !== this.props.enabled && this.props.enabled === false && this.state.open) this.close();
  }

  componentWillUnmount() {
    if (this.state.open) this.props.onOpenChange(this.props.popupId, false);
    if (activeColorButton === this) activeColorButton = null;
  }

  close = () => {
    if (!this.state.open) return;
    if (activeColorButton === this) activeColorButton = null;
    this.props.onOpenChange(this.props.popupId, false);
    this.setState({ open: false });
  };

  private open = () => {
    activeColorButton?.close();
    activeColorButton = this;
    this.props.onOpenChange(this.props.popupId, true);
    this.setState({ open: true });
  };

  private toggle = () => {
    if (this.props.enabled === false) return;
    if (this.state.open) this.close();
    else this.open();
  };

  render() {
    const parsed = parseColor(this.props.color ?? "#089981");
    const paletteValue: PaletteValue = { color: parsed.hex, opacity: parsed.alpha, width: this.props.line?.width };
    const swatchBackground = this.props.color === null ? AUTO_SWATCH : `linear-gradient(${this.props.color},${this.props.color}), ${CHECKER}`;
    return (
      <>
        <button ref={this.ref} className={cx(styles.colorButton, this.props.line && styles.wide, this.props.enabled === false && styles.off)} onClick={this.toggle}>
          <i className={styles.swatch} style={{ background: swatchBackground }} />
          {this.props.line && <i className={styles.linePreview} style={{ height: `${this.props.line.width}px`, background: "var(--lab-ink)" }} />}
        </button>
        {this.state.open && this.ref.current && (
          <ColorPalette
            anchor={this.ref.current}
            value={paletteValue}
            thickness={this.props.thickness}
            onChange={(value) => this.props.onChange(composeColor(value.color, value.opacity), value.width)}
            onClose={this.close}
          />
        )}
      </>
    );
  }
}

class StyleButton extends Component<StyleButtonProps, StyleButtonState> implements PopupHandle {
  state: StyleButtonState = { open: false };

  private ref = createRef<HTMLButtonElement>();

  componentDidUpdate(prevProps: StyleButtonProps) {
    if (prevProps.closeNonce !== this.props.closeNonce && this.state.open) this.close();
    if (prevProps.enabled !== this.props.enabled && this.props.enabled === false && this.state.open) this.close();
  }

  componentWillUnmount() {
    if (this.state.open) this.props.onOpenChange(this.props.popupId, false);
    if (activeStyleButton === this) activeStyleButton = null;
  }

  close = () => {
    if (!this.state.open) return;
    if (activeStyleButton === this) activeStyleButton = null;
    this.props.onOpenChange(this.props.popupId, false);
    this.setState({ open: false });
  };

  private open = () => {
    activeStyleButton?.close();
    activeStyleButton = this;
    this.props.onOpenChange(this.props.popupId, true);
    this.setState({ open: true });
  };

  private toggle = () => {
    if (this.props.enabled === false) return;
    if (this.state.open) this.close();
    else this.open();
  };

  render() {
    const Icon = styleIcon(this.props.value);
    return (
      <>
        <button className={cx(styles.colorButton, styles.styleButton, this.props.enabled === false && styles.off)} ref={this.ref} onClick={this.toggle}>
          <Icon />
        </button>
        {this.state.open && this.ref.current && (
          <Menu
            anchor={this.ref.current}
            items={STYLE_ITEMS}
            current={styleKey(this.props.value)}
            width={160}
            onPick={(value) => {
              this.props.onChange(Number(value));
              this.close();
            }}
            onClose={this.close}
          />
        )}
      </>
    );
  }
}

export class ChartSettingsDialog extends Component<ChartSettingsDialogProps, ChartSettingsDialogState> {
  static contextType = LabContext;
  declare context: ContextType<typeof LabContext>;

  state: ChartSettingsDialogState = {
    activeTab: this.props.tab ?? lastTab,
    version: 0,
    templateMenuOpen: false,
    closeNonce: 0,
  };

  private dialogRef = createRef<HTMLDivElement>();
  private contentRef = createRef<HTMLDivElement>();
  private templateRef = createRef<HTMLButtonElement>();
  private before: SettingsData | null = null;
  private unsubscribe: (() => void) | null = null;
  private dragCleanup: (() => void) | null = null;
  private openPopupIds = new Set<string>();

  componentDidMount() {
    if (this.props.tab) lastTab = this.props.tab;
    this.before = this.settings().snapshot();
    this.unsubscribe = this.settings().subscribe(() => this.setState((state) => ({ version: state.version + 1 })));
    document.addEventListener("keydown", this.onKeyDown, true);
    if (this.dialogRef.current) this.dragCleanup = makeDraggable(this.dialogRef.current);
  }

  componentDidUpdate(_prevProps: ChartSettingsDialogProps, prevState: ChartSettingsDialogState) {
    if (prevState.activeTab !== this.state.activeTab && this.contentRef.current) this.contentRef.current.scrollTop = 0;
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.unsubscribe?.();
    this.dragCleanup?.();
  }

  private settings(): ChartSettings {
    return this.context.engine.settings;
  }

  private data() {
    return this.settings().data;
  }

  private updatePopupState = (id: string, open: boolean) => {
    if (open) this.openPopupIds.add(id);
    else this.openPopupIds.delete(id);
  };

  private hasOpenPopup() {
    return this.state.templateMenuOpen || this.openPopupIds.size > 0;
  }

  private clearTransientPopups() {
    this.openPopupIds.clear();
    this.setState((state) => ({ templateMenuOpen: false, closeNonce: state.closeNonce + 1 }));
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (this.hasOpenPopup()) return;
      event.stopPropagation();
      this.cancel();
      return;
    }
    if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) this.accept();
  };

  private accept = () => {
    this.recordChanges();
    this.props.onClose();
  };

  private cancel = () => {
    if (this.before) this.settings().replace(this.before);
    this.props.onClose();
  };

  private recordChanges() {
    if (!this.before) return;
    // The page's colour scheme may have flipped while the dialog was open
    const before = this.settings().rebase(this.before);
    const after = this.settings().snapshot();
    const ctl = this.context.engine.ctl;
    (Object.keys(after) as Array<keyof SettingsData>).forEach((key) => {
      if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return;
      const from = before[key];
      const to = after[key];
      ctl.recordAction(
        `change ${LABELS[key] ?? String(key)}`,
        () => this.settings().set(key, from as never),
        () => this.settings().set(key, to as never),
      );
    });
  }

  private setTab(tab: ChartSettingsTab) {
    if (this.state.activeTab === tab) return;
    lastTab = tab;
    this.openPopupIds.clear();
    this.setState((state) => ({ activeTab: tab, templateMenuOpen: false, closeNonce: state.closeNonce + 1 }));
  }

  private applyDefaults = () => {
    const timezone = this.data().timezone;
    this.settings().replace({ ...this.settings().defaults(), timezone });
    this.openPopupIds.clear();
    this.setState((state) => ({ templateMenuOpen: false, closeNonce: state.closeNonce + 1 }));
  };

  private label(text: string) {
    return <span className={styles.label}>{text}</span>;
  }

  private labelWrap(content: ReactNode, indent = false) {
    return <div className={cx(styles.label, indent && styles.indent)}>{content}</div>;
  }

  private section(title: string) {
    return <div className={styles.section} key={title}>{title}</div>;
  }

  private tzItems(): MenuItem[] {
    return [
      { value: UTC_ZONE.id, label: "UTC" },
      { value: EXCHANGE_ZONE.id, label: "Exchange" },
      ...TIMEZONES.map((timezone) => ({ value: timezone.id, label: `${offsetLabel(timezone.iana)} ${timezone.name}` })),
    ];
  }

  private renderBool<K extends keyof SettingsData>(label: string, key: K, indent = false) {
    return this.labelWrap(<Checkbox label={label} checked={Boolean(this.data()[key])} onChange={(value) => this.settings().set(key, value as SettingsData[K])} />, indent);
  }

  private renderColorSetRow(label: string, key: "body" | "border" | "wick") {
    const value = this.data()[key];
    return (
      <div className={styles.row} key={key}>
        {this.labelWrap(<Checkbox label={label} checked={value.on} onChange={(checked) => this.settings().set(key, { ...value, on: checked })} />)}
        <ColorButton
          popupId={`${key}-up`}
          closeNonce={this.state.closeNonce}
          color={value.up}
          onOpenChange={this.updatePopupState}
          onChange={(color) => this.settings().set(key, { ...value, up: color })}
        />
        <ColorButton
          popupId={`${key}-down`}
          closeNonce={this.state.closeNonce}
          color={value.down}
          onOpenChange={this.updatePopupState}
          onChange={(color) => this.settings().set(key, { ...value, down: color })}
        />
      </div>
    );
  }

  private renderPriceLineRow(label: string, key: "lastLine" | "hiLoLine") {
    const value = this.data()[key];
    return (
      <div className={styles.row} key={key}>
        {this.labelWrap(<Checkbox label={label} checked={value.on} onChange={(checked) => this.settings().set(key, { ...value, on: checked })} />)}
        <ColorButton
          popupId={`${key}-color`}
          closeNonce={this.state.closeNonce}
          color={value.color}
          line={value}
          thickness
          enabled={value.on}
          onOpenChange={this.updatePopupState}
          onChange={(color, width) => this.settings().set(key, { ...value, color, width: width ?? value.width })}
        />
      </div>
    );
  }

  private renderSelect(popupId: string, items: MenuItem[], value: string, width: 100 | 150 | 180, onChange: (value: string) => void) {
    return (
      <PopupSelect
        popupId={popupId}
        items={items}
        value={value}
        width={width}
        closeNonce={this.state.closeNonce}
        onChange={onChange}
        onOpenChange={this.updatePopupState}
      />
    );
  }

  private renderSymbolTab() {
    return [
      this.section("CANDLES"),
      <div className={styles.row} key="colorByPrev">{this.renderBool("Color bars based on previous close", "colorByPrev")}</div>,
      this.renderColorSetRow("Body", "body"),
      this.renderColorSetRow("Borders", "border"),
      this.renderColorSetRow("Wick", "wick"),
      this.section("PRICE LINES"),
      this.renderPriceLineRow("Last", "lastLine"),
      this.renderPriceLineRow("High and low", "hiLoLine"),
      this.section("DATA MODIFICATION"),
      <div className={styles.row} key="precision">
        {this.label("Precision")}
        {this.renderSelect(
          "precision",
          PRECISIONS.map((precision) => ({ value: precision.value, label: precision.value })),
          this.data().precision,
          150,
          (value) => this.settings().set("precision", value),
        )}
      </div>,
      <div className={styles.row} key="timezone">
        {this.label("Timezone")}
        {this.renderSelect("timezone", this.tzItems(), this.data().timezone, 150, (value) => this.settings().set("timezone", value))}
      </div>,
    ];
  }

  private renderStatusLineTab() {
    return [
      this.section("SYMBOL"),
      <div className={styles.row} key="title">
        {this.renderBool("Title", "titleOn")}
        {this.renderSelect(
          "titleMode",
          [
            { value: "description", label: "Description" },
            { value: "ticker", label: "Ticker" },
            { value: "both", label: "Ticker and description" },
          ],
          this.data().titleMode,
          150,
          (value) => this.settings().set("titleMode", value as SettingsData["titleMode"]),
        )}
      </div>,
      <div className={styles.row} key="marketStatus">{this.renderBool("Open market status", "marketStatus")}</div>,
      <div className={styles.row} key="ohlc">{this.renderBool("OHLC values", "ohlc")}</div>,
      <div className={styles.row} key="change">{this.renderBool("Bar change values", "change")}</div>,
      <div className={styles.row} key="volume">{this.renderBool("Volume", "volume")}</div>,
      this.section("INDICATORS"),
      <div className={styles.row} key="indTitles">{this.renderBool("Titles", "indTitles")}</div>,
      <div className={styles.row} key="indArgs">{this.renderBool("Arguments", "indArgs", true)}</div>,
      <div className={styles.row} key="indValues">{this.renderBool("Values", "indValues")}</div>,
      <div className={cx(styles.row, styles.gap)} key="indBg">
        {this.renderBool("Background", "indBg")}
        <OpacitySlider value={this.data().indBgOpacity} enabled={this.data().indBg} onChange={(value) => this.settings().set("indBgOpacity", value)} />
      </div>,
    ];
  }

  private renderScalesTab() {
    return [
      this.section("LABELS"),
      <div className={styles.row} key="symName">{this.renderBool("Symbol name", "symName")}</div>,
      <div className={styles.row} key="lastPriceOn">
        {this.renderBool("Symbol last price", "lastPriceOn")}
        {this.renderSelect(
          "lastPriceMode",
          [
            { value: "percent", label: "Price and percentage value" },
            { value: "value", label: "Value according to scale" },
          ],
          this.data().lastPriceMode,
          180,
          (value) => this.settings().set("lastPriceMode", value as SettingsData["lastPriceMode"]),
        )}
      </div>,
      <div className={styles.row} key="hiLoLabel">{this.renderBool("High and low price", "hiLoLabel")}</div>,
      <div className={styles.row} key="indName">{this.renderBool("Indicators name", "indName")}</div>,
      <div className={styles.row} key="indValue">{this.renderBool("Indicators value", "indValue")}</div>,
      <div className={styles.row} key="noOverlap">{this.renderBool("No overlapping", "noOverlap")}</div>,
      this.section("PRICE SCALE"),
      <div className={styles.row} key="countdown">{this.renderBool("Countdown to bar close", "countdown")}</div>,
      <div className={styles.row} key="lockRatio">
        {this.renderBool("Lock price to bar ratio", "lockRatio")}
        <input className={cx(styles.num, styles.ratio)} value="73.197527" disabled readOnly />
      </div>,
      <div className={styles.row} key="placement">
        {this.label("Scales placement")}
        {this.renderSelect(
          "placement",
          [
            { value: "left", label: "Stack on the left" },
            { value: "right", label: "Stack on the right" },
            { value: "auto", label: "Auto" },
          ],
          this.data().placement,
          150,
          (value) => this.settings().set("placement", value as SettingsData["placement"]),
        )}
      </div>,
      this.section("TIME SCALE"),
      <div className={styles.row} key="dateFormat">
        {this.label("Date format")}
        {this.renderSelect(
          "dateFormat",
          DATE_FORMATS.map((format) => ({ value: format.value, label: format.label })),
          this.data().dateFormat,
          150,
          (value) => this.settings().set("dateFormat", value),
        )}
      </div>,
      <div className={styles.row} key="hours">
        {this.label("Time hours format")}
        {this.renderSelect(
          "hours",
          [
            { value: "24", label: "24-hours" },
            { value: "12", label: "12-hours" },
          ],
          this.data().hours,
          100,
          (value) => this.settings().set("hours", value as SettingsData["hours"]),
        )}
      </div>,
    ];
  }

  private renderAppearanceTab() {
    const data = this.data();
    return [
      this.section("CHART BASIC STYLES"),
      <div className={styles.row} key="background">
        {this.label("Background")}
        {this.renderSelect(
          "bgType",
          [
            { value: "solid", label: "Solid" },
            { value: "gradient", label: "Gradient" },
          ],
          data.bgType,
          150,
          (value) => this.settings().set("bgType", value as SettingsData["bgType"]),
        )}
        <span className={styles.inline}>
          {data.bgType === "gradient" ? (
            <>
              <ColorButton
                popupId="bgTop"
                closeNonce={this.state.closeNonce}
                color={data.bgTop}
                onOpenChange={this.updatePopupState}
                onChange={(color) => this.settings().set("bgTop", color)}
              />
              <ColorButton
                popupId="bgBottom"
                closeNonce={this.state.closeNonce}
                color={data.bgBottom}
                onOpenChange={this.updatePopupState}
                onChange={(color) => this.settings().set("bgBottom", color)}
              />
            </>
          ) : (
            <ColorButton
              popupId="bg"
              closeNonce={this.state.closeNonce}
              color={data.bg}
              onOpenChange={this.updatePopupState}
              onChange={(color) => this.settings().set("bg", color)}
            />
          )}
        </span>
      </div>,
      <div className={styles.row} key="vertGrid">
        {this.label("Vert grid lines")}
        <ColorButton popupId="vertGrid" closeNonce={this.state.closeNonce} color={data.vertGrid} onOpenChange={this.updatePopupState} onChange={(color) => this.settings().set("vertGrid", color)} />
      </div>,
      <div className={styles.row} key="horzGrid">
        {this.label("Horz grid lines")}
        <ColorButton popupId="horzGrid" closeNonce={this.state.closeNonce} color={data.horzGrid} onOpenChange={this.updatePopupState} onChange={(color) => this.settings().set("horzGrid", color)} />
      </div>,
      <div className={styles.row} key="crosshair">
        {this.label("Crosshair")}
        <ColorButton
          popupId="crosshair-color"
          closeNonce={this.state.closeNonce}
          color={data.crosshair.color}
          line={data.crosshair}
          thickness
          onOpenChange={this.updatePopupState}
          onChange={(color, width) => this.settings().set("crosshair", { ...data.crosshair, color, width: width ?? data.crosshair.width })}
        />
        <StyleButton
          popupId="crosshair-style"
          closeNonce={this.state.closeNonce}
          value={data.crosshair.style}
          onOpenChange={this.updatePopupState}
          onChange={(value) => this.settings().set("crosshair", { ...data.crosshair, style: value })}
        />
      </div>,
      <div className={styles.row} key="watermark">
        {this.labelWrap(<Checkbox label="Watermark" checked={data.watermark.on} onChange={(checked) => this.settings().set("watermark", { ...data.watermark, on: checked })} />)}
        <ColorButton
          popupId="watermark-color"
          closeNonce={this.state.closeNonce}
          color={data.watermark.color}
          enabled={data.watermark.on}
          onOpenChange={this.updatePopupState}
          onChange={(color) => this.settings().set("watermark", { ...data.watermark, color })}
        />
      </div>,
      this.section("SCALES"),
      <div className={styles.row} key="textColor">
        {this.label("Text")}
        <ColorButton popupId="textColor" closeNonce={this.state.closeNonce} color={data.textColor} onOpenChange={this.updatePopupState} onChange={(color) => this.settings().set("textColor", color)} />
        {this.renderSelect(
          "fontSize",
          [10, 11, 12, 14, 16, 20, 24, 28, 32, 40].map((size) => ({ value: String(size), label: String(size) })),
          String(data.fontSize),
          100,
          (value) => this.settings().set("fontSize", Number(value)),
        )}
      </div>,
      <div className={styles.row} key="scaleLines">
        {this.label("Lines")}
        <ColorButton popupId="scaleLines" closeNonce={this.state.closeNonce} color={data.scaleLines} onOpenChange={this.updatePopupState} onChange={(color) => this.settings().set("scaleLines", color)} />
      </div>,
      this.section("BUTTONS"),
      <div className={styles.row} key="navVis">
        {this.label("Navigation")}
        {this.renderSelect("navVis", NAV_ITEMS, data.navVis, 180, (value) => this.settings().set("navVis", value as SettingsData["navVis"]))}
      </div>,
      <div className={styles.row} key="paneVis">
        {this.label("Pane")}
        {this.renderSelect("paneVis", NAV_ITEMS, data.paneVis, 180, (value) => this.settings().set("paneVis", value as SettingsData["paneVis"]))}
      </div>,
      this.section("MARGINS"),
      <div className={styles.row} key="marginTop">
        {this.label("Top")}
        <NumberField value={data.marginTop} suffix="%" min={0} max={90} onChange={(value) => this.settings().set("marginTop", value)} />
      </div>,
      <div className={styles.row} key="marginBottom">
        {this.label("Bottom")}
        <NumberField value={data.marginBottom} suffix="%" min={0} max={90} onChange={(value) => this.settings().set("marginBottom", value)} />
      </div>,
      <div className={styles.row} key="marginRight">
        {this.label("Right")}
        <NumberField value={data.marginRight} suffix="bars" min={0} max={200} onChange={(value) => this.settings().set("marginRight", value)} />
      </div>,
    ];
  }

  private renderContent() {
    switch (this.state.activeTab) {
      case "Symbol":
        return this.renderSymbolTab();
      case "Status line":
        return this.renderStatusLineTab();
      case "Scales":
        return this.renderScalesTab();
      case "Appearance":
        return this.renderAppearanceTab();
      default:
        return null;
    }
  }

  render() {
    void this.state.version;
    const dialogStyle = {
      "--cs-h": `${HEIGHT}px`,
      "--cs-lw": `${LABEL_W[this.state.activeTab]}px`,
    } as CSSProperties;

    return createPortal(
      <div className={styles.overlay}>
        <div className={styles.dialog} ref={this.dialogRef} role="dialog" aria-label="Chart settings" style={dialogStyle}>
          <aside className={styles.side}>
            <div className={styles.sideTitle} data-drag-handle>
              Chart settings
            </div>
            {TABS.map((tab) => {
              const Icon = ChartSettingsTabIcons[tab];
              return (
                <button key={tab} className={cx(styles.tab, tab === this.state.activeTab && styles.on)} onClick={() => this.setTab(tab)}>
                  <Icon />
                  <span>{tab}</span>
                </button>
              );
            })}
          </aside>
          <div className={styles.main}>
            <div className={styles.head} data-drag-handle>
              <span className={styles.title}>{this.state.activeTab}</span>
              <button className={styles.closeButton} title="Close" onClick={this.accept}>
                <CommonIcons.close />
              </button>
            </div>
            <div className={styles.content} ref={this.contentRef}>
              <div key={this.state.activeTab} className={styles.page}>
                {this.renderContent()}
              </div>
            </div>
            <div className={styles.foot}>
              <>
                <button
                  ref={this.templateRef}
                  className={styles.templateButton}
                  onClick={() => this.setState((state) => ({ templateMenuOpen: !state.templateMenuOpen }))}
                >
                  <span>Template</span>
                  <CommonIcons.chevron />
                </button>
                {this.state.templateMenuOpen && this.templateRef.current && (
                  <Menu
                    anchor={this.templateRef.current}
                    items={[{ value: "defaults", label: "Apply defaults" }]}
                    current=""
                    width={100}
                    onPick={() => this.applyDefaults()}
                    onClose={() => this.setState({ templateMenuOpen: false })}
                  />
                )}
              </>
              <div className={styles.actions}>
                <button className={styles.cancelButton} onClick={this.cancel}>
                  Cancel
                </button>
                <button className={styles.okButton} onClick={this.accept}>
                  Ok
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }
}
