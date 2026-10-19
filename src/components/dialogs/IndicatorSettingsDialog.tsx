import { Component, createRef, type ContextType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import { isExternalKind } from "../../indicators";
import { Checkbox } from "../common/Checkbox";
import { ColorPalette } from "../common/ColorPalette";
import { parseColor, type PaletteValue } from "../common/color";
import { DialogShell } from "./IndicatorDialogs";
import { DualRange } from "./VolumeSettingsDialog";
import { VIS_UNITS, type VisRange, type VisUnit } from "../../volume-study";
import {
  PLOT_TYPES,
  cloneSettings,
  isFillActive,
  isPlotActive,
  mergeSettings,
  rgba,
  saveSettingsAsDefault,
  type DashStyle,
  type IndicatorSettings,
  type InputDef,
  type InputValue,
  type PlotStyle,
  type PlotType,
} from "../../indicator-model";
import styles from "./IndicatorSettingsDialog.module.css";

type Tab = "inputs" | "style" | "visibility";

interface PaletteTarget {
  /** `plot:<id>`, `level:<id>`, `fill:<id>` or `fill2:<id>`. */
  key: string;
  anchor: HTMLElement;
}

interface State {
  tab: Tab;
  settings: IndicatorSettings;
  defaultsOpen: boolean;
  /** Text being typed into a number field, kept until it blurs so the field can be emptied and retyped. */
  drafts: Record<string, string>;
  palette: PaletteTarget | null;
  typeMenu: { plotId: string; anchor: HTMLElement } | null;
  gone: boolean;
}

interface Props {
  id: string;
  onClose: () => void;
}

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

const GLYPHS: Record<PlotType, ReactNode> = {
  line: <polyline points="3,17 8,10 13,14 21,5" fill="none" />,
  linebr: (
    <>
      <polyline points="3,17 8,10 11,13" fill="none" />
      <polyline points="14,12 21,5" fill="none" />
    </>
  ),
  stepline: <polyline points="3,17 3,13 9,13 9,16 15,16 15,6 21,6" fill="none" />,
  histogram: (
    <>
      <rect x="4" y="9" width="3" height="9" />
      <rect x="9" y="4" width="3" height="14" />
      <rect x="14" y="12" width="3" height="6" />
    </>
  ),
  area: <polygon points="3,17 8,9 13,13 21,5 21,18 3,18" fillOpacity="0.3" />,
  circles: (
    <>
      <circle cx="5" cy="15" r="1.6" />
      <circle cx="10" cy="9" r="1.6" />
      <circle cx="15" cy="13" r="1.6" />
      <circle cx="20" cy="6" r="1.6" />
    </>
  ),
};

const PlotTypeGlyph = ({ type }: { type: PlotType }) => (
  <svg className={styles.glyph} width="24" height="22" viewBox="0 0 24 22" stroke="currentColor" fill="currentColor" strokeWidth="1.5" aria-hidden="true">
    {GLYPHS[type]}
  </svg>
);

interface TypeMenuProps {
  anchor: HTMLElement;
  style: PlotStyle;
  onType(type: PlotType): void;
  onPriceLine(on: boolean): void;
  onClose(): void;
}

/** The plot-type popup of the Style tab: price line toggle and the ways a plot can be drawn. */
class TypeMenu extends Component<TypeMenuProps> {
  private ref = createRef<HTMLDivElement>();

  componentDidMount() {
    const rect = this.props.anchor.getBoundingClientRect();
    const menu = this.ref.current;
    if (menu) {
      menu.style.left = `${Math.max(8, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8))}px`;
      const below = rect.bottom + 4;
      menu.style.top = `${below + menu.offsetHeight > window.innerHeight - 8 ? Math.max(8, rect.top - menu.offsetHeight - 4) : below}px`;
    }
    document.addEventListener("mousedown", this.away, true);
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.away, true);
  }

  private away = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!this.ref.current?.contains(target) && !this.props.anchor.contains(target)) this.props.onClose();
  };

  render() {
    const { style, onType, onPriceLine, onClose } = this.props;
    return createPortal(
      <div ref={this.ref} className={styles.typeMenu} data-popup="">
        <button className={styles.typeItem} onClick={() => onPriceLine(!style.priceLine)}>
          <span className={styles.typeTick}>{style.priceLine ? "✓" : ""}</span>
          Price line
        </button>
        <div className={styles.typeSep} />
        {PLOT_TYPES.map((type) => (
          <button
            key={type.id}
            className={cx(styles.typeItem, type.id === style.type && styles.typeOn)}
            onClick={() => {
              onType(type.id);
              onClose();
            }}
          >
            <PlotTypeGlyph type={type.id} />
            {type.label}
          </button>
        ))}
      </div>,
      document.body,
    );
  }
}

const Info = ({ text }: { text: string }) => (
  <span className={styles.info} title={text} aria-label={text}>
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" />
      <path d="M8 7.2v4M8 4.6v1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  </span>
);

/**
 * The indicator Settings dialog, driven by the indicator's schema: Inputs (parameters), Style (plots, levels, fills,
 * output values) and Visibility. Changes apply live; Cancel reverts them and Ok records one undo step.
 */
export class IndicatorSettingsDialog extends Component<Props, State> {
  static contextType = LabContext;
  declare context: ContextType<typeof LabContext>;

  private static lastTab: Tab = "inputs";
  private original: IndicatorSettings | null = null;

  constructor(props: Props, context: ContextType<typeof LabContext>) {
    super(props, context);
    const item = context.engine.indicators.get(props.id);
    this.original = item ? cloneSettings(item.settings) : null;
    this.state = {
      tab: IndicatorSettingsDialog.lastTab,
      settings: this.original ? cloneSettings(this.original) : ({} as IndicatorSettings),
      defaultsOpen: false,
      drafts: {},
      palette: null,
      typeMenu: null,
      gone: !item,
    };
  }

  private get item() {
    return this.context.engine.indicators.get(this.props.id);
  }

  private apply(settings: IndicatorSettings) {
    this.setState({ settings });
    this.context.engine.indicators.update(this.props.id, settings);
  }

  private setInput(id: string, value: InputValue) {
    const { settings } = this.state;
    this.apply({ ...settings, inputs: { ...settings.inputs, [id]: value } });
  }

  private setPlot(id: string, patch: Partial<PlotStyle>) {
    const { settings } = this.state;
    this.apply({ ...settings, plots: { ...settings.plots, [id]: { ...settings.plots[id], ...patch } } });
  }

  private setSection<K extends "levels" | "fills">(section: K, id: string, patch: Partial<IndicatorSettings[K][string]>) {
    const { settings } = this.state;
    this.apply({ ...settings, [section]: { ...settings[section], [id]: { ...settings[section][id], ...patch } } });
  }

  private setVisibility(unit: VisUnit, patch: Partial<VisRange>) {
    const { settings } = this.state;
    this.apply({ ...settings, visibility: { ...settings.visibility, [unit]: { ...settings.visibility[unit], ...patch } } });
  }

  private setTab(tab: Tab) {
    IndicatorSettingsDialog.lastTab = tab;
    this.setState({ tab, defaultsOpen: false });
  }

  private cancel = () => {
    // Escape closes an open popup first, like the popup's own handler does.
    if (this.state.palette || this.state.typeMenu) {
      this.setState({ palette: null, typeMenu: null });
      return;
    }
    if (this.original) this.context.engine.indicators.update(this.props.id, this.original);
    this.props.onClose();
  };

  private ok = () => {
    const { engine } = this.context;
    const before = this.original;
    const after = cloneSettings(this.state.settings);
    const id = this.props.id;
    if (before && JSON.stringify(before) !== JSON.stringify(after)) {
      engine.ctl.recordAction(`change ${(this.item?.spec.legend ?? this.item?.spec.short) ?? "indicator"} settings`, () => engine.indicators.update(id, before), () => engine.indicators.update(id, after));
    }
    this.props.onClose();
  };

  private reset = () => {
    const item = this.item;
    if (!item) return;
    this.setState({ drafts: {}, defaultsOpen: false });
    this.apply(mergeSettings(item.spec, null));
  };

  private saveDefault = () => {
    const item = this.item;
    if (item) saveSettingsAsDefault(item.kind, this.state.settings);
    this.setState({ defaultsOpen: false });
  };

  // ---------- colour popup ----------

  private openPalette(key: string, anchor: HTMLElement) {
    const same = this.state.palette?.key === key;
    this.setState({ palette: same ? null : { key, anchor }, typeMenu: null });
  }

  private paletteValue(key: string): PaletteValue {
    const { settings } = this.state;
    const [kind, id] = key.split(":");
    if (kind === "plot" || kind === "level") {
      const style = kind === "plot" ? settings.plots[id] : settings.levels[id];
      return { color: rgba(style.color, style.opacity), opacity: style.opacity / 100, width: style.width, dash: style.dash };
    }
    const fill = settings.fills[id];
    return kind === "fill2" ? { color: rgba(fill.color2, fill.opacity2), opacity: fill.opacity2 / 100 } : { color: rgba(fill.color, fill.opacity), opacity: fill.opacity / 100 };
  }

  private paletteChange(key: string, value: PaletteValue) {
    const [kind, id] = key.split(":");
    const { hex } = parseColor(value.color);
    const opacity = Math.round((value.opacity ?? 1) * 100);
    if (kind === "plot") this.setPlot(id, { color: hex, opacity, width: value.width ?? 1, dash: (value.dash ?? "solid") as DashStyle });
    else if (kind === "level") this.setSection("levels", id, { color: hex, opacity, width: value.width ?? 1, dash: value.dash ?? "dashed" });
    else if (kind === "fill") this.setSection("fills", id, { color: hex, opacity });
    else this.setSection("fills", id, { color2: hex, opacity2: opacity });
  }

  private colorButton(key: string, color: string, opacity: number, line?: { width: number; dash: DashStyle }, disabled?: boolean) {
    const open = this.state.palette?.key === key;
    return (
      <button type="button" className={cx(styles.colorBtn, open && styles.open)} disabled={disabled} aria-label="Color" onClick={(event) => this.openPalette(key, event.currentTarget)}>
        <span className={styles.chip}>
          <i style={{ background: rgba(color, opacity) }} />
        </span>
        {line ? <span className={styles.linePreview} style={{ borderTop: `${line.width}px ${line.dash} ${rgba(color, opacity)}` }} /> : null}
      </button>
    );
  }

  // ---------- inputs tab ----------

  private numberField(input: InputDef, enabled: boolean) {
    const value = this.state.settings.inputs[input.id] as number;
    const draft = this.state.drafts[input.id];
    const parse = (text: string) => {
      const n = Number(text);
      if (!text.trim() || !Number.isFinite(n)) return null;
      const next = input.type === "int" ? Math.floor(n) : n;
      return (input.min !== undefined && next < input.min) || (input.max !== undefined && next > input.max) ? null : next;
    };
    return (
      <input
        className={styles.numField}
        type="number"
        disabled={!enabled}
        min={input.min}
        max={input.max}
        step={input.step ?? (input.type === "int" ? 1 : "any")}
        value={draft ?? String(value)}
        onChange={(event) => {
          const text = event.target.value;
          this.setState((s) => ({ drafts: { ...s.drafts, [input.id]: text } }));
          const next = parse(text);
          if (next !== null) this.setInput(input.id, next);
        }}
        onBlur={() =>
          this.setState((s) => {
            const { [input.id]: _dropped, ...drafts } = s.drafts;
            return { drafts };
          })
        }
      />
    );
  }

  private inputsTab() {
    const item = this.item;
    if (!item) return null;
    const values = this.state.settings.inputs;
    const rows: ReactNode[] = [];
    let section: string | undefined;
    item.spec.inputs.forEach((input) => {
      if (input.section !== undefined && input.section !== section) {
        section = input.section;
        rows.push(
          <div key={`s-${input.id}`} className={styles.section}>
            {section}
          </div>,
        );
      }
      const enabled = input.enabled ? input.enabled(values) : true;
      const tip = input.tooltip ? <Info text={input.tooltip} /> : null;
      if (input.type === "bool") {
        rows.push(
          <div key={input.id} className={cx(styles.full, !enabled && styles.off)}>
            <Checkbox label={input.label} checked={Boolean(values[input.id])} onChange={(on) => this.setInput(input.id, on)} className={styles.check} />
            {tip}
          </div>,
        );
        return;
      }
      rows.push(
        <label key={`l-${input.id}`} className={cx(styles.label, !enabled && styles.dim)}>
          {input.label}
        </label>,
        <div key={input.id} className={styles.control}>
          {input.type === "select" ? (
            <select className={styles.select} disabled={!enabled} value={String(values[input.id])} onChange={(event) => this.setInput(input.id, event.target.value)}>
              {(input.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            this.numberField(input, enabled)
          )}
          {tip}
        </div>,
      );
    });
    if (!rows.length) {
      const script = this.item && isExternalKind(this.item.kind);
      return (
        <div className={styles.empty}>
          {script ? (
            <>
              This script declares no parameters.
              <br />
              Add <code>params = {"{ period = 14 }"}</code> to its <code>indicator</code> table to make them adjustable here.
            </>
          ) : (
            "This indicator has no inputs."
          )}
        </div>
      );
    }
    return <div className={styles.grid}>{rows}</div>;
  }

  // ---------- style tab ----------

  private styleTab() {
    const item = this.item;
    if (!item) return null;
    const { spec } = item;
    const { settings } = this.state;
    const plots = spec.plots.filter((plot) => isPlotActive(plot, settings.inputs));
    const levels = spec.levels ?? [];
    const fills = (spec.fills ?? []).filter((fill) => isFillActive(fill, settings.inputs));
    const typeMenu = this.state.typeMenu;
    return (
      <div className={styles.styleBody}>
        {plots.map((plot) => {
          const style = settings.plots[plot.id];
          return (
            <div key={plot.id} className={styles.styleRow}>
              <Checkbox label={plot.name} checked={style.visible} onChange={(visible) => this.setPlot(plot.id, { visible })} className={styles.check} />
              <span className={cx(styles.tools, !style.visible && styles.off)}>
                {this.colorButton(`plot:${plot.id}`, style.color, style.opacity, { width: style.width, dash: style.dash }, !style.visible)}
                <button
                  type="button"
                  className={cx(styles.typeBtn, typeMenu?.plotId === plot.id && styles.open)}
                  disabled={!style.visible}
                  aria-label="Plot type"
                  title={PLOT_TYPES.find((type) => type.id === style.type)?.label}
                  onClick={(event) => {
                    const anchor = event.currentTarget;
                    this.setState((s) => ({ typeMenu: s.typeMenu?.plotId === plot.id ? null : { plotId: plot.id, anchor }, palette: null }));
                  }}
                >
                  <PlotTypeGlyph type={style.type} />
                </button>
              </span>
            </div>
          );
        })}
        {levels.map((level) => {
          const style = settings.levels[level.id];
          return (
            <div key={level.id} className={styles.styleRow}>
              <Checkbox label={level.name} checked={style.visible} onChange={(visible) => this.setSection("levels", level.id, { visible })} className={styles.check} />
              <span className={cx(styles.tools, !style.visible && styles.off)}>
                {this.colorButton(`level:${level.id}`, style.color, style.opacity, { width: style.width, dash: style.dash }, !style.visible)}
                <input
                  className={cx(styles.numField, styles.levelValue)}
                  type="number"
                  step="any"
                  disabled={!style.visible}
                  value={this.state.drafts[`level:${level.id}`] ?? String(style.value)}
                  onChange={(event) => {
                    const text = event.target.value;
                    this.setState((s) => ({ drafts: { ...s.drafts, [`level:${level.id}`]: text } }));
                    const value = Number(text);
                    if (text.trim() && Number.isFinite(value)) this.setSection("levels", level.id, { value });
                  }}
                  onBlur={() =>
                    this.setState((s) => {
                      const { [`level:${level.id}`]: _dropped, ...drafts } = s.drafts;
                      return { drafts };
                    })
                  }
                />
              </span>
            </div>
          );
        })}
        {fills.map((fill) => {
          const style = settings.fills[fill.id];
          return (
            <div key={fill.id} className={styles.styleRow}>
              <Checkbox label={fill.name} checked={style.visible} onChange={(visible) => this.setSection("fills", fill.id, { visible })} className={styles.check} />
              <span className={cx(styles.tools, !style.visible && styles.off)}>
                {this.colorButton(`fill:${fill.id}`, style.color, style.opacity, undefined, !style.visible)}
                {fill.gradient ? this.colorButton(`fill2:${fill.id}`, style.color2, style.opacity2, undefined, !style.visible) : null}
              </span>
            </div>
          );
        })}

        <div className={styles.section}>Output values</div>
        <div className={styles.grid}>
          <label className={styles.label}>Precision</label>
          <div className={styles.control}>
            <select
              className={styles.select}
              value={settings.precision ?? "default"}
              onChange={(event) => this.apply({ ...settings, precision: event.target.value === "default" ? null : Number(event.target.value) })}
            >
              <option value="default">Default</option>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((digits) => (
                <option key={digits} value={digits}>
                  {digits}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Checkbox label="Labels on price scale" checked={settings.labelsOnScale} onChange={(on) => this.apply({ ...settings, labelsOnScale: on })} className={styles.check} />
        <Checkbox label="Values in status line" checked={settings.valuesInStatus} onChange={(on) => this.apply({ ...settings, valuesInStatus: on })} className={styles.check} />
        <div className={styles.section}>Input values</div>
        <Checkbox label="Inputs in status line" checked={settings.inputsInStatus} onChange={(on) => this.apply({ ...settings, inputsInStatus: on })} className={styles.check} />
      </div>
    );
  }

  // ---------- visibility tab ----------

  private visibilityTab() {
    const { visibility } = this.state.settings;
    return (
      <div className={styles.visBody}>
        {VIS_UNITS.map((unit) => {
          const range = visibility[unit.id];
          return (
            <div key={unit.id} className={styles.visRow}>
              <Checkbox label={unit.label} checked={range.on} onChange={(on) => this.setVisibility(unit.id, { on })} className={cx(styles.check, styles.visCheck)} />
              {unit.limit ? <DualRange min={range.min} max={range.max} limit={unit.limit} disabled={!range.on} onChange={(min, max) => this.setVisibility(unit.id, { min, max })} /> : null}
            </div>
          );
        })}
      </div>
    );
  }

  render() {
    const item = this.item;
    if (!item || this.state.gone) return null;
    const { tab, defaultsOpen, palette, typeMenu, settings } = this.state;
    const tabs: Array<[Tab, string]> = [
      ["inputs", "Inputs"],
      ["style", "Style"],
      ["visibility", "Visibility"],
    ];
    return (
      <DialogShell
        title={item.spec.legend ?? item.spec.short}
        className={styles.dialog}
        onClose={this.cancel}
        tabs={
          <div className={styles.tabs} role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={cx(styles.tab, tab === id && styles.on)} onClick={() => this.setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className={styles.scroll}>{tab === "inputs" ? this.inputsTab() : tab === "style" ? this.styleTab() : this.visibilityTab()}</div>
        <div className={styles.foot}>
          <div className={styles.defaults}>
            <button className={styles.defaultsBtn} onClick={() => this.setState({ defaultsOpen: !defaultsOpen })}>
              Defaults
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            {defaultsOpen ? (
              <div className={styles.menu}>
                <button onClick={this.reset}>Reset settings</button>
                <button onClick={this.saveDefault}>Save as default</button>
              </div>
            ) : null}
          </div>
          <button className={styles.cancel} onClick={this.cancel}>
            Cancel
          </button>
          <button className={styles.ok} onClick={this.ok}>
            Ok
          </button>
        </div>
        {palette ? (
          <ColorPalette
            anchor={palette.anchor}
            value={this.paletteValue(palette.key)}
            thickness={palette.key.startsWith("plot:") || palette.key.startsWith("level:")}
            onChange={(value) => this.paletteChange(palette.key, value)}
            onClose={() => this.setState({ palette: null })}
          />
        ) : null}
        {typeMenu ? (
          <TypeMenu
            anchor={typeMenu.anchor}
            style={settings.plots[typeMenu.plotId]}
            onType={(type) => this.setPlot(typeMenu.plotId, { type })}
            onPriceLine={(priceLine) => this.setPlot(typeMenu.plotId, { priceLine })}
            onClose={() => this.setState({ typeMenu: null })}
          />
        ) : null}
      </DialogShell>
    );
  }
}
