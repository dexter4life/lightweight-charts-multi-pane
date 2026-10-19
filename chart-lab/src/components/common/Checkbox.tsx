import { Component, type ChangeEvent } from "react";
import { CommonIcons } from "../icons";
import styles from "./Checkbox.module.css";

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange(v: boolean): void;
  className?: string;
  boxClassName?: string;
  labelClassName?: string;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

export class Checkbox extends Component<CheckboxProps> {
  private handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.props.onChange(e.target.checked);
  };

  render() {
    return (
      <label className={cx(styles.sdCheck, this.props.className)}>
        <input type="checkbox" checked={this.props.checked} onChange={this.handleChange} />
        <span className={cx(styles.sdBox, this.props.boxClassName)}>
          <CommonIcons.tick aria-hidden="true" />
        </span>
        <span className={cx(styles.sdCl, this.props.labelClassName)}>{this.props.label}</span>
      </label>
    );
  }
}
