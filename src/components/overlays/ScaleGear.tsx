import { Component, createRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import type { ScaleMode } from "../../scale";
import { ScaleGearIcons } from "../icons";
import styles from "./ScaleGear.module.css";

interface ScaleGearState {
  tick: number;
  menuOpen: boolean;
  width: number;
  height: number;
  leftSide: boolean;
}

type Row = { label: string; key?: string; checked?: boolean; run?: () => void; chevron?: boolean } | "sep";
const cx = (...tokens: Array<string | false | null | undefined>) => tokens.filter(Boolean).join(" ");

export class ScaleGear extends Component<object, ScaleGearState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: ScaleGearState = { tick: 0, menuOpen: false, width: 0, height: 0, leftSide: false };

  private gearRef = createRef<HTMLButtonElement>();
  private menuRef = createRef<HTMLDivElement>();
  private resizeObserver: ResizeObserver | null = null;
  private unsubCtl: (() => void) | null = null;
  private unsubScale: (() => void) | null = null;

  componentDidMount() {
    const { engine } = this.context;
    this.unsubCtl = engine.ctl.subscribe(this.sync);
    this.unsubScale = engine.scaleCtl.subscribe(this.sync);
    this.resizeObserver = new ResizeObserver(this.sync);
    this.resizeObserver.observe(engine.overlayHost);
    this.sync();
  }

  componentDidUpdate(_: object, prevState: ScaleGearState) {
    if (!prevState.menuOpen && this.state.menuOpen) {
      document.addEventListener("mousedown", this.onOutside, true);
      document.addEventListener("keydown", this.onEsc, true);
      requestAnimationFrame(this.positionMenu);
    } else if (prevState.menuOpen && !this.state.menuOpen) {
      document.removeEventListener("mousedown", this.onOutside, true);
      document.removeEventListener("keydown", this.onEsc, true);
    } else if (this.state.menuOpen) {
      requestAnimationFrame(this.positionMenu);
    }
  }

  componentWillUnmount() {
    this.unsubCtl?.();
    this.unsubScale?.();
    this.resizeObserver?.disconnect();
    document.removeEventListener("mousedown", this.onOutside, true);
    document.removeEventListener("keydown", this.onEsc, true);
  }

  private sync = () => {
    const { engine } = this.context;
    this.setState((state) => ({
      tick: state.tick + 1,
      width: engine.ctl.scaleWidth(engine.ctl.scaleId),
      height: engine.chart.timeScale().height(),
      leftSide: engine.ctl.scaleId === "left",
    }));
  };

  private onOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (this.menuRef.current?.contains(target) || this.gearRef.current?.contains(target)) return;
    this.setState({ menuOpen: false });
  };

  private onEsc = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.setState({ menuOpen: false });
  };

  private positionMenu = () => {
    const { engine } = this.context;
    const menu = this.menuRef.current;
    if (!menu) return;
    const hostRect = engine.overlayHost.getBoundingClientRect();
    const axisTop = hostRect.bottom - engine.chart.timeScale().height();
    menu.style.right = `${window.innerWidth - hostRect.right}px`;
    menu.style.bottom = `${window.innerHeight - axisTop}px`;
  };

  private rows(): Row[] {
    const { engine } = this.context;
    const state = engine.scaleCtl.state;
    const mode = (target: ScaleMode) => () => engine.scaleCtl.setMode(target);
    return [
      { label: "Reset price scale", key: "⌥R", run: () => engine.ctl.resetView() },
      "sep",
      { label: "Auto (fits data to screen)", checked: state.auto, run: () => engine.scaleCtl.toggleAuto() },
      { label: "Lock price to bar ratio" },
      { label: "Scale price chart only" },
      { label: "Invert scale", key: "⌥I", checked: state.invert, run: () => engine.scaleCtl.toggleInvert() },
      "sep",
      { label: "Regular", checked: state.mode === "regular", run: mode("regular") },
      { label: "Percent", key: "⌥P", checked: state.mode === "percent", run: mode("percent") },
      { label: "Indexed to 100", checked: state.mode === "indexed", run: mode("indexed") },
      { label: "Logarithmic", key: "⌥L", checked: state.mode === "log", run: mode("log") },
      "sep",
      { label: "Move scale to left" },
      "sep",
      { label: "Labels", chevron: true },
      { label: "Lines", chevron: true },
      { label: "Countdown to bar close" },
      "sep",
      { label: "Time zone", chevron: true },
      { label: "Session breaks" },
    ];
  }

  private rowIcon(row: Exclude<Row, "sep">): ReactNode {
    if (row.checked) return <ScaleGearIcons.check />;
    return null;
  }

  private renderMenu() {
    if (!this.state.menuOpen) return null;
    const ChevronIcon = ScaleGearIcons.chevron;
    return createPortal(
      <div className={styles.scMenu} ref={this.menuRef}>
        {this.rows().map((row, index) => {
          if (row === "sep") return <div key={`sep-${index}`} className={styles.scSep} />;
          return (
            <div
              key={`${row.label}-${index}`}
              className={cx(styles.scItem, !row.run && styles.off)}
              onClick={() => {
                if (!row.run) return;
                row.run();
                this.setState({ menuOpen: false });
              }}
            >
              <span className={styles.scCheck}>{this.rowIcon(row)}</span>
              <span className={styles.scLabel}>{row.label}</span>
              {row.key ? <span className={styles.scKey}>{row.key}</span> : null}
              {row.chevron ? <span className={styles.scChev}><ChevronIcon /></span> : null}
            </div>
          );
        })}
      </div>,
      document.body,
    );
  }

  render() {
    const GearIcon = ScaleGearIcons.gear;
    return (
      <>
        <button
          ref={this.gearRef}
          className={cx(styles.scGear, this.state.menuOpen && styles.on, this.state.leftSide && styles.left)}
          title="Settings"
          style={{ width: this.state.width, height: this.state.height }}
          onClick={() => this.setState((state) => ({ menuOpen: !state.menuOpen }))}
        >
          <GearIcon />
        </button>
        {this.renderMenu()}
      </>
    );
  }
}
