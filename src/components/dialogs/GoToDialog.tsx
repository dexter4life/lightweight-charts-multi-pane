import { Component, createRef, type ContextType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import { CommonIcons, GoToArrowIcon, GoToIcons } from "../icons";
import { makeDraggable } from "../common/draggable";
import styles from "./GoToDialog.module.css";

type Mode = "days" | "months" | "years";
type Tab = "date" | "range";

const DAY = 86400000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const p2 = (n: number) => String(n).padStart(2, "0");
const fmt = (ms: number) => {
  const date = new Date(ms);
  return `${date.getUTCFullYear()}-${p2(date.getUTCMonth() + 1)}-${p2(date.getUTCDate())}`;
};
const parse = (value: string) => {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const time = Date.UTC(+match[1], +match[2] - 1, +match[3]);
  return Number.isNaN(time) || new Date(time).getUTCMonth() !== +match[2] - 1 ? null : time;
};
const parseTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  return match && +match[1] < 24 && +match[2] < 60 ? +match[1] * 3600 + +match[2] * 60 : null;
};
const midnight = (seconds: number) => Math.floor(seconds / 86400) * DAY;
const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

let lastTab: Tab = "date";

interface GoToDialogProps {
  onClose: () => void;
}

interface GoToDialogState {
  initialized: boolean;
  tab: Tab;
  active: number;
  mode: Mode;
  dates: [number, number];
  times: [string, string];
  dateDrafts: [string, string];
  timeDrafts: [string, string];
  viewY: number;
  viewM: number;
}

interface Bounds {
  min: number;
  max: number;
}

export class GoToDialog extends Component<GoToDialogProps, GoToDialogState> {
  static contextType = LabContext;
  declare context: ContextType<typeof LabContext>;

  state: GoToDialogState = {
    initialized: false,
    tab: "date",
    active: 0,
    mode: "days",
    dates: [0, 0],
    times: ["00:00", "00:00"],
    dateDrafts: ["", ""],
    timeDrafts: ["00:00", "00:00"],
    viewY: 1970,
    viewM: 0,
  };

  private dialogRef = createRef<HTMLDivElement>();
  private inputRefs: Array<HTMLInputElement | null> = [];
  private dragCleanup: (() => void) | null = null;
  private intraday = false;
  private today = 0;
  private lastBar = 0;
  private dateSecs: [number, number] = [0, 0];
  private focusActiveInput = true;

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyDown, true);
    this.initializeState();
  }

  componentDidUpdate(_prevProps: GoToDialogProps, prevState: GoToDialogState) {
    if (!prevState.initialized && this.state.initialized && this.dialogRef.current) {
      this.dragCleanup = makeDraggable(this.dialogRef.current);
    }
    if (!this.state.initialized) return;
    if (this.focusActiveInput && (prevState.active !== this.state.active || !prevState.initialized || prevState.tab !== this.state.tab)) {
      this.focusActiveInput = false;
      this.inputRefs[this.state.active]?.focus();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.dragCleanup?.();
  }

  private initializeState() {
    const market = this.context.engine.market;
    this.intraday = market.resolution.sec < 86400;
    this.today = midnight(Date.now() / 1000);
    this.lastBar = midnight(market.bars[market.bars.length - 1].time);
    const visible = market.visibleTimes();
    this.dateSecs = visible ? [midnight(visible.from), Math.min(midnight(visible.to), this.lastBar)] : [this.lastBar, this.lastBar];

    const tab = lastTab;
    const dates: [number, number] = [this.today, this.lastBar];
    if (tab === "range") {
      dates[0] = this.dateSecs[0];
      dates[1] = this.dateSecs[1];
    }
    const view = new Date(dates[0]);
    this.focusActiveInput = true;
    this.setState({
      initialized: true,
      tab,
      active: 0,
      mode: "days",
      dates,
      times: ["00:00", "00:00"],
      dateDrafts: [fmt(dates[0]), fmt(dates[1])],
      timeDrafts: ["00:00", "00:00"],
      viewY: view.getUTCFullYear(),
      viewM: view.getUTCMonth(),
    });
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      this.props.onClose();
      return;
    }
    if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) this.apply();
  };

  private bound(state: GoToDialogState, index: number): Bounds {
    if (state.tab === "date") return { min: Number.NEGATIVE_INFINITY, max: this.today };
    return index === 0
      ? { min: Number.NEGATIVE_INFINITY, max: Math.min(state.dates[1], this.today) }
      : { min: state.dates[0], max: this.today };
  }

  private normalize(state: GoToDialogState): GoToDialogState {
    const next: GoToDialogState = {
      ...state,
      dates: [...state.dates] as [number, number],
      times: [...state.times] as [string, string],
      dateDrafts: [...state.dateDrafts] as [string, string],
      timeDrafts: [...state.timeDrafts] as [string, string],
    };

    [0, 1].forEach((index) => {
      const dateValue = parse(next.dateDrafts[index]);
      const bounds = this.bound(next, index);
      if (dateValue !== null && dateValue >= bounds.min && dateValue <= bounds.max) next.dates[index] = dateValue;
      next.dateDrafts[index] = fmt(next.dates[index]);

      const timeValue = parseTime(next.timeDrafts[index]);
      if (timeValue !== null) next.times[index] = next.timeDrafts[index].padStart(5, "0");
      next.timeDrafts[index] = next.times[index];
    });

    return next;
  }

  private apply = () => {
    const normalized = this.normalize(this.state);
    lastTab = normalized.tab;
    const toSeconds = (index: number) => normalized.dates[index] / 1000 + (this.intraday ? (parseTime(normalized.timeDrafts[index]) ?? 0) : 0);
    const market = this.context.engine.market;
    if (normalized.tab === "date") market.goToDate(toSeconds(0));
    else if (normalized.dates[0] <= normalized.dates[1]) market.goToRange(toSeconds(0), toSeconds(1));
    this.props.onClose();
  };

  private setTab = (tab: Tab) => {
    if (this.state.tab === tab) return;
    const dates: [number, number] = [...this.state.dates] as [number, number];
    if (tab === "range") {
      dates[0] = this.dateSecs[0];
      dates[1] = this.dateSecs[1];
    } else {
      dates[0] = this.today;
    }
    const view = new Date(dates[0]);
    this.focusActiveInput = true;
    this.setState({
      tab,
      active: 0,
      mode: "days",
      dates,
      dateDrafts: [fmt(dates[0]), fmt(dates[1])],
      viewY: view.getUTCFullYear(),
      viewM: view.getUTCMonth(),
    });
  };

  private setActive = (index: number) => {
    if (index === this.state.active) return;
    const view = new Date(this.state.dates[index]);
    this.setState({ active: index, mode: "days", viewY: view.getUTCFullYear(), viewM: view.getUTCMonth() });
  };

  private updateDateDraft = (index: number, value: string) => {
    const dateDrafts = [...this.state.dateDrafts] as [string, string];
    dateDrafts[index] = value;
    this.setState({ dateDrafts });
  };

  private updateTimeDraft = (index: number, value: string) => {
    const timeDrafts = [...this.state.timeDrafts] as [string, string];
    timeDrafts[index] = value;
    this.setState({ timeDrafts });
  };

  private commitDate = (index: number) => {
    this.setState((state) => {
      const next = this.normalize(state);
      const view = new Date(next.dates[index]);
      return { ...next, viewY: view.getUTCFullYear(), viewM: view.getUTCMonth() };
    });
  };

  private commitTime = () => {
    this.setState((state) => this.normalize(state));
  };

  private chooseDate = (time: number) => {
    const dates = [...this.state.dates] as [number, number];
    const dateDrafts = [...this.state.dateDrafts] as [string, string];
    dates[this.state.active] = time;
    dateDrafts[this.state.active] = fmt(time);
    this.focusActiveInput = true;
    this.setState({ dates, dateDrafts });
  };

  private stepMonth = (amount: number) => {
    const date = new Date(Date.UTC(this.state.viewY, this.state.viewM + amount, 1));
    this.setState({ viewY: date.getUTCFullYear(), viewM: date.getUTCMonth() });
  };

  private renderField(index: number) {
    const { active, dateDrafts, timeDrafts } = this.state;
    return (
      <div className={styles.row}>
        <label className={cx(styles.field, styles.date, active === index && styles.focus)}>
          <input
            ref={(node) => {
              this.inputRefs[index] = node;
            }}
            className={styles.input}
            value={dateDrafts[index]}
            spellCheck={false}
            onFocus={() => this.setActive(index)}
            onChange={(event) => this.updateDateDraft(index, event.target.value)}
            onBlur={() => this.commitDate(index)}
          />
          <span className={styles.icon}>
            <GoToIcons.calendar />
          </span>
        </label>
        <label className={cx(styles.field, styles.time, !this.intraday && styles.off)}>
          <input
            className={styles.input}
            value={timeDrafts[index]}
            disabled={!this.intraday}
            onChange={(event) => this.updateTimeDraft(index, event.target.value)}
            onBlur={this.commitTime}
          />
          <span className={styles.icon}>
            <GoToIcons.clock />
          </span>
        </label>
      </div>
    );
  }

  private renderCalendar() {
    const { active, dates, mode, tab, viewM, viewY } = this.state;
    const bounds = this.bound(this.state, active);
    const yearBase = Math.floor(viewY / 20) * 20;

    let title = "";
    let titleDisabled = false;
    let prevClick: (() => void) | undefined;
    let nextClick: (() => void) | undefined;
    let nextDisabled = false;

    if (mode === "days") {
      title = `${MONTHS[viewM]} ${viewY}`;
      prevClick = () => this.stepMonth(-1);
      nextClick = () => this.stepMonth(1);
      nextDisabled = Date.UTC(viewY, viewM + 1, 1) > bounds.max;
    } else if (mode === "months") {
      title = String(viewY);
      prevClick = () => this.setState({ viewY: viewY - 1 });
      nextClick = () => this.setState({ viewY: viewY + 1 });
      nextDisabled = Date.UTC(viewY + 1, 0, 1) > bounds.max;
    } else {
      title = `${yearBase} - ${yearBase + 19}`;
      titleDisabled = true;
      prevClick = () => this.setState({ viewY: viewY - 20 });
      nextClick = () => this.setState({ viewY: viewY + 20 });
      nextDisabled = Date.UTC(yearBase + 20, 0, 1) > bounds.max;
    }

    return (
      <div className={styles.calendar}>
        <div className={styles.calendarHead}>
          <button className={styles.nav} onClick={prevClick}>
            <GoToArrowIcon direction="left" />
          </button>
          <button
            className={styles.calendarTitle}
            disabled={titleDisabled}
            onClick={
              mode === "days"
                ? () => this.setState({ mode: "months" })
                : mode === "months"
                  ? () => this.setState({ mode: "years" })
                  : undefined
            }
          >
            {title}
          </button>
          <button className={styles.nav} disabled={nextDisabled} onClick={nextClick}>
            <GoToArrowIcon direction="right" />
          </button>
        </div>
        {mode === "days" ? this.renderDays(bounds, dates, tab, active, viewY, viewM) : this.renderMonthYearGrid(bounds, mode, viewY, viewM, yearBase)}
      </div>
    );
  }

  private renderDays(bounds: Bounds, dates: [number, number], tab: Tab, active: number, viewY: number, viewM: number) {
    const first = Date.UTC(viewY, viewM, 1);
    const lead = (new Date(first).getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(viewY, viewM + 1, 0)).getUTCDate();
    const low = Math.min(dates[0], dates[1]);
    const high = Math.max(dates[0], dates[1]);
    const weeks: ReactNode[] = [];

    for (let week = 0, day = 1 - lead; day <= count; week += 1) {
      const cells: ReactNode[] = [];
      for (let column = 0; column < 7; column += 1, day += 1) {
        if (day < 1 || day > count) {
          cells.push(<span key={`gap-${week}-${column}`} className={cx(styles.day, styles.gap)} />);
          continue;
        }
        const time = Date.UTC(viewY, viewM, day);
        cells.push(
          <button
            key={time}
            className={cx(
              styles.day,
              time === dates[active] && styles.sel,
              tab === "range" && time === dates[1 - active] && styles.edge,
              tab === "range" && time > low && time < high && styles.mid,
            )}
            disabled={time > bounds.max || time < bounds.min}
            onClick={() => this.chooseDate(time)}
          >
            {day}
          </button>,
        );
      }
      weeks.push(
        <div key={week} className={styles.week}>
          {cells}
        </div>,
      );
      if (week > 6) break;
    }

    return (
      <>
        <div className={styles.weekdays}>
          {WEEKDAYS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className={styles.weeks}>{weeks}</div>
      </>
    );
  }

  private renderMonthYearGrid(bounds: Bounds, mode: Mode, viewY: number, viewM: number, yearBase: number) {
    const items =
      mode === "months"
        ? MONTHS.map((month, index) => ({ label: month.slice(0, 3), value: index, start: Date.UTC(viewY, index, 1) }))
        : Array.from({ length: 20 }, (_, index) => ({ label: String(yearBase + index), value: yearBase + index, start: Date.UTC(yearBase + index, 0, 1) }));

    return (
      <>
        <div className={cx(styles.weekdays, styles.gridLabel)}>{mode === "months" ? "Months" : "Years"}</div>
        <div className={styles.grid}>
          {items.map((item) => {
            const selected = mode === "months" ? item.value === viewM : item.value === viewY;
            return (
              <button
                key={item.label}
                className={cx(styles.cell, selected && styles.sel)}
                disabled={item.start > bounds.max}
                onClick={() => {
                  if (mode === "months") this.setState({ viewM: item.value, mode: "days" });
                  else this.setState({ viewY: item.value, mode: "months" });
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  render() {
    if (!this.state.initialized) return null;
    const { tab } = this.state;

    return createPortal(
      <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && this.props.onClose()}>
        <div className={styles.dialog} ref={this.dialogRef} role="dialog" aria-label="Go to">
          <div className={styles.head} data-drag-handle>
            <div className={styles.heading}>Go to</div>
            <button className={styles.close} onClick={this.props.onClose}>
              <CommonIcons.close />
            </button>
          </div>
          <div className={styles.tabs}>
            <button className={cx(styles.tab, tab === "date" && styles.on)} onClick={() => this.setTab("date")}>
              Date
            </button>
            <button className={cx(styles.tab, tab === "range" && styles.on)} onClick={() => this.setTab("range")}>
              Custom range
            </button>
          </div>
          <div className={styles.body}>
            {this.renderField(0)}
            {tab === "range" && this.renderField(1)}
            <div>{this.renderCalendar()}</div>
          </div>
          <div className={styles.foot}>
            <button className={cx(styles.button, styles.out)} onClick={this.props.onClose}>
              Cancel
            </button>
            <button className={cx(styles.button, styles.fill)} onClick={this.apply}>
              Go to
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }
}
