import { Component, createRef, type ReactNode } from "react";
import { LabContext } from "../../app/context";
import { ALL_ITEMS } from "../../data/tool-groups";
import { CommonIcons, Icons, toolIcons } from "../icons";
import styles from "./ObjectTree.module.css";

interface ObjectTreeProps {
  onClose: () => void;
}

interface ObjectTreeState {
  tick: number;
  offsetX: number;
  offsetY: number;
}

type ObjectInfo = { id: string; label: string; type: string; locked: boolean; visible: boolean };

type SeriesEntry = {
  id: string;
  label: string;
  icon: ReactNode;
  main?: boolean;
  visible: boolean;
};

type Action = {
  kind: "lock" | "hide" | "remove";
  title: string;
  icon: ReactNode;
  on: boolean;
  run: () => void;
};

const iconFor = (type: string) => {
  const item = ALL_ITEMS.find((candidate) => candidate.type === type);
  const Icon = item ? toolIcons[item.id] : Icons.trendline;
  return <Icon />;
};
const cx = (...tokens: Array<string | false | null | undefined>) => tokens.filter(Boolean).join(" ");

export class ObjectTree extends Component<ObjectTreeProps, ObjectTreeState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: ObjectTreeState = { tick: 0, offsetX: 0, offsetY: 0 };

  private panelRef = createRef<HTMLDivElement>();
  private bodyRef = createRef<HTMLDivElement>();
  private closeRef = createRef<HTMLButtonElement>();
  private unsubCtl: (() => void) | null = null;
  private unsubMarket: (() => void) | null = null;
  private unsubVolume: (() => void) | null = null;
  private drag: { startX: number; startY: number } | null = null;
  private bodyScrollTop = 0;

  componentDidMount() {
    const { engine } = this.context;
    this.unsubCtl = engine.ctl.subscribe(this.onUpdate);
    this.unsubMarket = engine.market.subscribe(this.onUpdate);
    this.unsubVolume = engine.onVolumeRemoved(this.onUpdate);
    document.addEventListener("mousedown", this.onOutside, true);
    document.addEventListener("mousemove", this.onDragMove);
    document.addEventListener("mouseup", this.onDragEnd);
  }

  componentDidUpdate() {
    if (this.bodyRef.current) this.bodyRef.current.scrollTop = this.bodyScrollTop;
  }

  componentWillUnmount() {
    this.unsubCtl?.();
    this.unsubMarket?.();
    this.unsubVolume?.();
    document.removeEventListener("mousedown", this.onOutside, true);
    document.removeEventListener("mousemove", this.onDragMove);
    document.removeEventListener("mouseup", this.onDragEnd);
  }

  private onUpdate = () => {
    if (this.bodyRef.current) this.bodyScrollTop = this.bodyRef.current.scrollTop;
    this.setState((state) => ({ tick: state.tick + 1 }));
  };

  private onOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (this.panelRef.current?.contains(target)) return;
    if (this.context.engine.overlayHost.contains(target)) this.props.onClose();
  };

  private onDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as Node;
    if (this.closeRef.current?.contains(target)) return;
    this.drag = { startX: event.clientX - this.state.offsetX, startY: event.clientY - this.state.offsetY };
    event.preventDefault();
  };

  private onDragMove = (event: MouseEvent) => {
    if (!this.drag) return;
    this.setState({ offsetX: event.clientX - this.drag.startX, offsetY: event.clientY - this.drag.startY });
  };

  private onDragEnd = () => {
    this.drag = null;
  };

  private buildSeriesEntries(): SeriesEntry[] {
    const { engine } = this.context;
    const entries: SeriesEntry[] = [
      {
        id: "main",
        label: [engine.market.symbol.symbol, engine.market.symbol.exchange, engine.market.resolution.legend].filter(Boolean).join(", "),
        icon: <Icons.candles />,
        main: true,
        visible: engine.candles.options().visible !== false,
      },
    ];
    const volume = engine.volume;
    if (volume) {
      entries.push({
        id: "volume",
        label: "Volume (SMA, 9)",
        icon: <Icons.wave />,
        visible: volume.options().visible !== false,
      });
    }
    return entries;
  }

  private seriesActions(entry: SeriesEntry): Action[] {
    const { engine } = this.context;
    if (entry.id === "main") {
      return [
        {
          kind: "hide",
          title: entry.visible ? "Hide" : "Show",
          icon: entry.visible ? <Icons.eye /> : <Icons.eyeOff />,
          on: !entry.visible,
          run: () => engine.candles.applyOptions({ visible: !entry.visible }),
        },
      ];
    }
    return [
      {
        kind: "hide",
        title: entry.visible ? "Hide" : "Show",
        icon: entry.visible ? <Icons.eye /> : <Icons.eyeOff />,
        on: !entry.visible,
        run: () => engine.volume?.applyOptions({ visible: !entry.visible }),
      },
      {
        kind: "remove",
        title: "Remove",
        icon: <CommonIcons.close />,
        on: false,
        run: () => engine.removeVolume(),
      },
    ];
  }

  private objectActions(object: ObjectInfo): Action[] {
    const { engine } = this.context;
    return [
      {
        kind: "lock",
        title: object.locked ? "Unlock" : "Lock",
        icon: object.locked ? <Icons.lock /> : <Icons.lockOpen />,
        on: object.locked,
        run: () => engine.ctl.toggleObjectLock(object.id),
      },
      {
        kind: "hide",
        title: object.visible ? "Hide" : "Show",
        icon: object.visible ? <Icons.eye /> : <Icons.eyeOff />,
        on: !object.visible,
        run: () => engine.ctl.toggleObjectVisible(object.id),
      },
      {
        kind: "remove",
        title: "Remove",
        icon: <CommonIcons.close />,
        on: false,
        run: () => engine.ctl.removeObject(object.id),
      },
    ];
  }

  private renderActions(actions: Action[]) {
    return (
      <div className={styles.otActs}>
        {actions.map((action) => (
          <button
            key={`${action.kind}-${action.title}`}
            className={cx(styles.otAct, action.on && styles.on, action.kind === "hide" && styles.hide)}
            title={action.title}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              action.run();
              this.onUpdate();
            }}
          >
            {action.icon}
          </button>
        ))}
      </div>
    );
  }

  private renderRow(options: {
    key: string;
    icon: ReactNode;
    label: string;
    main?: boolean;
    off?: boolean;
    selected?: boolean;
    actions: Action[];
    onClick?: () => void;
  }) {
    return (
      <div
        key={options.key}
        className={cx(styles.otRow, options.main && styles.main, options.off && styles.off, options.selected && styles.sel)}
        onClick={options.onClick}
      >
        <span className={styles.otIc}>{options.icon}</span>
        <span className={styles.otName}>{options.label}</span>
        {this.renderActions(options.actions)}
      </div>
    );
  }

  render() {
    const { engine } = this.context;
    const selected = engine.ctl.getState().selectedId;
    const transform = this.state.offsetX || this.state.offsetY ? { transform: `translate(${this.state.offsetX}px, ${this.state.offsetY}px)` } : undefined;
    return (
      <div className={styles.ot} ref={this.panelRef} style={transform}>
        <div className={styles.otHead} onMouseDown={this.onDragStart}>
          <span className={styles.otTitle}>Object tree</span>
          <button ref={this.closeRef} className={styles.otX} aria-label="Close" onClick={this.props.onClose}>
            <CommonIcons.close />
          </button>
        </div>
        <div className={styles.otBody} ref={this.bodyRef}>
          {this.buildSeriesEntries().map((entry) =>
            this.renderRow({
              key: entry.id,
              icon: entry.icon,
              label: entry.label,
              main: entry.main,
              off: !entry.visible,
              actions: this.seriesActions(entry),
            }),
          )}
          {engine.ctl.listObjects().map((object) =>
            this.renderRow({
              key: object.id,
              icon: iconFor(object.type),
              label: object.label,
              off: !object.visible,
              selected: object.id === selected,
              actions: this.objectActions(object),
              onClick: () => engine.ctl.selectObject(object.id),
            }),
          )}
        </div>
      </div>
    );
  }
}
