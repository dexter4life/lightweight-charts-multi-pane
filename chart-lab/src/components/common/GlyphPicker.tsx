import { Component, createRef, type ComponentType, type ContextType, type CSSProperties, type SVGProps } from "react";
import { createPortal } from "react-dom";
import { LabContext } from "../../app/context";
import { GlyphPickerTabIcons } from "../icons";
import { asText, EMOJI_SECTIONS, ICON_SECTIONS, type GlyphSection } from "../../data/glyph-data";
import styles from "./GlyphPicker.module.css";
import type { PickedSticker } from "../../stickers/catalog";
import { StickerPanel } from "./StickerPanel";

const TAB_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = GlyphPickerTabIcons;

const RECENT_KEY = "chartlab.recentIcons";
const RECENT_MAX = 18;

const loadRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
};

type Mode = "icons" | "emojis" | "stickers";
type PickerSection = GlyphSection & { recent?: boolean };

let lastMode: Mode = "icons";

export interface GlyphPickerOptions {
  onEmoji?(emoji: string): void;
}

interface GlyphPickerProps {
  anchor: HTMLElement;
  boundsEl?: HTMLElement;
  options?: GlyphPickerOptions;
  onClose(): void;
}

interface GlyphPickerState {
  mode: Mode;
  activeId: string;
  style: CSSProperties;
  stickerHeight: number;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

export class GlyphPicker extends Component<GlyphPickerProps, GlyphPickerState> {
  static contextType = LabContext;
  declare context: ContextType<typeof LabContext>;

  private panelRef = createRef<HTMLDivElement>();
  private scrollRef = createRef<HTMLDivElement>();
  private blockRefs = new Map<string, HTMLDivElement | null>();

  constructor(props: GlyphPickerProps) {
    super(props);
    const mode: Mode = props.options?.onEmoji ? "emojis" : lastMode;
    const firstId = this.getSections(mode)[0]?.id ?? "";
    this.state = { mode, activeId: firstId, style: { left: "0px", top: "0px", height: "0px" }, stickerHeight: 0 };
  }

  componentDidMount() {
    this.place();
    document.addEventListener("mousedown", this.handleAway, true);
    window.addEventListener("keydown", this.handleKey, true);
    window.addEventListener("resize", this.handleResize);
  }

  componentDidUpdate(prevProps: GlyphPickerProps) {
    if (prevProps.anchor !== this.props.anchor || prevProps.boundsEl !== this.props.boundsEl) {
      this.place();
    }
    const scroll = this.scrollRef.current;
    if (this.state.mode === "stickers" && scroll && scroll.clientHeight !== this.state.stickerHeight) {
      this.setState({ stickerHeight: scroll.clientHeight });
    }
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleAway, true);
    window.removeEventListener("keydown", this.handleKey, true);
    window.removeEventListener("resize", this.handleResize);
  }

  private isEmbedded() {
    return !!this.props.options?.onEmoji;
  }

  private getSections(mode = this.state.mode): PickerSection[] {
    if (mode === "stickers") return [];
    const sections: PickerSection[] = mode === "icons" ? [...ICON_SECTIONS] : [...EMOJI_SECTIONS];
    const recent = mode === "icons" ? loadRecent() : [];
    if (recent.length) sections.unshift({ id: "recent", title: "Recently used", glyphs: recent, recent: true });
    return sections;
  }

  private getTabIds(mode = this.state.mode): string[] {
    return mode === "icons" ? ["recent", ...ICON_SECTIONS.map((section) => section.id)] : EMOJI_SECTIONS.map((section) => section.id);
  }

  private setPanelStyle(style: CSSProperties, after?: () => void) {
    const current = this.state.style;
    const changed = current.left !== style.left || current.top !== style.top || current.height !== style.height || current.zIndex !== style.zIndex;
    if (changed) {
      this.setState({ style }, after);
    } else {
      after?.();
    }
  }

  private place(after?: () => void) {
    if (this.isEmbedded()) {
      const rect = this.props.anchor.getBoundingClientRect();
      const height = Math.min(520, window.innerHeight - 16);
      this.setPanelStyle(
        {
          left: `${Math.round(Math.min(rect.left, window.innerWidth - 362))}px`,
          top: `${Math.max(8, Math.min(Math.round(rect.bottom + 6), window.innerHeight - height - 8))}px`,
          height: `${height}px`,
          zIndex: "10000",
        },
        after,
      );
      return;
    }
    const bounds = this.props.boundsEl ?? this.props.anchor;
    const rect = bounds.getBoundingClientRect();
    const height = Math.min(674, window.innerHeight - 16);
    this.setPanelStyle(
      {
        left: `${Math.round(rect.right + 1)}px`,
        top: `${Math.max(8, Math.round((window.innerHeight - height) / 2))}px`,
        height: `${height}px`,
      },
      after,
    );
  }

  private handleResize = () => {
    this.place();
  };

  private handleAway = (e: MouseEvent) => {
    const panel = this.panelRef.current;
    const target = e.target as Node;
    if (panel && !panel.contains(target) && !this.props.anchor.contains(target)) this.props.onClose();
  };

  private handleKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    this.props.onClose();
  };

  private selectSticker = (sticker: PickedSticker) => {
    this.context.engine.ctl.armGlyph("sticker", sticker.url);
    this.props.onClose();
  };

  private setMode = (mode: Mode) => {
    if (mode === this.state.mode) return;
    lastMode = mode;
    const activeId = this.getSections(mode)[0]?.id ?? "";
    this.blockRefs.clear();
    this.setState({ mode, activeId }, () => {
      this.place();
    });
  };

  private pick = (glyph: string) => {
    const onEmoji = this.props.options?.onEmoji;
    if (onEmoji) {
      onEmoji(glyph);
      this.props.onClose();
      return;
    }
    if (this.state.mode === "icons") {
      const recent = [glyph, ...loadRecent().filter((item) => item !== glyph)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
      } catch {
        /* storage unavailable */
      }
      this.context.engine.ctl.armGlyph("icon", glyph.codePointAt(0)!);
    } else {
      this.context.engine.ctl.armGlyph("emoji", glyph);
    }
    this.props.onClose();
  };

  private setBlockRef = (id: string) => (el: HTMLDivElement | null) => {
    this.blockRefs.set(id, el);
  };

  private scrollToSection = (id: string) => {
    const scroll = this.scrollRef.current;
    const sections = this.getSections();
    const block = this.blockRefs.get(id);
    if (!scroll || !block) return;
    scroll.scrollTo({ top: id === sections[0]?.id ? 0 : block.offsetTop - 2 });
    this.setState({ activeId: id });
  };

  private handleScroll = () => {
    const scroll = this.scrollRef.current;
    const sections = this.getSections();
    if (!scroll || !sections.length) return;
    let current = sections[0].id;
    for (const section of sections) {
      if ((this.blockRefs.get(section.id)?.offsetTop ?? 0) - 40 <= scroll.scrollTop) current = section.id;
    }
    if (current !== this.state.activeId) this.setState({ activeId: current });
  };

  render() {
    const sections = this.getSections();
    const embedded = this.isEmbedded();
    return createPortal(
      <div className={cx(styles.gp, this.state.mode === "stickers" && styles.stickers)} ref={this.panelRef} style={this.state.style}>
        <div className={styles.gpTabs}>
          {this.state.mode === "stickers"
            ? null
            : this.getTabIds().map((id) => {
                const Icon = TAB_ICON[id] ?? TAB_ICON.objects;
                return (
                  <button key={id} type="button" className={cx(styles.gpTab, this.state.activeId === id && styles.on)} onClick={() => this.scrollToSection(id)}>
                    <Icon aria-hidden="true" />
                  </button>
                );
              })}
        </div>
        <div className={styles.gpScroll} ref={this.scrollRef} onScroll={this.handleScroll}>
          {this.state.mode === "stickers"
            ? !embedded && this.state.stickerHeight > 0 && <StickerPanel maxHeight={this.state.stickerHeight} onSelect={this.selectSticker} />
            : sections.map((section) => (
                <div key={section.id} className={styles.gpSection} ref={this.setBlockRef(section.id)}>
                  <div className={styles.gpHead}>{section.title}</div>
                  <div className={styles.gpGrid}>
                    {section.glyphs.map((glyph) => (
                      <button
                        key={`${section.id}-${glyph}`}
                        type="button"
                        className={cx(styles.gpCell, this.state.mode === "emojis" && styles.emoji)}
                        onClick={() => this.pick(glyph)}
                      >
                        {this.state.mode === "icons" ? asText(glyph) : glyph}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
        </div>
        {embedded ? null : (
          <div className={styles.gpModes}>
            {([
              ["icons", "Icons"],
              ["emojis", "Emojis"],
              ["stickers", "Stickers"],
            ] as const).map(([mode, label]) => (
              <button key={mode} type="button" data-mode={mode} className={this.state.mode === mode ? styles.on : undefined} onClick={() => this.setMode(mode)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>,
      document.body,
    );
  }
}
