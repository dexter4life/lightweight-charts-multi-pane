import { Component, createRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { LabContext } from "../../app/context";
import { NOTE_TYPES, TEXT_TYPES } from "../../controller";
import { CYCLE_TYPES, ELLIOTT_TYPES, NO_FILL_PATTERNS, PATTERN_TYPES, RANGE_TYPES } from "../../data/pattern-types";
import { ColorPalette } from "../common/ColorPalette";
import { composeColor, parseColor, type PaletteValue } from "../common/color";
import { Icons, type IconComponent } from "../icons";
import styles from "./FloatingToolbar.module.css";
import { openFloatingToolbarMenu } from "./menuBus";

interface FloatingToolbarState {
  tick: number;
  left: number;
  top: number;
  moved: boolean;
  menuSlot: MenuSlot | null;
  openPalettes: Partial<Record<PaletteSlot, boolean>>;
}

type MenuSlot = "fsize" | "width" | "dash";
type PaletteSlot = "color" | "bg" | "bg2" | "tcol";

interface Slot {
  cx: number;
  w: number;
}

const SLOTS = {
  grip: { cx: 12, w: 24 },
  color: { cx: 43, w: 36 },
  bg: { cx: 81, w: 36 },
  bg2: { cx: 81, w: 36 },
  fsize: { cx: 81, w: 38 },
  tcol: { cx: 81, w: 36 },
  width: { cx: 96, w: 74 },
  dash: { cx: 151, w: 40 },
  gear: { cx: 189, w: 32 },
  lock: { cx: 226, w: 34 },
  trash: { cx: 265, w: 34 },
  more: { cx: 303, w: 34 },
} satisfies Record<string, Slot>;

const WIDTHS = [1, 2, 3, 4];
const FONT_SIZES = [10, 11, 12, 14, 16, 20, 24, 28, 32, 40];
const DASHES: Array<{ name: string; dash: number[] }> = [
  { name: "Solid line", dash: [] },
  { name: "Dashed line", dash: [6, 6] },
  { name: "Dotted line", dash: [2, 4] },
];

const cx = (...tokens: Array<string | false | null | undefined>) => tokens.filter(Boolean).join(" ");
type SelectedDrawing = ReturnType<FloatingToolbar["selected"]>;
type BoxOpts = { filled?: boolean; showText?: boolean; textColor?: string };
type PositionLike = { positionOptions?: Record<string, string | undefined>; projectionOptions?: Record<string, string | undefined> } | null;

type SlotConfig = {
  visible: string[];
  wide?: Partial<Record<string, number>>;
  titles: Partial<Record<keyof typeof SLOTS, string>>;
  colorIcon: IconComponent;
  colorUnderline: string;
  bgUnderline?: string;
  bg2Underline?: string;
  tcolUnderline?: string;
  fontSize?: number;
  width?: number;
  widthMixed?: boolean;
  dashStyle?: string;
  lockIcon: IconComponent;
};

const noteOpts = (drawing: unknown) =>
  (((drawing as { noteOptions?: Record<string, unknown> } | null)?.noteOptions ??
    (drawing as { signpostOptions?: Record<string, unknown> } | null)?.signpostOptions ??
    (drawing as { calloutOptions?: Record<string, unknown> } | null)?.calloutOptions ??
    (drawing as { commentOptions?: Record<string, unknown> } | null)?.commentOptions ??
    (drawing as { labelOptions?: Record<string, unknown> } | null)?.labelOptions ??
    (drawing as { arrowMarkerOptions?: Record<string, unknown> } | null)?.arrowMarkerOptions ??
    (drawing as { arrowMarkOptions?: Record<string, unknown> } | null)?.arrowMarkOptions ??
    (drawing as { flagMarkOptions?: Record<string, unknown> } | null)?.flagMarkOptions) ?? {}) as {
    fontSize?: number;
    textColor?: string;
    backgroundColor?: string;
    flagColor?: string;
    arrowColor?: string;
  };

const textOpts = (drawing: unknown) => ((drawing as { textOptions?: Record<string, unknown> } | null)?.textOptions ?? {}) as { fontSize?: number; fillBackground?: boolean; backgroundColor?: string };
const dashCss = (dash: number[] | undefined) => (!dash || !dash.length ? "solid" : dash[0] <= 2 ? "dotted" : "dashed");

export class FloatingToolbar extends Component<object, FloatingToolbarState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: FloatingToolbarState = { tick: 0, left: 0, top: 11, moved: false, menuSlot: null, openPalettes: {} };

  private rootRef = createRef<HTMLDivElement>();
  private slotRefs = new Map<string, HTMLButtonElement | HTMLSpanElement | null>();
  private unsubCtl: (() => void) | null = null;
  private drag: { dx: number; dy: number } | null = null;

  componentDidMount() {
    const { engine } = this.context;
    this.unsubCtl = engine.ctl.subscribe(this.sync);
    window.addEventListener("resize", this.place);
    document.addEventListener("mousemove", this.onDragMove);
    document.addEventListener("mouseup", this.onDragEnd);
    document.addEventListener("mousedown", this.onDocumentMouseDown, true);
    this.place();
    this.sync();
  }

  componentWillUnmount() {
    this.unsubCtl?.();
    window.removeEventListener("resize", this.place);
    document.removeEventListener("mousemove", this.onDragMove);
    document.removeEventListener("mouseup", this.onDragEnd);
    document.removeEventListener("mousedown", this.onDocumentMouseDown, true);
  }

  private selected() {
    return this.context.engine.ctl.getSelected();
  }

  private sync = () => {
    this.place();
    this.setState((state) => ({ tick: state.tick + 1 }));
  };

  private place = () => {
    if (this.state.moved) return;
    const { overlayHost } = this.context.engine;
    const hostRect = overlayHost.getBoundingClientRect();
    const left = Math.max(0, window.innerWidth / 2 - hostRect.left);
    this.setState({ left, top: 11 });
  };

  private onDragStart = (event: React.MouseEvent<HTMLSpanElement>) => {
    const root = this.rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    this.drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.preventDefault();
    event.stopPropagation();
  };

  private onDragMove = (event: MouseEvent) => {
    if (!this.drag) return;
    const hostRect = this.context.engine.overlayHost.getBoundingClientRect();
    const width = this.rootRef.current?.offsetWidth ?? 0;
    const height = this.rootRef.current?.offsetHeight ?? 0;
    const left = Math.min(Math.max(event.clientX - this.drag.dx - hostRect.left, 0), hostRect.width - width);
    const top = Math.min(Math.max(event.clientY - this.drag.dy - hostRect.top, 0), hostRect.height - height);
    this.setState({ left, top, moved: true });
  };

  private onDragEnd = () => {
    this.drag = null;
  };

  private onDocumentMouseDown = (event: MouseEvent) => {
    const target = event.target as Node;
    if (this.rootRef.current?.contains(target)) return;
    this.setState({ menuSlot: null });
  };

  private isPositionSel() {
    return /^(long|short)-position$|^projection$/.test(this.selected()?.type ?? "");
  }

  private positionOptions() {
    const selected = this.selected() as PositionLike;
    return selected?.projectionOptions ?? selected?.positionOptions ?? {};
  }

  private setSlotRef = (slot: string) => (node: HTMLButtonElement | HTMLSpanElement | null) => {
    this.slotRefs.set(slot, node);
  };

  private togglePalette(slot: PaletteSlot) {
    this.setState((state) => ({
      menuSlot: null,
      openPalettes: { ...state.openPalettes, [slot]: !state.openPalettes[slot] },
    }));
  }

  private closePalette = (slot: PaletteSlot) => {
    this.setState((state) => ({ openPalettes: { ...state.openPalettes, [slot]: false } }));
  };

  private openMenu = (slot: MenuSlot) => {
    this.setState((state) => ({ menuSlot: state.menuSlot === slot ? null : slot }));
  };

  private onMore = () => {
    const button = this.slotRefs.get("more") as HTMLElement | null;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    this.setState({ menuSlot: null });
    openFloatingToolbarMenu({ x: rect.left, y: rect.bottom + 2 });
  };

  private paletteConfig(slot: PaletteSlot): { value: PaletteValue; onChange: (value: PaletteValue) => void } | null {
    const { ctl } = this.context.engine;
    const selected = this.selected();
    if (!selected) return null;
    if (slot === "color") {
      const isMark = (selected.type ?? "").startsWith("arrow-mark-");
      const parsed = parseColor(isMark ? (noteOpts(selected).arrowColor ?? "#2962ff") : selected.style.lineColor ?? "#2962ff");
      return {
        value: { color: parsed.hex, opacity: parsed.alpha },
        onChange: (value) => (isMark ? ctl.changeSelected({ options: { arrowColor: value.color } }, "color") : ctl.updateSelectedStyle({ lineColor: value.color })),
      };
    }
    if (slot === "bg") {
      if (selected.type === "projection") return this.positionPalette("color1", "background color 1");
      if (this.isPositionSel()) return this.positionPalette("profitBackground", "profit color");
      const isText = TEXT_TYPES.has(selected.type);
      const isFlag = selected.type === "flag-mark";
      const isCallout = selected.type === "callout" || selected.type === "comment" || selected.type === "price-label" || selected.type === "arrow-marker";
      const source = isFlag
        ? noteOpts(selected).flagColor ?? "#2962FF"
        : isCallout
          ? noteOpts(selected).backgroundColor ?? (selected.type === "comment" || selected.type === "price-label" ? "#2962FF" : "rgba(0,151,167,0.7)")
          : isText
            ? textOpts(selected).backgroundColor ?? "rgba(91,133,191,0.3)"
            : selected.style.fillColor ?? "rgba(41,98,255,0.2)";
      const parsed = parseColor(source);
      return {
        value: { color: parsed.hex, opacity: parsed.alpha },
        onChange: (value) => {
          if (isFlag) ctl.changeSelected({ options: { flagColor: value.color } }, "color");
          else if (isCallout) ctl.changeSelected({ options: { backgroundColor: composeColor(value.color, value.opacity) } }, "background color");
          else if (isText) ctl.changeSelected({ options: { backgroundColor: value.color } }, "background color");
          else ctl.updateSelectedFill(value.color, value.opacity);
        },
      };
    }
    if (slot === "bg2") {
      if (selected.type === "projection") return this.positionPalette("color2", "background color 2");
      return this.positionPalette("stopBackground", "stop color");
    }
    const target = selected as unknown as {
      noteOptions?: { textColor?: string };
      calloutOptions?: { textColor?: string };
      commentOptions?: { textColor?: string };
      labelOptions?: { textColor?: string };
      arrowMarkerOptions?: { textColor?: string };
      arrowMarkOptions?: { textColor?: string };
      xabcdPatternOptions?: { textColor?: string };
      rectangleOptions?: { textColor?: string };
      shapeOptions?: { textColor?: string };
    };
    if (this.isPositionSel()) return this.positionPalette("textColor", "text color");
    const current =
      target.noteOptions?.textColor ??
      target.calloutOptions?.textColor ??
      target.commentOptions?.textColor ??
      target.labelOptions?.textColor ??
      target.arrowMarkerOptions?.textColor ??
      target.arrowMarkOptions?.textColor ??
      target.xabcdPatternOptions?.textColor ??
      target.rectangleOptions?.textColor ??
      target.shapeOptions?.textColor ??
      selected.style.lineColor ??
      "#ffffff";
    const parsed = parseColor(current);
    return {
      value: { color: parsed.hex, opacity: parsed.alpha },
      onChange: (value) => ctl.changeSelected({ options: { textColor: value.color } }, "text color"),
    };
  }

  private positionPalette(key: string, label: string) {
    const parsed = parseColor(this.positionOptions()[key] ?? "#ffffff");
    return {
      value: { color: parsed.hex, opacity: parsed.alpha },
      onChange: (value: PaletteValue) => this.context.engine.ctl.changeSelected({ options: { [key]: key === "textColor" ? value.color : composeColor(value.color, value.opacity) } }, label),
    };
  }

  private menuRows(slot: MenuSlot): Array<{ key: string; content: ReactNode; on?: boolean; run: () => void }> {
    const { ctl } = this.context.engine;
    const selected = this.selected();
    if (!selected) return [];
    if (slot === "fsize") {
      const current = Number(noteOpts(selected).fontSize ?? textOpts(selected).fontSize ?? 14);
      return FONT_SIZES.map((size) => ({ key: String(size), content: String(size), on: size === current, run: () => ctl.changeSelected({ options: { fontSize: size } }, "font size") }));
    }
    if (slot === "width") {
      return WIDTHS.map((width) => ({
        key: String(width),
        content: <><i className={styles.ftbW} style={{ height: `${width}px` }} /><span>{width}px</span></>,
        run: () => ctl.updateSelectedStyle({ lineWidth: width }),
      }));
    }
    return DASHES.map((dash) => ({
      key: dash.name,
      content: <><i className={styles.ftbD} style={{ borderTopStyle: dashCss(dash.dash) as CSSProperties["borderTopStyle"] }} /><span>{dash.name}</span></>,
      run: () => ctl.updateSelectedStyle({ lineDash: dash.dash }),
    }));
  }

  private layoutCells(order: string[], wide: Partial<Record<string, number>> = {}) {
    const positions: Partial<Record<keyof typeof SLOTS, CSSProperties>> = {};
    let x = 25;
    positions.grip = { left: `${SLOTS.grip.cx - SLOTS.grip.w / 2}px`, width: `${SLOTS.grip.w}px`, display: "" };
    const lefts = new Map<string, number>();
    order.forEach((key) => {
      lefts.set(key, x);
      x += wide[key] ?? 38;
    });
    Object.keys(SLOTS).forEach((key) => {
      if (key === "grip") return;
      const left = lefts.get(key);
      positions[key as keyof typeof SLOTS] = left === undefined ? { display: "none" } : { left: `${left}px`, width: `${wide[key] ?? 36}px`, display: "" };
    });
    return { positions, width: x - 1 };
  }

  private describeSelection(): SlotConfig | null {
    const selected = this.selected();
    if (!selected) return null;
    const style = selected.style;
    const isFib = !!((selected as unknown as { fibOptions?: { levels?: Array<{ enabled: boolean; color: string }> } }).fibOptions?.levels) && selected.type !== "fib-time-zone" && selected.type !== "fib-time-extension" && selected.type !== "fib-circles" && selected.type !== "fib-arcs" && selected.type !== "fib-wedge";
    const isBrush = selected.type === "brush";
    const isTrendTime = selected.type === "fib-time-extension" || selected.type === "fib-circles" || selected.type === "fib-arcs" || selected.type === "pitchfan" || selected.type === "fib-wedge";
    const isChannel = selected.type === "parallel-channel" || selected.type === "flat-top-bottom" || selected.type === "disjoint-channel";
    const bgOn = (isBrush && !!(selected as unknown as { brushOptions: { backgroundVisible?: boolean } }).brushOptions.backgroundVisible) || (isChannel && !!(selected as unknown as { trendLineOptions: { filled?: boolean } }).trendLineOptions.filled);
    const isHl = selected.type === "highlighter";
    const isText = TEXT_TYPES.has(selected.type);
    const isNote = NOTE_TYPES.has(selected.type);
    const textBg = isText && !!textOpts(selected).fillBackground;
    const isPattern = PATTERN_TYPES.has(selected.type);
    const isElliott = ELLIOTT_TYPES.has(selected.type);
    const isCycle = CYCLE_TYPES.has(selected.type);
    const isRange = RANGE_TYPES.has(selected.type);
    const isForecast = selected.type === "forecast";
    const isBars = selected.type === "bars-pattern";
    const isGhost = selected.type === "ghost-feed";
    const isVp = selected.type === "fixed-range-volume-profile";
    const isProj = selected.type === "projection";
    const isIcon = selected.type === "icon";
    const isEmoji = selected.type === "emoji" || selected.type === "sticker";
    const boxed = selected as unknown as { rectangleOptions?: BoxOpts; shapeOptions?: BoxOpts };
    const rect = selected.type === "path" || selected.type === "polyline" || selected.type === "curve" || selected.type === "double-curve" ? undefined : boxed.rectangleOptions ?? boxed.shapeOptions;
    const isRect = !!rect;
    const isGannSquare = selected.type === "gann-square-fixed" || selected.type === "gann-square" || selected.type === "gann-fan";
    const isPosition = this.isPositionSel();
    const isRegression = selected.type === "regression-trend";
    const titles: SlotConfig["titles"] = {
      color: isNote ? "Marker color" : isText ? "Text color" : isIcon || selected.type === "bars-pattern" ? "Line tool backgrounds" : "Line tool colors",
      bg: isText ? "Background color" : "Line tool backgrounds",
      bg2: selected.type === "projection" ? "Background color 2" : "Stop background color",
      tcol: isPosition ? "Text color" : "Line tool text colors",
      fsize: "Font size",
      width: "Line tool width",
      dash: "Style",
      gear: "Settings",
      lock: "Lock",
      trash: "Remove",
      more: "More",
      grip: "",
    };
    const lockIcon = selected.options.locked ? Icons.ftbLock : Icons.ftbLockOpen;
    const widths = { width: 69.9 };
    const po = this.positionOptions();
    const checker = "repeating-conic-gradient(#c0c3cb 0% 25%, #fff 0% 50%) 0 0 / 3px 3px";
    if (selected.type === "callout" || selected.type === "comment" || selected.type === "price-label") {
      const current = noteOpts(selected);
      return { visible: ["color", "bg", "fsize", "gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbText, colorUnderline: parseColor(current.textColor ?? "#FFFFFF").hex, bgUnderline: `linear-gradient(${current.backgroundColor},${current.backgroundColor}), ${checker}`, fontSize: current.fontSize ?? (selected.type === "comment" ? 16 : 14), lockIcon };
    }
    if (selected.type.startsWith("arrow-mark-")) {
      const mark = noteOpts(selected);
      return { visible: ["color", "tcol", "gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(mark.arrowColor ?? style.lineColor).hex, tcolUnderline: parseColor(mark.textColor ?? style.lineColor).hex, lockIcon };
    }
    if (selected.type === "flag-mark") {
      const flag = noteOpts(selected);
      return { visible: ["bg", "gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbBucket, colorUnderline: parseColor(flag.flagColor ?? "#2962FF").hex, bgUnderline: parseColor(flag.flagColor ?? "#2962FF").hex, lockIcon };
    }
    if (selected.type === "arrow-marker") {
      const marker = noteOpts(selected);
      return { visible: ["bg", "tcol", "gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbBucket, colorUnderline: parseColor(marker.backgroundColor ?? "#1E53E5").hex, bgUnderline: marker.backgroundColor ?? "#1E53E5", tcolUnderline: parseColor(marker.textColor ?? "#1E53E5").hex, lockIcon };
    }
    if (selected.type === "price-note") return { visible: ["gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, lockIcon };
    if (selected.type === "signpost") return { visible: ["fsize", "gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, fontSize: noteOpts(selected).fontSize ?? 12, lockIcon };
    if (isNote) return { visible: ["color", "tcol", "fsize", "gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, tcolUnderline: parseColor(noteOpts(selected).textColor ?? "#FFFFFF").hex, fontSize: noteOpts(selected).fontSize ?? 14, lockIcon };
    if (isEmoji) return { visible: ["gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, lockIcon };
    if (isRegression) return { visible: ["width", "gear", "lock", "trash", "more"], wide: widths, titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, width: style.lineWidth, widthMixed: new Set(Object.values(((selected as unknown as { regressionOptions?: { upWidth?: number; downWidth?: number; baseWidth?: number } }).regressionOptions ?? {}))).size > 1, lockIcon };
    if (isIcon || selected.type === "fib-channel") return { visible: ["color", "gear", "lock", "trash", "more"], titles, colorIcon: isIcon ? Icons.ftbBucket : Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, lockIcon };
    if (selected.type === "polyline" || selected.type === "curve" || selected.type === "double-curve") {
      const withBg = selected.type === "polyline" || !!(selected as unknown as { shapeOptions: { filled?: boolean } }).shapeOptions.filled;
      return { visible: ["color", ...(withBg ? ["bg"] : []), "width", "dash", "gear", "lock", "trash", "more"], wide: widths, titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, bgUnderline: withBg ? `linear-gradient(${style.fillColor},${style.fillColor}), ${checker}` : undefined, width: style.lineWidth, dashStyle: dashCss(style.lineDash), lockIcon };
    }
    if (isRect) {
      return { visible: ["color", ...(rect!.filled ? ["bg"] : []), ...(rect!.showText ? ["tcol"] : []), "width", "gear", "lock", "trash", "more"], wide: widths, titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, bgUnderline: rect!.filled ? `linear-gradient(${style.fillColor},${style.fillColor}), ${checker}` : undefined, tcolUnderline: parseColor(rect!.textColor ?? style.lineColor).hex, width: style.lineWidth, lockIcon };
    }
    if (isGannSquare || isElliott || isForecast) return { visible: ["color", "width", "gear", "lock", "trash", "more"], wide: widths, titles, colorIcon: Icons.ftbPencil, colorUnderline: this.uniformColor(selected), width: style.lineWidth, lockIcon };
    if (isBars) return { visible: ["color", "gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbBucket, colorUnderline: parseColor(style.lineColor).hex, lockIcon };
    if (isGhost || isVp) return { visible: ["gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, lockIcon };
    if (isProj) return { visible: ["bg", "bg2", "width", "gear", "lock", "trash", "more"], wide: widths, titles, colorIcon: Icons.ftbBucket, colorUnderline: parseColor(style.lineColor).hex, bgUnderline: `linear-gradient(${po.color1},${po.color1}), ${checker}`, bg2Underline: `linear-gradient(${po.color2},${po.color2}), ${checker}`, width: style.lineWidth, lockIcon };
    if (isRange) return { visible: ["color", "bg", "width", "gear", "lock", "trash", "more"], wide: widths, titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, bgUnderline: `linear-gradient(${style.fillColor},${style.fillColor}), ${checker}`, width: style.lineWidth, lockIcon };
    if (isCycle) {
      const withBg = selected.type === "time-cycles" && (selected as unknown as { cycleOptions: { fillBackground?: boolean } }).cycleOptions.fillBackground !== false;
      return { visible: ["color", ...(withBg ? ["bg"] : []), "width", "dash", "gear", "lock", "trash", "more"], wide: widths, titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, bgUnderline: withBg ? `linear-gradient(${style.fillColor},${style.fillColor}), ${checker}` : undefined, width: style.lineWidth, dashStyle: dashCss(style.lineDash), lockIcon };
    }
    if (isPosition) return { visible: ["tcol", "bg", "bg2", "gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbText, colorUnderline: parseColor(po.textColor ?? "#ffffff").hex, bgUnderline: parseColor(po.profitBackground ?? "#089981").hex, bg2Underline: parseColor(po.stopBackground ?? "#f23645").hex, tcolUnderline: parseColor(po.textColor ?? "#ffffff").hex, lockIcon };
    if (isPattern) {
      const pattern = (selected as unknown as { xabcdPatternOptions: { textColor?: string } }).xabcdPatternOptions;
      return { visible: ["color", ...(NO_FILL_PATTERNS.has(selected.type) ? [] : ["bg"]), "tcol", "width", "gear", "lock", "trash", "more"], wide: widths, titles, colorIcon: Icons.ftbPencil, colorUnderline: parseColor(style.lineColor).hex, bgUnderline: NO_FILL_PATTERNS.has(selected.type) ? undefined : parseColor(style.fillColor ?? "#2962ff").hex, tcolUnderline: parseColor(pattern.textColor ?? "#ffffff").hex, width: style.lineWidth, lockIcon };
    }
    if (isText) return { visible: ["color", ...(textBg ? ["bg"] : []), "fsize", "gear", "lock", "trash", "more"], titles, colorIcon: Icons.ftbText, colorUnderline: parseColor(style.lineColor).hex, bgUnderline: textBg ? parseColor(textOpts(selected).backgroundColor ?? "#5b85bf").hex : undefined, fontSize: textOpts(selected).fontSize ?? 14, lockIcon };
    return { visible: ["color", ...(bgOn ? ["bg"] : []), "width", ...(isFib || isBrush || isTrendTime ? [] : ["dash"]), "gear", "lock", "trash", "more"], wide: widths, titles, colorIcon: isHl ? Icons.ftbBucket : Icons.ftbPencil, colorUnderline: this.uniformColor(selected), bgUnderline: bgOn ? (isChannel ? `linear-gradient(${style.fillColor},${style.fillColor}), ${checker}` : parseColor(style.fillColor ?? "#2962ff").hex) : undefined, width: style.lineWidth, dashStyle: isFib || isBrush || isTrendTime ? undefined : dashCss(style.lineDash), lockIcon };
  }

  private uniformColor(selected: NonNullable<SelectedDrawing>) {
    const fibLevels = (selected as unknown as { fibOptions?: { levels?: Array<{ enabled: boolean; color: string }> } }).fibOptions?.levels;
    const gann = selected.type === "gann-square-fixed" || selected.type === "gann-square" || selected.type === "gann-fan"
      ? (selected as unknown as { gannOptions: Record<string, Array<{ visible: boolean; color: string }>> }).gannOptions
      : null;
    const colors = gann
      ? [gann.levels, gann.fanlines, gann.arcs].flatMap((list) => (list ?? []).filter((item) => item.visible).map((item) => item.color))
      : fibLevels
        ? [selected.style.lineColor, ...fibLevels.filter((level) => level.enabled).map((level) => level.color)]
        : [selected.style.lineColor];
    return colors.every((color) => color === colors[0]) ? colors[0] : "linear-gradient(90deg,#f23645,#ff9800,#4caf50,#089981,#2962ff,#9c27b0)";
  }

  private slotStyles(config: SlotConfig) {
    return this.layoutCells(config.visible, config.wide ?? {});
  }

  private renderPalette(slot: PaletteSlot) {
    if (!this.state.openPalettes[slot]) return null;
    const anchor = this.slotRefs.get(slot) as HTMLElement | null;
    const config = this.paletteConfig(slot);
    if (!anchor || !config) return null;
    return <ColorPalette anchor={anchor} value={config.value} onChange={config.onChange} onClose={() => this.closePalette(slot)} />;
  }

  render() {
    const { ctl } = this.context.engine;
    const selected = this.selected();
    if (!selected) return null;
    const show = ctl.freshId !== selected.id;
    const config = this.describeSelection();
    if (!config) return null;
    const ColorIcon = config.colorIcon;
    const LockIcon = config.lockIcon;
    const layout = this.slotStyles(config);
    const menuRows = this.state.menuSlot ? this.menuRows(this.state.menuSlot) : [];
    const menuAnchor = this.state.menuSlot ? (this.slotRefs.get(this.state.menuSlot) as HTMLElement | null) : null;
    const menuLeft = this.state.menuSlot === "fsize" ? menuAnchor?.offsetLeft ?? 0 : this.state.menuSlot ? SLOTS[this.state.menuSlot].cx - 60 : 0;
    return (
      <>
        <div
          ref={this.rootRef}
          className={cx(styles.ftb, show && styles.on)}
          style={{ left: this.state.left, top: this.state.top, ["--ftb-w" as string]: `${layout.width}px` }}
        >
          <span ref={this.setSlotRef("grip")} className={cx(styles.slot, styles.ftbGrip)} data-slot="grip" style={layout.positions.grip} onMouseDown={this.onDragStart}>
            <Icons.ftbGrip />
          </span>
          <button ref={this.setSlotRef("color")} className={cx(styles.slot, styles.ftbBtn)} data-slot="color" style={layout.positions.color} title={config.titles.color} onClick={() => this.togglePalette("color")}>
            <ColorIcon className={styles.ftbPen} />
            <i className={styles.ftbUl} style={{ background: config.colorUnderline }} />
          </button>
          <button ref={this.setSlotRef("bg")} className={cx(styles.slot, styles.ftbBtn)} data-slot="bg" style={layout.positions.bg} title={config.titles.bg} onClick={() => this.togglePalette("bg")}>
            <Icons.ftbBucket className={styles.ftbPen} />
            <i className={styles.ftbUl} style={{ background: config.bgUnderline }} />
          </button>
          <button ref={this.setSlotRef("bg2")} className={cx(styles.slot, styles.ftbBtn)} data-slot="bg2" style={layout.positions.bg2} title={config.titles.bg2} onClick={() => this.togglePalette("bg2")}>
            <Icons.ftbBucket className={styles.ftbPen} />
            <i className={styles.ftbUl} style={{ background: config.bg2Underline }} />
          </button>
          <button ref={this.setSlotRef("tcol")} className={cx(styles.slot, styles.ftbBtn)} data-slot="tcol" style={layout.positions.tcol} title={config.titles.tcol} onClick={() => this.togglePalette("tcol")}>
            <Icons.ftbText className={styles.ftbPen} />
            <i className={styles.ftbUl} style={{ background: config.tcolUnderline }} />
          </button>
          <button ref={this.setSlotRef("fsize")} className={cx(styles.slot, styles.ftbBtn)} data-slot="fsize" style={layout.positions.fsize} title={config.titles.fsize} onClick={() => this.openMenu("fsize")}>
            <span className={styles.ftbFs}>{config.fontSize}</span>
          </button>
          <button ref={this.setSlotRef("width")} className={cx(styles.slot, styles.ftbBtn, styles.widthSlot, config.widthMixed && styles.mixed)} data-slot="width" style={layout.positions.width} title={config.titles.width} onClick={() => this.openMenu("width")}>
            <i className={styles.ftbW} style={{ height: `${config.width ?? selected.style.lineWidth}px` }} />
            <span className={styles.ftbWt}>{config.width ?? selected.style.lineWidth}px</span>
          </button>
          <button ref={this.setSlotRef("dash")} className={cx(styles.slot, styles.ftbBtn)} data-slot="dash" style={layout.positions.dash} title={config.titles.dash} onClick={() => this.openMenu("dash")}>
            <i className={styles.ftbD} style={{ borderTopStyle: config.dashStyle as CSSProperties["borderTopStyle"] }} />
          </button>
          <button ref={this.setSlotRef("gear")} className={cx(styles.slot, styles.ftbBtn)} data-slot="gear" style={layout.positions.gear} title={config.titles.gear} onClick={() => { this.setState({ menuSlot: null }); ctl.openSettings(); }}>
            <Icons.ftbGear />
          </button>
          <button ref={this.setSlotRef("lock")} className={cx(styles.slot, styles.ftbBtn)} data-slot="lock" style={layout.positions.lock} title={config.titles.lock} onClick={() => ctl.toggleSelectedLock()}>
            <LockIcon />
          </button>
          <button ref={this.setSlotRef("trash")} className={cx(styles.slot, styles.ftbBtn)} data-slot="trash" style={layout.positions.trash} title={config.titles.trash} onClick={() => ctl.removeSelected()}>
            <Icons.ftbTrash />
          </button>
          <button ref={this.setSlotRef("more")} className={cx(styles.slot, styles.ftbBtn)} data-slot="more" style={layout.positions.more} title={config.titles.more} onClick={this.onMore}>
            <Icons.ftbMore />
          </button>
          {this.state.menuSlot ? (
            <div className={cx(styles.ftbMenu, styles.menuOpen, this.state.menuSlot === "fsize" && styles.sizes)} style={{ left: menuLeft }}>
              {menuRows.map((row) => (
                <button
                  key={row.key}
                  className={row.on ? styles.on : undefined}
                  onClick={() => {
                    row.run();
                    this.setState({ menuSlot: null });
                  }}
                >
                  {row.content}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {this.renderPalette("color")}
        {this.renderPalette("bg")}
        {this.renderPalette("bg2")}
        {this.renderPalette("tcol")}
      </>
    );
  }
}
