import { Component, createRef } from "react";
import { LabContext } from "../../app/context";
import { ChartNavIcons, type IconComponent } from "../icons";
import styles from "./ChartNav.module.css";

interface ChartNavState {
  show: boolean;
  presentOn: boolean;
  barLeft: number;
  barTop: number;
  presentLeft: number;
  presentTop: number;
  navMode: string;
}

const HOLD_DELAY = 200;
const cx = (...tokens: Array<string | false | null | undefined>) => tokens.filter(Boolean).join(" ");

export class ChartNav extends Component<object, ChartNavState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: ChartNavState = { show: false, presentOn: false, barLeft: 0, barTop: 0, presentLeft: 0, presentTop: 0, navMode: "hover" };

  private resizeObserver: ResizeObserver | null = null;
  private unsubCtl: (() => void) | null = null;
  private unsubSettings: (() => void) | null = null;
  private holdTimer = 0;
  private barRef = createRef<HTMLDivElement>();
  private presentRef = createRef<HTMLButtonElement>();

  componentDidMount() {
    const { engine } = this.context;
    this.unsubCtl = engine.ctl.subscribe(this.sync);
    this.unsubSettings = engine.settings.subscribe(this.sync);
    engine.chart.timeScale().subscribeVisibleLogicalRangeChange(this.sync);
    engine.overlayHost.addEventListener("mouseenter", this.onEnter);
    engine.overlayHost.addEventListener("mouseleave", this.onLeave);
    this.resizeObserver = new ResizeObserver(this.sync);
    this.resizeObserver.observe(engine.overlayHost);
    this.sync();
  }

  componentWillUnmount() {
    const { engine } = this.context;
    this.unsubCtl?.();
    this.unsubSettings?.();
    engine.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.sync);
    engine.overlayHost.removeEventListener("mouseenter", this.onEnter);
    engine.overlayHost.removeEventListener("mouseleave", this.onLeave);
    this.resizeObserver?.disconnect();
    window.clearInterval(this.holdTimer);
    window.removeEventListener("mouseup", this.stopHold);
  }

  private onEnter = () => this.setState({ show: true });
  private onLeave = () => this.setState({ show: false });

  private sync = () => {
    const { engine } = this.context;
    const host = engine.overlayHost;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const paneBottom = height - engine.chart.timeScale().height();
    const paneRight = engine.ctl.scaleId === "left" ? width : width - engine.ctl.scaleWidth("right");
    const barWidth = this.barRef.current?.offsetWidth ?? 126;
    const presentWidth = this.presentRef.current?.offsetWidth ?? 28;
    this.setState({
      presentOn: engine.ctl.isAwayFromPresent(),
      barLeft: (width - barWidth) / 2,
      barTop: paneBottom - 61,
      presentLeft: paneRight - 15 - presentWidth,
      presentTop: paneBottom - 61,
      navMode: engine.settings.data.navVis,
    });
  };

  private startHold = (bars: number) => (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const { engine } = this.context;
    engine.ctl.scrollBars(bars);
    window.clearInterval(this.holdTimer);
    this.holdTimer = window.setInterval(() => engine.ctl.scrollBars(bars), HOLD_DELAY);
    window.addEventListener("mouseup", this.stopHold);
  };

  private stopHold = () => {
    window.clearInterval(this.holdTimer);
    this.holdTimer = 0;
    window.removeEventListener("mouseup", this.stopHold);
  };

  private button(Icon: IconComponent, title: string, onClick?: () => void, onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void) {
    return (
      <button className={styles.cnavBtn} title={title} aria-label={title} onClick={onClick} onMouseDown={onMouseDown}>
        <Icon />
      </button>
    );
  }

  render() {
    const { engine } = this.context;
    const PresentIcon = ChartNavIcons.present;
    return (
      <div className={styles.root} data-nav-mode={this.state.navMode}>
        <div ref={this.barRef} className={cx(styles.cnav, this.state.show && styles.cnavShow)} style={{ left: this.state.barLeft, top: this.state.barTop }}>
          <div className={styles.cnavGroup}>
            {this.button(ChartNavIcons.out, "Zoom out", () => engine.ctl.zoomStep("out"))}
            {this.button(ChartNavIcons.in, "Zoom in", () => engine.ctl.zoomStep("in"))}
          </div>
          <div className={styles.cnavGroup}>
            {this.button(ChartNavIcons.left, "Scroll to the left", undefined, this.startHold(-1))}
            {this.button(ChartNavIcons.right, "Scroll to the right", undefined, this.startHold(1))}
          </div>
          <div className={cx(styles.cnavGroup, styles.cnavSingle)}>{this.button(ChartNavIcons.reset, "Reset chart view", () => engine.ctl.resetView())}</div>
        </div>
        <button
          ref={this.presentRef}
          className={cx(styles.cnavBtn, styles.cnavPresent, this.state.presentOn && styles.cnavOn)}
          title="Scroll to the most recent bar"
          aria-label="Scroll to the most recent bar"
          style={{ left: this.state.presentLeft, top: this.state.presentTop }}
          onClick={() => engine.ctl.backToPresent()}
        >
          <PresentIcon />
        </button>
      </div>
    );
  }
}
