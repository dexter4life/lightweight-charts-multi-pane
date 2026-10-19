import { Component, createRef } from "react";
import { CommonIcons } from "../icons";
import { Menu, type MenuItem } from "./Menu";
import styles from "./Select.module.css";

interface SelectProps {
  items: MenuItem[];
  value: string;
  onChange(v: string): void;
  className?: string;
}

interface SelectState {
  open: boolean;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

export class Select extends Component<SelectProps, SelectState> {
  state: SelectState = { open: false };

  private buttonRef = createRef<HTMLButtonElement>();

  private toggle = () => {
    this.setState((state) => ({ open: !state.open }));
  };

  private close = () => {
    this.setState({ open: false });
  };

  private handlePick = (value: string) => {
    this.setState({ open: false });
    this.props.onChange(value);
  };

  render() {
    const current = this.props.items.find((item) => item.value === this.props.value)?.label ?? this.props.value;
    return (
      <>
        <button type="button" className={cx(styles.sdSelect, this.props.className)} onClick={this.toggle} ref={this.buttonRef}>
          <span>{current}</span>
          <CommonIcons.chevron aria-hidden="true" />
        </button>
        {this.state.open && this.buttonRef.current ? (
          <Menu anchor={this.buttonRef.current} items={this.props.items} current={this.props.value} onPick={this.handlePick} onClose={this.close} />
        ) : null}
      </>
    );
  }
}

export type { MenuItem };
