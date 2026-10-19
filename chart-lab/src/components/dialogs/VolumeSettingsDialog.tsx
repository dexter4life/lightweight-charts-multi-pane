import { Component, type ContextType, type CSSProperties } from "react";
import { LabContext } from "../../app/context";
import { Checkbox } from "../common/Checkbox";
import { DialogShell } from "./IndicatorDialogs";
import { VIS_UNITS, defaultVolumeParams, saveVolumeDefaults, type Tint, type VisUnit, type VolumeParams } from "../../volume-study";
import styles from "./VolumeSettingsDialog.module.css";

type Tab = "inputs" | "style" | "visibility";

interface State {
  tab: Tab;
  data: VolumeParams;
  defaultsOpen: boolean;
}

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

const rgba = (hex: string, opacity: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity / 100})`;
};

interface SwatchProps {
  tint: Tint;
  onChange(next: Tint): void;
  /** Hide the opacity slider (line colours are solid). */
  solid?: boolean;
  disabled?: boolean;
}

/** Colour chip over a checkerboard, with a native colour picker and an opacity slider. */
const Swatch = ({ tint, onChange, solid, disabled }: SwatchProps) => (
  <span className={cx(styles.swatchWrap, disabled && styles.off)}>
    <label className={styles.swatch}>
      <span className={styles.chip} style={{ background: rgba(tint.color, tint.opacity) }} />
      <input type="color" disabled={disabled} value={tint.color} onChange={(event) => onChange({ ...tint, color: event.target.value })} />
    </label>
    {solid ? null : (
      <input
        className={styles.opacity}
        type="range"
        min={0}
        max={100}
        disabled={disabled}
        value={tint.opacity}
        title={`Opacity ${tint.opacity}%`}
        style={{ "--pct": `${tint.opacity}%` } as CSSProperties}
        onChange={(event) => onChange({ ...tint, opacity: Number(event.target.value) })}
      />
    )}
  </span>
);

interface DualProps {
  min: number;
  max: number;
  limit: number;
  disabled: boolean;
  onChange(min: number, max: number): void;
}

/** Min input, dual-handle slider and max input for one visibility row. */
export const DualRange = ({ min, max, limit, disabled, onChange }: DualProps) => {
  const clamp = (value: number) => Math.min(limit, Math.max(1, Math.round(value) || 1));
  const pct = (value: number) => (limit === 1 ? 0 : ((value - 1) / (limit - 1)) * 100);
  return (
    <div className={cx(styles.dual, disabled && styles.off)}>
      <input className={styles.num} type="number" min={1} max={limit} disabled={disabled} value={min} onChange={(event) => onChange(Math.min(clamp(Number(event.target.value)), max), max)} />
      <div className={styles.track}>
        <span className={styles.fill} style={{ left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%` }} />
        <input type="range" min={1} max={limit} disabled={disabled} value={min} onChange={(event) => onChange(Math.min(Number(event.target.value), max), max)} />
        <input type="range" min={1} max={limit} disabled={disabled} value={max} onChange={(event) => onChange(min, Math.max(Number(event.target.value), min))} />
      </div>
      <input className={styles.num} type="number" min={1} max={limit} disabled={disabled} value={max} onChange={(event) => onChange(min, Math.max(clamp(Number(event.target.value)), min))} />
    </div>
  );
};

/** The study dialog for the volume pane: Inputs / Style / Visibility. Changes apply live; Cancel reverts them. */
export class VolumeSettingsDialog extends Component<{ onClose: () => void }, State> {
  static contextType = LabContext;
  declare context: ContextType<typeof LabContext>;

  private original: VolumeParams;

  constructor(props: { onClose: () => void }, context: ContextType<typeof LabContext>) {
    super(props, context);
    this.original = context.engine.volumeStudy.snapshot();
    this.state = { tab: "inputs", data: this.original, defaultsOpen: false };
  }

  private change(patch: Partial<VolumeParams>) {
    this.context.engine.volumeStudy.set(patch);
    this.setState({ data: this.context.engine.volumeStudy.snapshot() });
  }

  private cancel = () => {
    this.context.engine.volumeStudy.replace(this.original);
    this.props.onClose();
  };

  private ok = () => {
    const { engine } = this.context;
    const before = this.original;
    const after = engine.volumeStudy.snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      engine.ctl.recordAction("change Volume settings", () => engine.volumeStudy.replace(before), () => engine.volumeStudy.replace(after));
    }
    this.props.onClose();
  };

  private resetDefaults = () => {
    this.context.engine.volumeStudy.replace(defaultVolumeParams());
    this.setState({ data: this.context.engine.volumeStudy.snapshot(), defaultsOpen: false });
  };

  private saveDefaults = () => {
    saveVolumeDefaults(this.context.engine.volumeStudy.snapshot());
    this.setState({ defaultsOpen: false });
  };

  private setRange(unit: VisUnit, patch: Partial<VolumeParams["visibility"][VisUnit]>) {
    const { visibility } = this.state.data;
    this.change({ visibility: { ...visibility, [unit]: { ...visibility[unit], ...patch } } });
  }

  private inputs() {
    const { data } = this.state;
    return (
      <div className={styles.body}>
        <div className={styles.row}>
          <label className={styles.label}>MA Length</label>
          <input
            className={styles.numField}
            type="number"
            min={1}
            max={5000}
            value={data.maLength}
            onChange={(event) => {
              const next = Math.floor(Number(event.target.value));
              if (next >= 1 && next <= 5000) this.change({ maLength: next });
            }}
          />
        </div>
        <Checkbox label="Color based on previous close" checked={data.colorByPrevClose} onChange={(on) => this.change({ colorByPrevClose: on })} className={styles.check} />
      </div>
    );
  }

  private style() {
    const { data } = this.state;
    return (
      <div className={styles.body}>
        <Checkbox label="Volume" checked={data.showVolume} onChange={(on) => this.change({ showVolume: on })} className={styles.check} />
        <div className={styles.sub}>
          <div className={styles.row}>
            <label className={styles.label}>Growing</label>
            <Swatch tint={data.growing} disabled={!data.showVolume} onChange={(growing) => this.change({ growing })} />
          </div>
          <div className={styles.row}>
            <label className={styles.label}>Falling</label>
            <Swatch tint={data.falling} disabled={!data.showVolume} onChange={(falling) => this.change({ falling })} />
          </div>
        </div>
        <div className={styles.row}>
          <Checkbox label="Volume MA" checked={data.showMA} onChange={(on) => this.change({ showMA: on })} className={styles.check} />
          <span className={styles.maTools}>
            <Swatch solid tint={{ color: data.maColor, opacity: 100 }} disabled={!data.showMA} onChange={(tint) => this.change({ maColor: tint.color })} />
            <select className={styles.select} disabled={!data.showMA} value={data.maWidth} onChange={(event) => this.change({ maWidth: Number(event.target.value) })} aria-label="MA line width">
              {[1, 2, 3, 4].map((width) => (
                <option key={width} value={width}>
                  {width}px
                </option>
              ))}
            </select>
          </span>
        </div>

        <div className={styles.section}>Output values</div>
        <div className={styles.row}>
          <label className={styles.label}>Precision</label>
          <select className={cx(styles.select, styles.wide)} value={data.precision ?? "default"} onChange={(event) => this.change({ precision: event.target.value === "default" ? null : Number(event.target.value) })}>
            <option value="default">Default</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((digits) => (
              <option key={digits} value={digits}>
                {digits}
              </option>
            ))}
          </select>
        </div>
        <Checkbox label="Labels on price scale" checked={data.labelsOnScale} onChange={(on) => this.change({ labelsOnScale: on })} className={styles.check} />
        <Checkbox label="Values in status line" checked={data.valuesInStatus} onChange={(on) => this.change({ valuesInStatus: on })} className={styles.check} />

        <div className={styles.section}>Input values</div>
        <Checkbox label="Inputs in status line" checked={data.inputsInStatus} onChange={(on) => this.change({ inputsInStatus: on })} className={styles.check} />
      </div>
    );
  }

  private visibility() {
    const { visibility } = this.state.data;
    return (
      <div className={styles.body}>
        {VIS_UNITS.map((unit) => {
          const range = visibility[unit.id];
          return (
            <div key={unit.id} className={styles.visRow}>
              <Checkbox label={unit.label} checked={range.on} onChange={(on) => this.setRange(unit.id, { on })} className={cx(styles.check, styles.visCheck)} />
              {unit.limit ? <DualRange min={range.min} max={range.max} limit={unit.limit} disabled={!range.on} onChange={(min, max) => this.setRange(unit.id, { min, max })} /> : null}
            </div>
          );
        })}
      </div>
    );
  }

  render() {
    const { tab, defaultsOpen } = this.state;
    const tabs: Array<[Tab, string]> = [
      ["inputs", "Inputs"],
      ["style", "Style"],
      ["visibility", "Visibility"],
    ];
    return (
      <DialogShell
        title="Vol"
        className={styles.dialog}
        onClose={this.cancel}
        tabs={
          <div className={styles.tabs} role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={cx(styles.tab, tab === id && styles.on)} onClick={() => this.setState({ tab: id })}>
                {label}
              </button>
            ))}
          </div>
        }
      >
        {tab === "inputs" ? this.inputs() : tab === "style" ? this.style() : this.visibility()}
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
                <button onClick={this.resetDefaults}>Reset settings</button>
                <button onClick={this.saveDefaults}>Save as default</button>
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
      </DialogShell>
    );
  }
}
