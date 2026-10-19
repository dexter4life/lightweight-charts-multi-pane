import { Component } from "react";
import { createPortal } from "react-dom";
import styles from "./ToolbarTooltip.module.css";
import { cx } from "./utils";

interface Props {
  anchor: HTMLElement | null;
  text: string;
  keys?: string[];
  above?: boolean;
}

export class ToolbarTooltip extends Component<Props> {
  render() {
    const { anchor, text, keys = [], above = false } = this.props;
    if (!anchor) return null;
    const target = above ? anchor : anchor.closest<HTMLElement>("[data-toolbar-item]") ?? anchor;
    const rect = target.getBoundingClientRect();
    const style = above
      ? {
          position: "fixed" as const,
          left: rect.left + rect.width / 2,
          top: rect.top - 4,
          transform: "translate(-50%, -100%)",
          zIndex: 1000,
          pointerEvents: "none" as const,
        }
      : {
          position: "fixed" as const,
          left: rect.right + 4,
          top: rect.top + rect.height / 2,
          transform: "translateY(-50%)",
          zIndex: 1000,
          pointerEvents: "none" as const,
        };

    return createPortal(
      <div className={cx(styles.tt, above && styles.ttAbove)} style={style}>
        <div className={styles.ttBody}>
          <span className={cx(styles.ttText, (above || keys.length === 0) && styles.ttSolo)}>{text}</span>
          {!above && keys.length > 0 && (
            <span className={styles.ttKeys}>
              {keys.map((key, index) => (
                <span key={`${key}-${index}`}>
                  {index > 0 && <span className={styles.ttPlus}>+</span>}
                  <span className={styles.ttKey}>{key}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      </div>,
      document.body,
    );
  }
}
