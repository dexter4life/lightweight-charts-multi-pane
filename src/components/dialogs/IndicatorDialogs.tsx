import { Component, createRef, type ContextType } from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import { CommonIcons, SymbolSearchIcons } from "../icons";
import { makeDraggable } from "../common/draggable";
import { INDICATOR_SPECS, externalKind, loadExternalIndicators, type ExternalIndicator, type IndicatorKind } from "../../indicators";
import styles from "./IndicatorDialogs.module.css";

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

interface Shell {
  title: string;
  small?: boolean;
  /** Extra class for the dialog box (width, height). */
  className?: string;
  /** Rendered between the title and the body, e.g. tabs. */
  tabs?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

export class DialogShell extends Component<Shell> {
  private ref = createRef<HTMLDivElement>();
  private cleanup: (() => void) | null = null;

  componentDidMount() {
    if (this.ref.current) this.cleanup = makeDraggable(this.ref.current);
    document.addEventListener("keydown", this.onKey, true);
  }

  componentWillUnmount() {
    this.cleanup?.();
    document.removeEventListener("keydown", this.onKey, true);
  }

  private onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.props.onClose();
  };

  render() {
    const { title, small, onClose, children, className, tabs } = this.props;
    return createPortal(
      <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <div ref={this.ref} className={cx(styles.dialog, small && styles.small, className)} role="dialog" aria-label={title}>
          <div className={styles.head} data-drag-handle>
            <div className={styles.heading}>{title}</div>
            <button className={styles.close} onClick={onClose} aria-label="Close">
              <CommonIcons.close />
            </button>
          </div>
          {tabs}
          {children}
        </div>
      </div>,
      document.body,
    );
  }
}

interface PickerState {
  query: string;
  external: ExternalIndicator[];
}

/** Lists the available indicators; a click adds one to the active chart. */
export class IndicatorsDialog extends Component<{ onClose: () => void }, PickerState> {
  static contextType = LabContext;
  declare context: ContextType<typeof LabContext>;

  state: PickerState = { query: "", external: [] };
  private alive = true;

  componentDidMount() {
    this.alive = true;
    void loadExternalIndicators().then((external) => this.alive && this.setState({ external }));
  }

  componentWillUnmount() {
    this.alive = false;
  }

  private add(kind: IndicatorKind) {
    this.context.engine.addIndicator(kind);
    this.props.onClose();
  }

  render() {
    const query = this.state.query.trim().toLowerCase();
    const matches = (item: { short: string; name: string; description: string }) => !query || `${item.short} ${item.name} ${item.description}`.toLowerCase().includes(query);
    const items = [
      ...INDICATOR_SPECS.filter(matches).map((spec) => ({ kind: spec.id as IndicatorKind, short: spec.short, name: spec.name, origin: "Built-in" })),
      ...this.state.external.filter(matches).map((ext) => ({ kind: externalKind(ext.id), short: ext.short, name: ext.name, origin: ext.origin })),
    ];
    return (
      <DialogShell title="Indicators" onClose={this.props.onClose}>
        <div className={styles.searchRow}>
          <SymbolSearchIcons.search />
          <input className={styles.search} autoFocus placeholder="Search" value={this.state.query} onChange={(event) => this.setState({ query: event.target.value })} />
        </div>
        <div className={styles.list}>
          {items.length ? (
            items.map((def) => (
              <button key={def.kind} className={styles.item} onClick={() => this.add(def.kind)}>
                <b>{def.short}</b>
                <span>{def.name}</span>
                <small>{def.origin}</small>
              </button>
            ))
          ) : (
            <div className={styles.empty}>No indicators match &quot;{this.state.query}&quot;</div>
          )}
        </div>
      </DialogShell>
    );
  }
}
