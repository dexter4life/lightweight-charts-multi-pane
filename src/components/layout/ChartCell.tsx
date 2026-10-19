import { Component, createRef } from "react";
import { ChartEngine } from "../../app/engine";
import type { MarketOptions } from "../../market";
import { LabContext, type LabContextValue, type UiActions } from "../../app/context";
import { Legend } from "../overlays/Legend";
import { PaneControls } from "../overlays/PaneControls";
import { FloatingToolbar } from "../overlays/FloatingToolbar";
import { ContextMenu } from "../overlays/ContextMenu";
import { ObjectTree } from "../overlays/ObjectTree";
import { ChartNav } from "../overlays/ChartNav";
import { ScaleGear } from "../overlays/ScaleGear";
import styles from "../../app/ChartLab.module.css";

interface Props {
  id: string;
  ui: UiActions;
  /** Only the active chart reacts to keyboard shortcuts. */
  active: boolean;
  /** Draw the active outline (only when the tab has several charts). */
  highlight: boolean;
  showObjectTree: boolean;
  onCloseObjectTree(): void;
  /** Reports the engine once created and `null` once disposed so the shell can drive its chrome from the active one. */
  onEngine(id: string, engine: ChartEngine | null): void;
  /** Datafeed, symbol and resolution the cell's market starts with. */
  marketOptions?(id: string): MarketOptions;
  onActivate(id: string): void;
}

interface State {
  ready: boolean;
}

/** One chart of the grid: its own engine plus the overlays that sit on the chart. The chrome around it is shared and lives in the shell. */
export class ChartCell extends Component<Props, State> {
  state: State = { ready: false };

  private chartRef = createRef<HTMLDivElement>();
  private hostRef = createRef<HTMLDivElement>();
  private engine: ChartEngine | null = null;
  private ctxValue: LabContextValue | null = null;
  private unsubSettings: (() => void) | null = null;

  componentDidMount() {
    const engine = new ChartEngine(this.chartRef.current!, this.hostRef.current!, this.props.marketOptions?.(this.props.id));
    this.engine = engine;
    engine.keysEnabled = this.props.active;
    this.ctxValue = { engine, ui: this.props.ui };
    this.unsubSettings = engine.ctl.onOpenSettings((id) => {
      this.props.onActivate(this.props.id);
      this.props.ui.openObjectSettings(id);
    });
    this.props.onEngine(this.props.id, engine);
    this.setState({ ready: true });
  }

  componentDidUpdate(prev: Props) {
    if (this.engine && prev.active !== this.props.active) this.engine.keysEnabled = this.props.active;
  }

  componentWillUnmount() {
    this.unsubSettings?.();
    this.props.onEngine(this.props.id, null);
    this.engine?.dispose();
    this.engine = null;
    this.ctxValue = null;
  }

  render() {
    const { ready } = this.state;
    return (
      <LabContext.Provider value={this.ctxValue as LabContextValue}>
        <div className={this.props.highlight ? `${styles.cell} ${styles.cellActive}` : styles.cell} ref={this.hostRef} onMouseDownCapture={() => this.props.onActivate(this.props.id)}>
          <div className={styles.chart} ref={this.chartRef} />
          {ready && (
            <>
              <ContextMenu />
              <FloatingToolbar />
              <ChartNav />
              <Legend />
              <PaneControls />
              <ScaleGear />
              {this.props.showObjectTree && <ObjectTree onClose={this.props.onCloseObjectTree} />}
            </>
          )}
        </div>
      </LabContext.Provider>
    );
  }
}
