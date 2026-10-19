import { Component } from "react";
import type * as React from "react";
import { Menu, UiProvider } from "@ui/core";
import "@ui/core/styles.css";
import { LabContext } from "../../app/context";
import { BottomBarGoToIcon, BottomBarIcons } from "../icons";
import type { RangePreset } from "../../market";
import { EXCHANGE_ZONE, TIMEZONES, UTC_ZONE, offsetLabel, offsetMinutes, type Timezone } from "../../timezones";
import styles from "./BottomBar.module.css";
import { cx } from "./utils";
const RANGES: Array<[RangePreset, string]> = [
  ["1d", "1D"],
  ["5d", "5D"],
  ["1m", "1M"],
  ["3m", "3M"],
  ["6m", "6M"],
  ["ytd", "YTD"],
  ["1y", "1Y"],
  ["5y", "5Y"],
  ["all", "All"],
];

export class BottomBar extends Component<object> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  private keyHandler = (event: KeyboardEvent) => {
    if (event.altKey && event.code === "KeyG") {
      event.preventDefault();
      this.context.ui.openGoTo();
    }
  };

  componentDidMount() {
    document.addEventListener("keydown", this.keyHandler);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.keyHandler);
  }

  render() {
    const { engine } = this.context;
    return (
      <>
        <div className={styles.bbLeft}>
          {RANGES.map(([range, label]) => (
            <button key={range} type="button" className={styles.bbBtn} title={`Go to ${label} range`} onClick={() => engine.market.setRange(range)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.grow} />
        <div className={styles.bbRight}>
          <Clock />
        </div>
      </>
    );
  }
}

interface ClockState {
  open: boolean;
  text: string;
}

class Clock extends Component<object, ClockState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: ClockState = { open: false, text: "" };
  private unsubscribe: (() => void) | null = null;
  private interval = 0;

  componentDidMount() {
    this.syncText();
    this.unsubscribe = this.context.engine.market.subscribe(this.syncText);
    this.interval = window.setInterval(this.syncText, 1000);
  }

  componentWillUnmount() {
    this.unsubscribe?.();
    window.clearInterval(this.interval);
  }

  private syncText = () => {
    const { market } = this.context.engine;
    const now = Date.now();
    const date = new Date(now + offsetMinutes(market.timezone.iana, now) * 60000);
    const pad = (value: number) => String(value).padStart(2, "0");
    const text = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} ${offsetLabel(market.timezone.iana, now)}`;
    if (text !== this.state.text) this.setState({ text });
  };

  private pick = (id: string) => {
    const { market } = this.context.engine;
    const timezone = [UTC_ZONE, EXCHANGE_ZONE, ...TIMEZONES].find((zone) => zone.id === id);
    if (timezone) market.setTimezone(timezone);
    this.setState({ open: false });
  };

  render() {
    const { market } = this.context.engine;
    const rows: Array<[Timezone, string]> = [
      [UTC_ZONE, "UTC"],
      [EXCHANGE_ZONE, "Exchange"],
      ...TIMEZONES.map((timezone): [Timezone, string] => [timezone, `${offsetLabel(timezone.iana)} ${timezone.name}`]),
    ];

    return (
      <UiProvider>
        <Menu
          opened={this.state.open}
          onChange={(open) => this.setState({ open })}
          position="top-end"
          offset={8}
          width={264}
          checkIcon={<BottomBarIcons.check />}
          closeOnItemClick
        >
          <Menu.Target>
            <button type="button" className={cx(styles.bbBtn, this.state.open && styles.on)} title="Timezone">
              {this.state.text}
            </button>
          </Menu.Target>
          <Menu.Dropdown className={styles.tzMenu}>
            <Menu.RadioGroup value={market.timezone.id} onChange={this.pick}>
              {rows.map(([timezone, label]) => (
                <Menu.RadioItem key={timezone.id} value={timezone.id} closeMenuOnClick>
                  {label}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Dropdown>
        </Menu>
      </UiProvider>
    );
  }
}

interface ScaleToggleState {
  mode: "regular" | "percent" | "indexed" | "log";
  auto: boolean;
}

class ScaleToggles extends Component<object, ScaleToggleState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  private unsubscribe: (() => void) | null = null;

  constructor(props: object, context: React.ContextType<typeof LabContext>) {
    super(props, context);
    const state = context.engine.scaleCtl.state;
    this.state = { mode: state.mode, auto: state.auto };
  }

  componentDidMount() {
    this.unsubscribe = this.context.engine.scaleCtl.subscribe(() => {
      const state = this.context.engine.scaleCtl.state;
      this.setState({ mode: state.mode, auto: state.auto });
    });
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  render() {
    const { scaleCtl } = this.context.engine;
    return (
      <>
        <button type="button" className={cx(styles.bbBtn, this.state.mode === "percent" && styles.active)} title="Toggle Percentage" onClick={() => scaleCtl.toggleMode("percent")}>
          %
        </button>
        <button type="button" className={cx(styles.bbBtn, this.state.mode === "log" && styles.active)} title="Toggle Log Scale" onClick={() => scaleCtl.toggleMode("log")}>
          log
        </button>
        <button type="button" className={cx(styles.bbBtn, this.state.auto && styles.active)} title="Toggle Auto Scale" onClick={() => scaleCtl.toggleAuto()}>
          auto
        </button>
      </>
    );
  }
}
