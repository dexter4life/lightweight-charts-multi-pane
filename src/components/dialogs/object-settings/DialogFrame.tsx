import { Component, createRef, type CSSProperties, type ReactNode } from "react";
import { CommonIcons } from "../../icons";
import { PENCIL, type Tab } from "./constants";
import styles from "./ObjectSettingsDialog.module.css";

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

interface DialogFrameProps {
  title: string;
  tabs: Tab[];
  activeTab: Tab;
  onTab(tab: Tab): void;
  onClose(): void;
  body: ReactNode;
  footer: ReactNode;
  style?: CSSProperties;
  dialogClassName?: string;
  hidePencil?: boolean;
  dialogRef?(node: HTMLDivElement | null): void;
}

export class DialogFrame extends Component<DialogFrameProps> {
  private ref = createRef<HTMLDivElement>();

  componentDidMount() {
    this.props.dialogRef?.(this.ref.current);
  }

  componentDidUpdate() {
    this.props.dialogRef?.(this.ref.current);
  }

  render() {
    const PencilIcon = PENCIL;
    return (
      <div className={styles.sdOverlay}>
        <div className={this.props.dialogClassName ?? styles.sd} role="dialog" style={this.props.style} ref={this.ref}>
          <div className={styles.sdHead} data-drag-handle="">
            <span className={styles.sdTitle}>{this.props.title}</span>
            {this.props.hidePencil ? null : <PencilIcon className={styles.sdPencil} />}
            <button type="button" className={styles.sdX} title="Close" onClick={this.props.onClose}>
              <CommonIcons.close />
            </button>
          </div>
          <div className={styles.sdTabs}>
            {this.props.tabs.map((tab) => (
              <button key={tab} type="button" className={cx(this.props.activeTab === tab && styles.on)} onClick={() => this.props.onTab(tab)}>
                {tab}
              </button>
            ))}
          </div>
          <div className={styles.sdBody}>{this.props.body}</div>
          <div className={styles.sdFoot}>{this.props.footer}</div>
        </div>
      </div>
    );
  }
}
