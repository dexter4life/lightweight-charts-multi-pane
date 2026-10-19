import { Component, createRef, type ContextType } from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import { SymbolSearchIcons } from "../icons";
import { makeDraggable } from "../common/draggable";
import { searchSymbols, type SymbolInfo } from "../../symbols";
import styles from "./SymbolSearchDialog.module.css";

let symbolSearchOpen = false;

interface SymbolSearchDialogProps {
  initial?: string;
  onClose: () => void;
}

interface SymbolSearchDialogState {
  query: string;
  hits: SymbolInfo[];
  sel: number;
}

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

export class SymbolSearchDialog extends Component<SymbolSearchDialogProps, SymbolSearchDialogState> {
  static contextType = LabContext;
  declare context: ContextType<typeof LabContext>;

  state: SymbolSearchDialogState = {
    query: "",
    hits: [],
    sel: 0,
  };

  private searchToken = 0;
  private unmounted = false;

  /** Looks the query up through the host when it provides a search, otherwise in the built-in list. */
  private runSearch(query: string) {
    const token = ++this.searchToken;
    const host = this.context.ui.searchSymbols;
    if (!host) {
      this.setState({ hits: searchSymbols(query), sel: 0 });
      return;
    }
    host(query)
      .catch(() => [] as SymbolInfo[])
      .then((hits) => {
        if (!this.unmounted && token === this.searchToken) this.setState({ hits, sel: 0 });
      });
  }

  private dialogRef = createRef<HTMLDivElement>();
  private inputRef = createRef<HTMLInputElement>();
  private rowRefs: Array<HTMLDivElement | null> = [];
  private dragCleanup: (() => void) | null = null;

  componentDidMount() {
    symbolSearchOpen = true;
    this.dragCleanup = this.dialogRef.current ? makeDraggable(this.dialogRef.current) : null;
    document.addEventListener("keydown", this.onKeyDown, true);

    const market = this.context.engine.market;
    const query = this.props.initial ?? market.symbol.symbol;
    this.setState({ query }, () => {
      this.runSearch(query);
      const input = this.inputRef.current;
      if (!input) return;
      input.focus();
      if (this.props.initial === undefined) input.select();
    });
  }

  componentWillUnmount() {
    this.unmounted = true;
    symbolSearchOpen = false;
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.dragCleanup?.();
  }

  private pick = (index: number) => {
    const hit = this.state.hits[index];
    if (!hit) return;
    this.props.onClose();
    this.context.engine.market.setSymbol(hit);
  };

  private onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    this.setState({ query });
    this.runSearch(query);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.props.onClose();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      this.pick(this.state.sel);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const { hits, sel } = this.state;
    if (!hits.length) return;
    const next = (sel + (event.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
    this.setState({ sel: next }, () => this.rowRefs[next]?.scrollIntoView({ block: "nearest" }));
  };

  private onOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) this.props.onClose();
  };

  private renderRows() {
    const { hits, sel } = this.state;
    if (!hits.length) {
      return (
        <div className={styles.empty}>
          <SymbolSearchIcons.empty />
          <div>No symbols match your criteria</div>
        </div>
      );
    }

    return hits.map((hit, index) => (
      <div
        key={`${hit.symbol}-${hit.exchange}`}
        className={cx(styles.row, index === sel && styles.sel)}
        ref={(node) => {
          this.rowRefs[index] = node;
        }}
        onClick={() => this.pick(index)}
        onMouseMove={() => {
          if (index !== this.state.sel) this.setState({ sel: index });
        }}
      >
        <span className={styles.symbol}>{hit.symbol}</span>
        <span className={styles.description}>{hit.description}</span>
        <span className={styles.exchange}>
          <i>{hit.type}</i>
          {hit.exchange}
        </span>
      </div>
    ));
  }

  render() {
    const { hits, query } = this.state;
    return createPortal(
      <div className={styles.overlay} onMouseDown={this.onOverlayMouseDown}>
        <div className={styles.dialog} ref={this.dialogRef} role="dialog" aria-label="Symbol Search">
          <div className={styles.head} data-drag-handle>
            <div className={styles.title}>Symbol Search</div>
            <button className={styles.close} title="Close" onClick={this.props.onClose}>
              <SymbolSearchIcons.close />
            </button>
          </div>
          <div className={styles.search}>
            <span className={styles.searchIcon}>
              <SymbolSearchIcons.search />
            </span>
            <input
              ref={this.inputRef}
              className={styles.input}
              type="text"
              spellCheck={false}
              autoComplete="off"
              placeholder="Search"
              value={query}
              onChange={this.onSearchChange}
            />
          </div>
          <div className={styles.columns} style={{ display: hits.length ? undefined : "none" }}>
            <span className={styles.col1}>Symbol</span>
            <span>Description</span>
          </div>
          <div className={styles.list}>{this.renderRows()}</div>
          <div className={styles.foot}>Simply start typing while on the chart to pull up this search box</div>
        </div>
      </div>,
      document.body,
    );
  }
}

export class TypeToSearch extends Component {
  static contextType = LabContext;
  declare context: ContextType<typeof LabContext>;

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (symbolSearchOpen || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1 || !/[a-z0-9]/i.test(event.key)) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    event.preventDefault();
    this.context.ui.openSymbolSearch(event.key.toUpperCase());
  };

  render() {
    return null;
  }
}
