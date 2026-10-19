import { Component, createRef, type CSSProperties, type ReactNode } from "react";
import { DrawingTools } from "lightweight-charts-multi-pane";
import { LabContext } from "../../app/context";
import { makeDraggable } from "../common/draggable";
import {
  CYCLE_DEFAULT_STYLE,
  CYCLE_TITLES,
  CYCLE_TYPES,
  ELLIOTT_DEFAULT_STYLE,
  ELLIOTT_DEGREES,
  ELLIOTT_TITLES,
  ELLIOTT_TYPES,
  FORECAST_DEFAULT_OPTIONS,
  NO_FILL_PATTERNS,
  PATTERN_DEFAULT_STYLE,
  PATTERN_TITLES,
  PATTERN_TYPES,
  RANGE_DEFAULT_OPTIONS,
  RANGE_DEFAULT_STYLE,
  RANGE_TITLES,
  RANGE_TYPES,
} from "../../data/pattern-types";
import { NOTE_TYPES, TEXT_TYPES, TYPE_STYLE, type DrawingController } from "../../controller";
import { CommonIcons } from "../icons";
import { DialogFrame } from "./object-settings/DialogFrame";
import {
  ANGLE_STATS,
  ANGLE_TABS,
  ARROW_MARK_TITLES,
  BRUSH_TABS,
  CALLOUT_TABS,
  CHECKER,
  CHECKS,
  CURVES,
  DASH_VALUES,
  DEFAULT_OPTIONS,
  DEFAULT_VARIANTS,
  EMOJI_TABS,
  FIB_LEVEL_MODES,
  FIB_SIZES,
  FIB_TABS,
  FIB_THICKNESS,
  FRVP_DEFAULTS,
  H_ALIGN,
  heightOf,
  ICON,
  ICON_TABS,
  LABEL_TABS,
  LINE_FAMILY,
  LINE_SHAPES,
  NOTE_TABS,
  NO_COORD_SHAPES,
  NO_COORD_SHAPE_TABS,
  NO_TEXT_SHAPES,
  ORIENT,
  PITCHFORK_STYLES,
  PITCHFORKS,
  PIN_TABS,
  POSITION_TABS,
  RANGE_TABS,
  REGRESSION_SOURCE_ITEMS,
  REGRESSION_TABS,
  RIGHT_ENDS,
  LEFT_ENDS,
  RISK_MODES,
  SHAPE_TITLES,
  SHAPE_V_ALIGN,
  SIZES,
  STATS,
  STATS_POS,
  STYLE_ONLY_SHAPES,
  swatch,
  Tab,
  TEXT_TABS,
  TREND_TABS,
  UNITS,
  V_ALIGN,
  WEDGE_TABS,
  widthOf,
} from "./object-settings/constants";
import {
  Checkbox,
  ColorButton,
  composeColor,
  DashButton,
  DialogRow,
  EndButton,
  GlyphButton,
  NumberInput,
  OpacitySlider,
  parseColor,
  PopupButton,
  SectionLabel,
  Select,
  SimpleColorButton,
  ThicknessButton,
  ToggleButton,
  VisibilitySlider,
} from "./object-settings/controls";
import styles from "./object-settings/ObjectSettingsDialog.module.css";

type Opts = Record<string, unknown>;
type AnchorState = { time: unknown; price: number };
type DrawingStyleState = { lineColor: string; lineWidth: number; lineDash?: number[]; fillColor?: string };

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");
const bgColorButtonClass = cx(styles.sdBtn, styles.sdCol, styles.sdBgsw);
const textColorButtonClass = cx(styles.sdBtn, styles.sdIco, styles.sdTcol);
const boldButtonClass = cx(styles.sdBtn, styles.sdIco, styles.sdB);
const italicButtonClass = cx(styles.sdBtn, styles.sdIco, styles.sdI);
const oneColorButtonClass = cx(styles.sdBtn, styles.sdOne);

type SelectedDrawing = DrawingTools.IDrawing & {
  type: string;
  style: DrawingStyleState;
  anchors: AnchorState[];
  trendLineOptions?: Opts;
  fibOptions?: Opts;
  pitchforkOptions?: Opts;
  brushOptions?: Opts;
  highlighterOptions?: Opts;
  textOptions?: Opts;
  noteOptions?: Opts;
  signpostOptions?: Opts;
  calloutOptions?: Opts;
  commentOptions?: Opts;
  labelOptions?: Opts;
  priceNoteOptions?: Opts;
  arrowMarkerOptions?: Opts;
  arrowMarkOptions?: Opts;
  flagMarkOptions?: Opts;
  xabcdPatternOptions?: Opts;
  waveOptions?: Opts;
  cycleOptions?: Opts;
  rangeOptions?: Opts;
  positionOptions?: Opts;
  gannOptions?: Opts;
  glyphOptions?: Opts;
  rectangleOptions?: Opts;
  shapeOptions?: Opts;
  forecastOptions?: Opts;
  barsPatternOptions?: Opts;
  ghostFeedOptions?: Opts;
  projectionOptions?: Opts;
  fixedRangeVolumeProfileOptions?: Opts;
  setTrendLineOptions?(o: Opts): void;
  setRectangleOptions?(o: Opts): void;
  setShapeOptions?(o: Opts): void;
  setPriceNoteOptions?(o: Opts): void;
  setArrowMarkerOptions?(o: Opts): void;
  setArrowMarkOptions?(o: Opts): void;
  setRangeOptions?(o: Opts): void;
  verticalPercent?(viewport: unknown): number;
  setVerticalPercent?(percent: number, viewport: unknown): void;
  getViewport?(): unknown;
  levelPrices?(): { entry: number; profit: number; stop: number };
  setLevelPrice?(which: "entry" | "profit" | "stop", price: number): void;
  formatPrice?(value: number): string;
};

interface DialogMeta {
  selType: string;
  fc: boolean;
  fib: boolean;
  pf: boolean;
  tt: boolean;
  fcir: boolean;
  fa: boolean;
  wd: boolean;
  rc: boolean;
  sh: boolean;
  tz: boolean;
  gf: boolean;
  gsq: boolean;
  ff: boolean;
  gb: boolean;
  gsf: boolean;
  brush: boolean;
  hl: boolean;
  txt: boolean;
  nt: boolean;
  sg: boolean;
  cm: boolean;
  pl: boolean;
  pn: boolean;
  am: boolean;
  ak: boolean;
  fk: boolean;
  co: boolean;
  xp: boolean;
  xnf: boolean;
  el: boolean;
  cy: boolean;
  rg: boolean;
  fcs: boolean;
  bp: boolean;
  gh: boolean;
  pj: boolean;
  fv: boolean;
  tcy: boolean;
  lp: boolean;
  ic: boolean;
  em: boolean;
  ang: boolean;
  hz: boolean;
  hzPriceOnly: boolean;
  vl: boolean;
  cl: boolean;
  dj: boolean;
  ft: boolean;
  pc: boolean;
  rt: boolean;
  sp: boolean;
  family?: { title: string; options?: Opts };
  tabs: Tab[];
  title: string;
  dialogClassName: string;
}

interface ObjectSettingsDialogProps {
  id: string;
  onClose(): void;
}

interface ObjectSettingsDialogState {
  ready: boolean;
  tab: Tab;
  style: DrawingStyleState;
  options: Opts;
  anchors: AnchorState[];
  positionVersion: number;
  dialogStyle: CSSProperties;
}

let lastTab: Tab = "Style";
let tabTouched = false;

export class ObjectSettingsDialog extends Component<ObjectSettingsDialogProps, ObjectSettingsDialogState> {
  static contextType = LabContext;
  declare context: React.ContextType<typeof LabContext>;

  state: ObjectSettingsDialogState = {
    ready: false,
    tab: "Style",
    style: { lineColor: "#2962FF", lineWidth: 1, lineDash: [] },
    options: {},
    anchors: [],
    positionVersion: 0,
    dialogStyle: {},
  };

  private meta: DialogMeta | null = null;
  private token: { id: string; depth: number; defaults: string } | null = null;
  private dialogNode: HTMLDivElement | null = null;
  private dragCleanup: (() => void) | null = null;
  private closed = false;
  private textBefore = "";
  private rangeTextBefore = "";
  private firstFieldRef = createRef<HTMLInputElement>();

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyDown, true);
    this.initialize();
  }

  componentDidUpdate(prevProps: ObjectSettingsDialogProps, prevState: ObjectSettingsDialogState) {
    if (prevProps.id !== this.props.id) {
      this.cleanup(true);
      this.closed = false;
      this.initialize();
      return;
    }
    if (!prevState.ready && this.state.ready && this.dialogNode) {
      this.dragCleanup?.();
      this.dragCleanup = makeDraggable(this.dialogNode, "[data-drag-handle]");
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.cleanup(true);
    this.dragCleanup?.();
  }

  private controller() {
    return this.context.engine.ctl;
  }

  private selected() {
    const sel = this.controller().getSelected() as SelectedDrawing | null;
    return sel && sel.id === this.props.id ? sel : null;
  }

  private optionsFor(meta: DialogMeta, drawing: SelectedDrawing): Opts {
    const source = meta.fv
      ? drawing.fixedRangeVolumeProfileOptions
      : meta.pj
        ? drawing.projectionOptions
        : meta.gh
          ? drawing.ghostFeedOptions
          : meta.bp
            ? drawing.barsPatternOptions
            : meta.fcs
              ? drawing.forecastOptions
              : meta.rg
                ? drawing.rangeOptions
                : meta.ic || meta.em
                  ? drawing.glyphOptions
                  : meta.rc
                    ? drawing.rectangleOptions
                    : meta.sh
                      ? drawing.shapeOptions
                      : meta.fib || meta.tz || meta.ff || meta.sp
                        ? drawing.fibOptions
                        : meta.gb || meta.gf
                          ? drawing.gannOptions
                          : meta.pf
                            ? drawing.pitchforkOptions
                            : meta.brush
                              ? drawing.brushOptions
                              : meta.hl
                                ? drawing.highlighterOptions
                                : meta.txt
                                  ? drawing.textOptions
                                  : meta.pl
                                    ? drawing.labelOptions
                                    : meta.pn
                                      ? drawing.priceNoteOptions
                                      : meta.am
                                        ? drawing.arrowMarkerOptions
                                        : meta.ak
                                          ? drawing.arrowMarkOptions
                                          : meta.fk
                                            ? drawing.flagMarkOptions
                                            : meta.sg
                                              ? drawing.signpostOptions
                                              : meta.cm
                                                ? drawing.commentOptions
                                                : meta.co
                                                  ? drawing.calloutOptions
                                                  : meta.nt
                                                    ? drawing.noteOptions
                                                    : meta.xp
                                                      ? drawing.xabcdPatternOptions
                                                      : meta.el
                                                        ? drawing.waveOptions
                                                        : meta.cy
                                                          ? drawing.cycleOptions
                                                          : meta.lp
                                                            ? drawing.positionOptions
                                                            : drawing.trendLineOptions;
    return { ...(source ?? {}) };
  }

  private buildMeta(sel: SelectedDrawing): DialogMeta | null {
    const type = sel.type;
    const family = LINE_FAMILY[type];
    const fc = type === "fib-channel";
    const fib = type === "fib-retracement" || type === "fib-extension" || fc;
    const pf = type in PITCHFORKS;
    const tt = type === "fib-time-extension";
    const fcir = type === "fib-circles";
    const fa = type === "fib-arcs";
    const wd = type === "fib-wedge";
    const rc = type === "rectangle";
    const sh = type in SHAPE_TITLES;
    const tz = type === "fib-time-zone" || tt || fcir || fa || wd;
    const gf = type === "gann-fan";
    const gsq = type === "gann-square";
    const ff = type === "fib-speed-fan";
    const gb = type === "gann-box" || type === "gann-square-fixed" || gsq || ff;
    const gsf = type === "gann-square-fixed" || gsq;
    const brush = type === "brush";
    const hl = type === "highlighter";
    const txt = TEXT_TYPES.has(type);
    const nt = NOTE_TYPES.has(type);
    const sg = type === "signpost";
    const cm = type === "comment";
    const pl = type === "price-label";
    const pn = type === "price-note";
    const am = type === "arrow-marker";
    const ak = type.startsWith("arrow-mark-");
    const fk = type === "flag-mark";
    const co = type === "callout" || cm;
    const xp = PATTERN_TYPES.has(type);
    const xnf = NO_FILL_PATTERNS.has(type);
    const el = ELLIOTT_TYPES.has(type);
    const cy = CYCLE_TYPES.has(type);
    const rg = RANGE_TYPES.has(type);
    const fcs = type === "forecast";
    const bp = type === "bars-pattern";
    const gh = type === "ghost-feed";
    const pj = type === "projection";
    const fv = type === "fixed-range-volume-profile";
    const tcy = type === "time-cycles";
    const lp = type === "long-position" || type === "short-position";
    const ic = type === "icon";
    const em = type === "emoji" || type === "sticker";
    const ang = type === "trend-angle";
    const hz = type === "horizontal-line" || type === "horizontal-ray";
    const hzPriceOnly = type === "horizontal-line";
    const vl = type === "vertical-line";
    const cl = type === "cross-line";
    const dj = type === "disjoint-channel";
    const ft = type === "flat-top-bottom" || dj;
    const pc = type === "parallel-channel" || ft;
    const rt = type === "regression-trend";
    const sp = type === "fib-spiral";
    if (!family && !fib && !pf && !tz && !gb && !gf && !brush && !hl && !txt && !nt && !sg && !co && !pl && !pn && !am && !ak && !fk && !xp && !el && !cy && !rg && !fcs && !bp && !gh && !pj && !fv && !lp && !ic && !em && !sp && !rc && !sh) return null;
    const tabs = fv ? REGRESSION_TABS : pj ? BRUSH_TABS : gh ? REGRESSION_TABS : bp ? BRUSH_TABS : fcs ? FIB_TABS : rg ? RANGE_TABS : pl || fk ? LABEL_TABS : co ? CALLOUT_TABS : sg ? NOTE_TABS : nt ? (type === "pin" ? PIN_TABS : NOTE_TABS) : em ? EMOJI_TABS : ic ? ICON_TABS : lp ? POSITION_TABS : rt ? REGRESSION_TABS : ang || cl ? ANGLE_TABS : wd ? WEDGE_TABS : fib || xp || el || cy || pf || tz || gb || gf || sp ? FIB_TABS : txt ? TEXT_TABS : brush || hl || pc ? BRUSH_TABS : sh && STYLE_ONLY_SHAPES.has(type) ? BRUSH_TABS : sh && NO_COORD_SHAPES.has(type) ? NO_COORD_SHAPE_TABS : sh && NO_TEXT_SHAPES.has(type) ? ANGLE_TABS : TREND_TABS;
    const title = fv ? "VPFR" : pj ? "Projection" : gh ? "Ghost Feed" : bp ? "Bars Pattern" : fcs ? "Forecast" : rg ? RANGE_TITLES[type] : em ? (type === "sticker" ? "Sticker" : "Emoji") : ic ? "Icon" : pf ? PITCHFORKS[type] : ff ? "Fib Speed Resistance Fan" : gf ? "Gann Fan" : sp ? "Fib Spiral" : wd ? "Fib Wedge" : fa ? "Fib Speed Resistance Arcs" : fcir ? "Fib Circles" : tt ? "Trend-Based Fib Time" : tz ? "Fib Time Zone" : gsf ? (gsq ? "Gann Square" : "Gann Square Fixed") : gb ? "Gann Box" : fib ? (type === "fib-extension" ? "Trend-Based Fib Extension" : fc ? "Fib Channel" : "Fib Retracement") : lp ? (type === "long-position" ? "Long Position" : "Short Position") : xp ? PATTERN_TITLES[type] : el ? ELLIOTT_TITLES[type] : cy ? CYCLE_TITLES[type] : rc ? "Rectangle" : sh ? SHAPE_TITLES[type] : brush ? "Brush" : hl ? "Highlighter" : sg ? "Signpost" : pl ? "Price Label" : pn ? "Price Note" : am ? "Arrow Marker" : ak ? ARROW_MARK_TITLES[type] : fk ? "Flag Mark" : co ? (cm ? "Comment" : "Callout") : nt ? (type === "pin" ? "Anchored Note" : "Note") : txt ? (type === "anchored-text" ? "Anchored Text" : "Text") : family?.title ?? type;
    const classes = cx(
      styles.sd,
      (pc || rt || fc || CURVES.has(type)) && styles.sdPc,
      fc && styles.sdFc,
      (pf || tz || gf) && styles.sdPf,
      gf && styles.sdGf,
      (tt || fcir || fa || wd) && styles.sdTt,
      gb && styles.sdGb,
      gsf && styles.sdGsf,
      rt && styles.sdReg,
    );
    return { selType: type, fc, fib, pf, tt, fcir, fa, wd, rc, sh, tz, gf, gsq, ff, gb, gsf, brush, hl, txt, nt, sg, cm, pl, pn, am, ak, fk, co, xp, xnf, el, cy, rg, fcs, bp, gh, pj, fv, tcy, lp, ic, em, ang, hz, hzPriceOnly, vl, cl, dj, ft, pc, rt, sp, family, tabs, title, dialogClassName: classes };
  }

  private initialize() {
    const sel = this.selected();
    if (!sel) {
      this.props.onClose();
      return;
    }
    const meta = this.buildMeta(sel);
    if (!meta) {
      this.props.onClose();
      return;
    }
    this.meta = meta;
    this.token = this.controller().beginEdit();
    const tab = (!meta.tabs.includes(lastTab) || ((meta.lp || meta.gh || meta.fv) && !tabTouched)) ? meta.tabs[0] : lastTab;
    const options = this.optionsFor(meta, sel);
    const style = { ...sel.style };
    const anchors = sel.anchors.map((anchor) => ({ ...anchor }));
    this.textBefore = String(options.text ?? "");
    this.rangeTextBefore = String(((options.customText as Opts | undefined)?.text) ?? "");
    this.setState({ ready: true, tab, options, style, anchors, dialogStyle: this.computeDialogStyle(tab, meta, anchors.length), positionVersion: 0 });
  }

  private computeDialogStyle(tab: Tab, meta: DialogMeta, anchorCount = this.state.anchors.length): CSSProperties {
    const height = meta.fv
      ? (tab === "Visibility" ? 450 : tab === "Coordinates" ? 313 : tab === "Inputs" ? 400 : 784)
      : meta.pj
        ? (tab === "Visibility" ? 450 : 313)
        : meta.gh
          ? (tab === "Visibility" ? 450 : tab === "Coordinates" ? 200 + 50 * anchorCount : tab === "Inputs" ? 313 : 400)
          : meta.bp
            ? (tab === "Style" ? 400 : 450)
            : meta.fcs
              ? (tab === "Style" ? 750 : tab === "Visibility" ? 450 : 313)
              : meta.rg
                ? (tab === "Style" ? (meta.selType === "date-price-range" ? 450 : 500) : tab === "Text" ? 381 : tab === "Visibility" ? 450 : 313)
                : meta.cy && tab !== "Visibility"
                  ? 313
                  : meta.el && tab === "Style"
                    ? 350
                    : (meta.xp || meta.el) && tab === "Coordinates"
                      ? 200 + 50 * anchorCount
                      : meta.gf && tab === "Style"
                        ? 798
                        : tab === "Coordinates" && !meta.xp && anchorCount === 3
                          ? 350
                          : tab === "Coordinates" && !meta.xp && anchorCount === 4
                            ? 400
                            : heightOf(tab, meta.brush || meta.hl, meta.txt, meta.xp || meta.el, meta.lp, meta.ic, meta.ang, meta.hz || meta.sp, meta.vl, meta.cl, meta.pc, meta.rt, meta.rc || CURVES.has(meta.selType), meta.sh, meta.nt, meta.sg || meta.am || meta.ak || meta.fk, meta.co, meta.cm, meta.pl, meta.pn);
    const width = meta.fv || meta.pj || meta.gh || meta.bp || meta.fcs || meta.rg ? (tab === "Visibility" ? 454.3 : 380) : widthOf(tab, meta.fib || meta.gb, meta.vl, meta.ft || (meta.xp && !meta.xnf), meta.sg, meta.pn);
    return {
      "--h": `${height}px`,
      "--w": `${width}px`,
      left: `${Math.max(0, (window.innerWidth - widthOf(tab, meta.fib || meta.gb, false, meta.ft || (meta.xp && !meta.xnf))) / 2)}px`,
      top: `${Math.max(20, (window.innerHeight - Math.min(height, window.innerHeight - 40)) / 2)}px`,
    } as CSSProperties;
  }

  private setDialogRef = (node: HTMLDivElement | null) => {
    this.dialogNode = node;
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    this.finish(true);
  };

  private finish(apply: boolean) {
    this.cleanup(apply);
    this.props.onClose();
  }

  private cleanup(apply: boolean) {
    if (this.closed) return;
    this.closed = true;
    if (!apply && this.token) this.controller().cancelEdit(this.token);
    this.controller().endFresh(this.props.id);
  }

  private currentOption<T>(key: string, fallback: T): T {
    return (this.state.options[key] as T | undefined) ?? fallback;
  }

  private patchOptions(patch: Opts, undo: string) {
    this.setState((state) => ({ options: { ...state.options, ...patch } }));
    this.controller().changeSelected({ options: patch }, undo);
  }

  private patchStyle(patch: Partial<DrawingStyleState>, undo: string) {
    this.setState((state) => ({ style: { ...state.style, ...patch } }));
    this.controller().changeSelected({ style: patch }, undo);
  }

  private patchAnchors(next: AnchorState[], undo: string) {
    this.setState({ anchors: next, dialogStyle: this.meta ? this.computeDialogStyle(this.state.tab, this.meta, next.length) : this.state.dialogStyle });
    this.controller().setSelectedAnchors(next as never, undo);
  }

  private replaceAll(options: Opts, style: Partial<DrawingStyleState>, undo: string) {
    this.setState((state) => ({ options: { ...state.options, ...options }, style: { ...state.style, ...style } }));
    this.controller().changeSelected({ options, style }, undo);
  }

  private livePreviewText(text: string) {
    const target = this.selected();
    (target?.setTrendLineOptions ?? target?.setRectangleOptions ?? target?.setShapeOptions ?? target?.setPriceNoteOptions ?? target?.setArrowMarkerOptions ?? target?.setArrowMarkOptions)?.call(target, { text });
  }

  private livePreviewRangeText(text: string) {
    const target = this.selected();
    const current = (this.state.options.customText as Opts | undefined) ?? {};
    target?.setRangeOptions?.({ customText: { ...current, text } });
  }

  private barIndex(time: unknown): number {
    const idx = this.controller().chartApi.timeScale().timeToIndex(time as never, true);
    return idx === null ? 0 : Number(idx) + 1;
  }

  private timeAt(barNo: number, fallback: unknown): unknown {
    const point = this.controller().seriesApi.dataByIndex(barNo - 1, 1) as { time?: unknown } | null;
    return point?.time ?? fallback;
  }

  private anglePixels() {
    const ts = this.controller().chartApi.timeScale();
    const pts = this.state.anchors.map((anchor) => ({ x: ts.timeToCoordinate(anchor.time as never), y: this.controller().seriesApi.priceToCoordinate(anchor.price) }));
    return pts.every((point) => point.x !== null && point.y !== null) ? (pts as Array<{ x: number; y: number }>) : null;
  }

  private setTab = (tab: Tab) => {
    if (!this.meta) return;
    lastTab = tab;
    tabTouched = true;
    this.setState({ tab, dialogStyle: this.computeDialogStyle(tab, this.meta) });
  };

  private showTemplate = () => {
    if (!this.meta) return;
    const type = this.meta.selType;
    const patch = this.meta.ic || this.meta.em
      ? { options: { size: 40, angle: Math.PI / 2 }, style: this.meta.ic ? { lineColor: "#2962FF" } : {} }
      : this.meta.sh
        ? { options: { ...DrawingTools.DEFAULT_SHAPE_OPTIONS }, style: { lineDash: [], lineWidth: 1, ...TYPE_STYLE[type] } }
        : this.meta.rc
          ? { options: { ...DrawingTools.DEFAULT_RECTANGLE_OPTIONS }, style: { lineColor: "#9c27b0", lineWidth: 1, lineDash: [], fillColor: "rgba(156, 39, 176, 0.2)" } }
          : this.meta.lp
            ? { options: { accountSize: 1000, lotSize: 1, risk: 25, riskDisplayMode: "percents", compact: false, alwaysShowStats: false, showPriceLabels: true, textColor: "#ffffff", fontSize: 12, profitBackground: "rgba(8, 153, 129, 0.2)", stopBackground: "rgba(242, 54, 69, 0.2)" }, style: { lineColor: "#787B86", lineWidth: 1 } }
            : this.meta.fv
              ? { options: { ...FRVP_DEFAULTS }, style: { lineWidth: 1, lineColor: "#787B86" } }
              : this.meta.pj
                ? { options: { color1: "rgba(41, 98, 255, 0.2)", color2: "rgba(156, 39, 176, 0.2)" }, style: { lineWidth: 1, lineColor: "#9598A1" } }
                : this.meta.gh
                  ? { options: { variance: 50, transparency: 50, upColor: "#ACE5DC", downColor: "#FAA1A4", drawBorder: true, borderUpColor: "#089981", borderDownColor: "#F23645", drawWick: true, wickColor: "#787B86" }, style: { lineWidth: 1, lineColor: "#787B86" } }
                  : this.meta.bp
                    ? { options: { mode: "hl", mirrored: false, flipped: false }, style: { lineWidth: 2, lineColor: "#2962FF" } }
                    : this.meta.fcs
                      ? { options: { ...FORECAST_DEFAULT_OPTIONS }, style: { lineWidth: 1, lineColor: "#2962FF" } }
                      : this.meta.rg
                        ? { options: { ...RANGE_DEFAULT_OPTIONS, customText: { ...RANGE_DEFAULT_OPTIONS.customText } }, style: { lineWidth: 1, lineDash: [], ...RANGE_DEFAULT_STYLE } }
                        : this.meta.cy
                          ? { options: { fillBackground: true }, style: { lineWidth: 1, lineDash: [], ...CYCLE_DEFAULT_STYLE[type] } }
                          : this.meta.el
                            ? { options: { showWave: true, degree: 7 }, style: { lineWidth: 1, ...ELLIOTT_DEFAULT_STYLE[type] } }
                            : this.meta.xp
                              ? { options: { filled: !this.meta.xnf, textColor: "#ffffff", fontSize: 12, bold: false, italic: false }, style: { lineWidth: 1, ...PATTERN_DEFAULT_STYLE[type] } }
                              : this.meta.fk
                                ? { options: { flagColor: "#2962FF" }, style: {} }
                                : this.meta.ak
                                  ? { options: { arrowColor: TYPE_STYLE[type]?.lineColor, textColor: TYPE_STYLE[type]?.lineColor, showText: true, text: "", textSize: 14, textBold: false, textItalic: false }, style: {} }
                                  : this.meta.am
                                    ? { options: { backgroundColor: "#1E53E5", showText: true, text: "", textColor: "#1E53E5", textSize: 16, textBold: true, textItalic: false }, style: {} }
                                    : this.meta.pn
                                      ? { options: { showText: false, text: "", textColor: "#2962FF", textSize: 14, textBold: false, textItalic: false, textHAlign: "center", textVAlign: "bottom", priceLabelBackgroundColor: "#2962FF", priceLabelBorderColor: "#2962FF", priceLabelTextColor: "#FFFFFF", priceLabelFontSize: 12, priceLabelBold: false, priceLabelItalic: false }, style: { lineColor: "#2962FF" } }
                                      : this.meta.pl
                                        ? { options: { fontSize: 14, bold: true, textColor: "#FFFFFF", backgroundColor: "#2962FF", borderColor: "#2962FF" }, style: {} }
                                        : this.meta.cm
                                          ? { options: { fontSize: 16, textColor: "#FFFFFF", backgroundColor: "#2962FF", borderColor: "#2962FF" }, style: {} }
                                          : this.meta.co
                                            ? { options: { fontSize: 14, bold: false, italic: false, textColor: "#FFFFFF", backgroundColor: "rgba(0, 151, 167, 0.7)", borderColor: "#0097A7", borderWidth: 1, wordWrap: false, wordWrapWidth: 200 }, style: { lineColor: "#0097A7" } }
                                            : this.meta.sg
                                              ? { options: { fontSize: 12, bold: false, italic: false, emojiPin: false, emoji: "🙂", pinColor: "#3861F6" }, style: {} }
                                              : this.meta.nt
                                                ? { options: { fontSize: 14, bold: false, italic: false, textColor: "#FFFFFF", backgroundColor: "rgba(56, 97, 246, 0.7)", borderColor: "#3861F6" }, style: { lineColor: "#3861F6" } }
                                                : this.meta.txt
                                                  ? { options: { fontSize: 14, bold: false, italic: false, wordWrap: false, wordWrapWidth: 200, fillBackground: false, backgroundColor: "rgba(91, 133, 191, 0.3)", drawBorder: false, borderColor: "#667b8b" }, style: { lineColor: "#2962FF" } }
                                                  : this.meta.hl
                                                    ? { options: {}, style: { lineColor: "rgba(242, 54, 69, 0.2)" } }
                                                    : this.meta.sp
                                                      ? { options: { ...DrawingTools.DEFAULT_FIB_SPIRAL_OPTIONS }, style: { lineColor: "#00bcd4", lineWidth: 1, lineDash: [] } }
                                                      : this.meta.brush
                                                        ? { options: { backgroundVisible: false, leftEnd: "normal", rightEnd: "normal" }, style: { lineColor: "#00BCD4", lineWidth: 1, fillColor: "rgba(0, 188, 212, 0.5)" } }
                                                        : this.meta.rt
                                                          ? { options: { ...DrawingTools.DEFAULT_REGRESSION_TREND_OPTIONS }, style: { lineColor: "#2962FF", lineWidth: 2, lineDash: [] } }
                                                          : this.meta.ft
                                                            ? this.meta.dj
                                                              ? { options: { ...DEFAULT_OPTIONS, ...DrawingTools.DEFAULT_DISJOINT_CHANNEL_OPTIONS, leftEnd: "normal", rightEnd: "normal" }, style: { lineColor: "#089981", lineWidth: 2, lineDash: [], fillColor: "rgba(8, 153, 129, 0.2)" } }
                                                              : { options: { ...DEFAULT_OPTIONS, ...DrawingTools.DEFAULT_FLAT_TOP_BOTTOM_OPTIONS, leftEnd: "normal", rightEnd: "normal" }, style: { lineColor: "#FF9800", lineWidth: 2, lineDash: [], fillColor: "rgba(255, 152, 0, 0.2)" } }
                                                            : this.meta.pc
                                                              ? { options: { ...DEFAULT_OPTIONS, ...DrawingTools.DEFAULT_PARALLEL_CHANNEL_OPTIONS }, style: { lineColor: "#2962FF", lineWidth: 2, lineDash: [], fillColor: "rgba(41, 98, 255, 0.2)" } }
                                                              : this.meta.pf
                                                                ? { options: { ...DrawingTools.DEFAULT_PITCHFORK_OPTIONS, variant: DEFAULT_VARIANTS[type] ?? "original", levels: type === "pitchfan" ? DrawingTools.defaultPitchfanLevels() : DrawingTools.defaultPitchforkLevels() }, style: { lineColor: "#F23645", lineWidth: 1, lineDash: [] } }
                                                                : this.meta.gf
                                                                  ? { options: { ...DrawingTools.DEFAULT_GANN_FAN_OPTIONS, levels: DrawingTools.defaultGannFanLevels() }, style: { lineColor: "#00bcd4", lineWidth: 1, lineDash: [] } }
                                                                  : this.meta.wd
                                                                    ? { options: { ...DrawingTools.DEFAULT_FIB_WEDGE_OPTIONS, levels: DrawingTools.defaultFibWedgeLevels() }, style: { lineColor: "#808080", lineWidth: 1, lineDash: [] } }
                                                                    : this.meta.fa
                                                                      ? { options: { ...DrawingTools.DEFAULT_FIB_ARCS_OPTIONS, levels: DrawingTools.defaultFibCircleLevels() }, style: { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] } }
                                                                      : this.meta.fcir
                                                                        ? { options: { ...DrawingTools.DEFAULT_FIB_CIRCLES_OPTIONS, levels: DrawingTools.defaultFibCircleLevels() }, style: { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] } }
                                                                        : this.meta.tt
                                                                          ? { options: { ...DrawingTools.DEFAULT_FIB_TIME_EXTENSION_OPTIONS, levels: DrawingTools.defaultFibTimeExtensionLevels() }, style: { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] } }
                                                                          : this.meta.tz
                                                                            ? { options: { ...DrawingTools.DEFAULT_FIB_TIME_ZONE_OPTIONS, levels: DrawingTools.defaultFibTimeZoneLevels() }, style: { lineColor: "#808080", lineWidth: 1, lineDash: [6, 6] } }
                                                                            : this.meta.ff
                                                                              ? { options: { ...DrawingTools.DEFAULT_FIB_FAN_OPTIONS, hlevels: DrawingTools.defaultFibFanLevels(), vlevels: DrawingTools.defaultFibFanLevels() }, style: { lineColor: "#787B86", lineWidth: 1, lineDash: [] } }
                                                                              : this.meta.gsf
                                                                                ? { options: { ...DrawingTools.DEFAULT_GANN_SQUARE_FIXED_OPTIONS, ...(this.meta.gsq ? { showLabels: true, labelsStyle: { ...DrawingTools.DEFAULT_GANN_SQUARE_LABELS } } : {}), levels: DrawingTools.defaultGannSquareFixedLevels(), fanlines: DrawingTools.defaultGannSquareFixedFans(), arcs: DrawingTools.defaultGannSquareFixedArcs() }, style: { lineColor: "#787B86", lineWidth: 1, lineDash: [] } }
                                                                                : this.meta.gb
                                                                                  ? { options: { ...DrawingTools.DEFAULT_GANN_BOX_OPTIONS, priceLevels: DrawingTools.defaultGannBoxLevels(), timeLevels: DrawingTools.defaultGannBoxLevels() }, style: { lineColor: "#787B86", lineWidth: 1, lineDash: [] } }
                                                                                  : this.meta.fib
                                                                                    ? { options: { ...DrawingTools.DEFAULT_FIB_OPTIONS, extendLeft: false, extendRight: false, levels: DrawingTools.defaultFibLevels() }, style: { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] } }
                                                                                    : { options: { ...DEFAULT_OPTIONS, ...this.meta.family?.options }, style: { lineColor: "#2962FF", lineWidth: 2, lineDash: [] } };
    this.replaceAll(patch.options, patch.style, "template");
  };

  private renderFooter() {
    const items = [{ value: "defaults", label: "Apply Defaults" }];
    return (
      <>
        <PopupButton items={items} current="" width={160} onPick={this.showTemplate} className={cx(styles.sdSelect, styles.sdW100)}>
          <span>Template</span>
          <CommonIcons.chevron />
        </PopupButton>
        <div className={styles.sdActions}>
          <button type="button" className={styles.sdCancel} onClick={() => this.finish(false)}>Cancel</button>
          <button type="button" className={styles.sdOk} onClick={() => this.finish(true)}>Ok</button>
        </div>
      </>
    );
  }

  private renderLineControls(label = "Line", opts?: { noEnds?: boolean; noDash?: boolean; noChecker?: boolean; brushEnds?: boolean; highlighter?: boolean }) {
    const meta = this.meta!;
    return (
      <div className={cx(styles.sdRow, styles.sdLine, (meta.brush || meta.hl) && styles.sdBrushline, meta.hl && styles.sdHlline, (meta.hz || meta.vl || meta.cl || meta.sp || (meta.sh && LINE_SHAPES.has(meta.selType))) && styles.sdHzline)}>
        <span className={styles.sdLbl}>{label}</span>
        <ColorButton
          color={this.state.style.lineColor}
          width={this.state.style.lineWidth}
          checker={meta.hl && !opts?.noChecker}
          line={!meta.hl}
          lineVisible={!meta.hl}
          thickness={!meta.hl}
          onChange={(color, _opacity, width) => {
            const patch: Partial<DrawingStyleState> = {};
            if (color !== this.state.style.lineColor) patch.lineColor = color;
            if (width !== undefined && width !== this.state.style.lineWidth) patch.lineWidth = width;
            if (Object.keys(patch).length) this.patchStyle(patch, width !== undefined && width !== this.state.style.lineWidth ? "line width" : "line color");
          }}
        />
        {opts?.noDash || meta.hl ? null : <DashButton dash={this.state.style.lineDash} onChange={(lineDash) => this.patchStyle({ lineDash }, "line style")} />}
        {opts?.noEnds || meta.ang || meta.hz || meta.vl || meta.cl || meta.sp ? null : (
          <>
            <EndButton items={LEFT_ENDS} current={String(this.currentOption("leftEnd", "normal"))} onPick={(value) => this.patchOptions({ leftEnd: value }, "line left end")} icon={String(this.currentOption("leftEnd", "normal")) === "arrow" ? <ICON.leftArrow /> : <ICON.leftNormal />} />
            <EndButton items={RIGHT_ENDS} current={String(this.currentOption("rightEnd", "normal"))} onPick={(value) => this.patchOptions({ rightEnd: value }, "line right end")} icon={String(this.currentOption("rightEnd", "normal")) === "arrow" ? <ICON.rightArrow /> : <ICON.rightNormal />} />
          </>
        )}
      </div>
    );
  }

  private renderTextToolsRow(textColorKey: string, sizeKey: string, boldKey: string, italicKey: string, undoBase = "text", colorFallback = this.state.style.lineColor, selectClass = styles.sdW100, disabled = false) {
    return (
      <>
        <ColorButton color={String(this.currentOption(textColorKey, colorFallback))} onChange={(color, opacity) => this.patchOptions({ [textColorKey]: composeColor(color, opacity) }, `${undoBase} color`)} className={textColorButtonClass} checker />
        <Select items={SIZES} value={String(this.currentOption(sizeKey, 14))} onChange={(value) => this.patchOptions({ [sizeKey]: Number(value) }, `${undoBase} font size`)} className={selectClass} />
        <ToggleButton active={!!this.currentOption(boldKey, false)} content={<b>B</b>} className={boldButtonClass} onClick={() => this.patchOptions({ [boldKey]: !this.currentOption(boldKey, false) }, `${undoBase} font bold`)} disabled={disabled} />
        <ToggleButton active={!!this.currentOption(italicKey, false)} content={<i>I</i>} className={italicButtonClass} onClick={() => this.patchOptions({ [italicKey]: !this.currentOption(italicKey, false) }, `${undoBase} font italic`)} disabled={disabled} />
      </>
    );
  }

  private renderStyleTab(): ReactNode {
    const meta = this.meta!;
    if (meta.fv) return this.renderFrvpStyle();
    if (meta.pj) return this.renderProjectionStyle();
    if (meta.gh) return this.renderGhostStyle();
    if (meta.bp) return this.renderBarsPatternStyle();
    if (meta.fcs) return this.renderForecastStyle();
    if (meta.rg) return this.renderRangeStyle();
    if (meta.cy) return this.renderCycleStyle();
    if (meta.el) return this.renderElliottStyle();
    if (meta.am || meta.ak || meta.fk) return this.renderArrowStyle();
    if (meta.pl || meta.pn) return this.renderTextAnnStyle();
    if (meta.sh && LINE_SHAPES.has(meta.selType)) return <>{this.renderLineControls()}</>;
    if (CURVES.has(meta.selType)) return this.renderCurveStyle();
    if (meta.rc || meta.sh) return this.renderRectStyle();
    if (meta.sp) return this.renderSpiralStyle();
    if (meta.rt) return this.renderRegressionStyle();
    if (meta.ic) return this.renderIconStyle();
    if (meta.sg) return this.renderSignpostStyle();
    if (meta.nt) return this.renderNoteStyle();
    if (meta.pf) return this.renderPitchforkStyle();
    if (meta.tz) return this.renderTimeZoneStyle();
    if (meta.ff) return this.renderFibFanStyle();
    if (meta.gf) return this.renderGannFanStyle();
    if (meta.gsf) return this.renderGannSquareFixedStyle();
    if (meta.gb) return this.renderGannBoxStyle();
    if (meta.fib) return this.renderFibStyle();
    if (meta.lp) return this.renderPositionStyle();
    if (meta.xp) return this.renderPatternStyle();
    if (meta.ft) return this.renderFlatStyle();
    if (meta.pc) return this.renderChannelStyle();
    if (meta.brush) return this.renderBrushStyle();
    if (meta.hl) return <>{this.renderLineControls()}</>;
    return this.renderDefaultStyle();
  }

  private renderDefaultStyle() {
    const meta = this.meta!;
    return (
      <>
        {this.renderLineControls()}
        {meta.cl ? (
          <>
            <div className={styles.sdRow}><Checkbox label="Price label" checked={!!this.currentOption("priceLabels", false)} onChange={(value) => this.patchOptions({ priceLabels: value }, "price label visibility")} /></div>
            <div className={styles.sdRow}><Checkbox label="Time label" checked={!!this.currentOption("timeLabels", false)} onChange={(value) => this.patchOptions({ timeLabels: value }, "time label visibility")} /></div>
          </>
        ) : meta.vl ? (
          <>
            <div className={styles.sdRow}><Checkbox label="Extend" checked={!!this.currentOption("extendLine", false)} onChange={(value) => this.patchOptions({ extendLine: value }, "extension")} /></div>
            <div className={styles.sdRow}><Checkbox label="Time label" checked={!!this.currentOption("timeLabels", false)} onChange={(value) => this.patchOptions({ timeLabels: value }, "time label visibility")} /></div>
          </>
        ) : meta.hz ? (
          <div className={styles.sdRow}><Checkbox label="Price label" checked={!!this.currentOption("priceLabels", false)} onChange={(value) => this.patchOptions({ priceLabels: value }, "price label visibility")} /></div>
        ) : (
          <>
            {CHECKS.map((item) => <div key={item.key} className={styles.sdRow}><Checkbox label={item.label} checked={!!this.currentOption(item.key, false)} onChange={(value) => this.patchOptions({ [item.key]: value }, item.undo)} /></div>)}
            <SectionLabel>STATS</SectionLabel>
            {STATS.filter((item) => !meta.ang || ANGLE_STATS.includes(item.key)).map((item) => <div key={item.key} className={styles.sdRow}><Checkbox label={item.label} checked={!!this.currentOption(item.key, false)} onChange={(value) => this.patchOptions({ [item.key]: value }, item.undo)} /></div>)}
            <div className={styles.sdRow}><span className={styles.sdLbl}>Stats position</span><Select items={STATS_POS} value={String(this.currentOption("statsPosition", "right"))} onChange={(value) => this.patchOptions({ statsPosition: value }, "stats position")} className={styles.sdW101} /></div>
          </>
        )}
      </>
    );
  }

  private renderBrushStyle() {
    return (
      <>
        {this.renderLineControls("Line", { noDash: true })}
        <div className={cx(styles.sdRow, styles.sdBgrow)}>
          <Checkbox label="Background" checked={!!this.currentOption("backgroundVisible", false)} onChange={(value) => this.patchOptions({ backgroundVisible: value }, "background visibility")} />
          <ColorButton color={this.state.style.fillColor ?? "rgba(0, 188, 212, 0.5)"} onChange={(color, opacity) => this.patchStyle({ fillColor: composeColor(color, opacity) }, "background color")} className={bgColorButtonClass} checker disabled={!this.currentOption("backgroundVisible", false)} />
        </div>
      </>
    );
  }

  private renderIconStyle() { return <div className={cx(styles.sdRow, styles.sdIconrow)}><span className={styles.sdLbl}>Color</span><ColorButton color={this.state.style.lineColor} onChange={(color) => this.patchStyle({ lineColor: color }, "color")} className={textColorButtonClass} /></div>; }

  private renderArrowStyle() {
    const meta = this.meta!;
    const key = meta.fk ? "flagColor" : meta.ak ? "arrowColor" : "backgroundColor";
    return <div className={cx(styles.sdRow, styles.sdAmrow, meta.ak && styles.sdAkrow, meta.fk && styles.sdFkrow)}><span className={styles.sdLbl}>{meta.fk ? "Flag" : "Color"}</span><ColorButton color={String(this.currentOption(key, "#1E53E5"))} onChange={(color, opacity) => this.patchOptions({ [key]: composeColor(color, opacity) }, "color")} className={textColorButtonClass} checker /></div>;
  }

  private renderNoteStyle() { return <div className={cx(styles.sdRow, styles.sdIconrow)}><span className={styles.sdLbl}>Label</span><ColorButton color={this.state.style.lineColor} onChange={(color) => this.patchStyle({ lineColor: color }, "color")} className={textColorButtonClass} /></div>; }

  private renderSignpostStyle() {
    const enabled = !!this.currentOption("emojiPin", false);
    return (
      <div className={cx(styles.sdRow, styles.sdSgrow)}>
        <Checkbox label="Emoji pin" checked={enabled} onChange={(value) => this.patchOptions({ emojiPin: value }, "emoji visibility")} />
        <GlyphButton label={String(this.currentOption("emoji", "🙂"))} disabled={!enabled} options={{ onEmoji: (emoji) => this.patchOptions({ emoji }, "emoji") }} />
        <ColorButton color={String(this.currentOption("pinColor", "#3861F6"))} onChange={(color, opacity) => this.patchOptions({ pinColor: composeColor(color, opacity) }, "emoji background color")} className={bgColorButtonClass} checker disabled={!enabled} />
      </div>
    );
  }

  private renderSpiralStyle() { return <>{this.renderLineControls()}<div className={styles.sdRow}><Checkbox label="Counterclockwise" checked={!!this.currentOption("counterclockwise", false)} onChange={(value) => this.patchOptions({ counterclockwise: value }, "counterclockwise")} /></div></>; }

  private renderTextTab(): ReactNode {
    const meta = this.meta!;
    if (meta.rg) return this.renderRangeText();
    if (meta.txt || meta.nt || meta.sg || meta.co) return this.renderTextAnnBody();
    return this.renderTextBody();
  }

  private renderTextBody() {
    const meta = this.meta!;
    const enabled = !!this.currentOption("showText", false);
    return (
      <>
        <div className={cx(styles.sdTrow, (meta.pn || meta.am || meta.ak) && styles.sdPntext, (meta.am || meta.ak) && styles.sdAmtext)}>
          <Checkbox label="Text" checked={enabled} onChange={(value) => this.patchOptions({ showText: value }, "text visibility")} />
          {this.renderTextToolsRow("textColor", "textSize", "textBold", "textItalic", "text", this.state.style.lineColor, styles.sdW100, !enabled)}
        </div>
        <textarea
          className={cx(styles.sdArea, (meta.pn || meta.am || meta.ak) && styles.sdPntext)}
          disabled={!enabled}
          value={String(this.currentOption("text", ""))}
          onFocus={() => { this.textBefore = String(this.currentOption("text", "")); }}
          onChange={(event) => { const value = event.target.value; this.setState((state) => ({ options: { ...state.options, text: value } })); this.livePreviewText(value); }}
          onBlur={() => { const value = String(this.currentOption("text", "")); if (value !== this.textBefore) { this.textBefore = value; this.patchOptions({ text: value }, "text"); } }}
        />
        {meta.sh || meta.am || meta.ak ? null : (
          <div className={cx(styles.sdAlignrow, meta.pn && styles.sdPntext)}>
            <span className={styles.sdLbl}>Text alignment</span>
            <Select items={meta.rc ? SHAPE_V_ALIGN : V_ALIGN} value={String(this.currentOption("textVAlign", "top"))} onChange={(value) => this.patchOptions({ textVAlign: value }, meta.hz || meta.vl || meta.rc ? "labels alignment vertical" : "text vertical alignment")} className={styles.sdW100} />
            <Select items={H_ALIGN} value={String(this.currentOption("textHAlign", "center"))} onChange={(value) => this.patchOptions({ textHAlign: value }, meta.hz || meta.vl || meta.rc ? "labels alignment horizontal" : "text horizontal alignment")} className={styles.sdW100} />
          </div>
        )}
        {meta.vl ? <div className={styles.sdAlignrow} style={{ top: 257 }}><span className={styles.sdLbl}>Text orientation</span><Select items={ORIENT} value={String(this.currentOption("textOrientation", "vertical"))} onChange={(value) => this.patchOptions({ textOrientation: value }, "labels direction")} className={styles.sdW100} /></div> : null}
      </>
    );
  }

  private renderTextAnnStyle() {
    const meta = this.meta!;
    const current = meta.pn ? String(this.currentOption("priceLabelTextColor", "#FFFFFF")) : meta.nt || meta.co || meta.pl ? String(this.currentOption("textColor", "#FFFFFF")) : this.state.style.lineColor;
    return (
      <div className={styles.sdTrow}>
        <ColorButton color={current} onChange={(color, opacity) => {
          if (meta.pn) this.patchOptions({ priceLabelTextColor: composeColor(color, opacity) }, "label text color");
          else if (meta.nt || meta.co || meta.pl) this.patchOptions({ textColor: composeColor(color, opacity) }, "text color");
          else this.patchStyle({ lineColor: composeColor(color, opacity) }, "text color");
        }} className={textColorButtonClass} checker />
        {meta.pn ? (
          <>
            <Select items={SIZES} value={String(this.currentOption("priceLabelFontSize", 12))} onChange={(value) => this.patchOptions({ priceLabelFontSize: Number(value) }, "label text font size")} className={styles.sdW100} />
            <ToggleButton active={!!this.currentOption("priceLabelBold", false)} content={<b>B</b>} className={boldButtonClass} onClick={() => this.patchOptions({ priceLabelBold: !this.currentOption("priceLabelBold", false) }, "label text font bold")} />
            <ToggleButton active={!!this.currentOption("priceLabelItalic", false)} content={<i>I</i>} className={italicButtonClass} onClick={() => this.patchOptions({ priceLabelItalic: !this.currentOption("priceLabelItalic", false) }, "label text font italic")} />
          </>
        ) : (
          <>{this.renderTextToolsRow(meta.nt || meta.co || meta.pl ? "textColor" : "lineColor", "fontSize", "bold", "italic", "text", current, styles.sdW100)}</>
        )}
      </div>
    );
  }

  private renderTextAnnBody() {
    const meta = this.meta!;
    const topClass = cx(styles.sdTrow, (meta.pn || meta.am || meta.ak) && styles.sdPntext, (meta.am || meta.ak) && styles.sdAmtext);
    const enabled = meta.rg ? true : !!this.currentOption("showText", meta.nt || meta.co || meta.pl ? true : false);
    const textValue = String(this.currentOption("text", ""));
    return (
      <>
        <div className={topClass}>
          <Checkbox label="Text" checked={enabled} onChange={(value) => this.patchOptions({ showText: value }, "text visibility")} />
          {this.renderTextToolsRow("textColor", meta.pn ? "priceLabelFontSize" : meta.rg ? "fontSize" : "textSize", meta.rg ? "bold" : meta.pn ? "priceLabelBold" : "textBold", meta.rg ? "italic" : meta.pn ? "priceLabelItalic" : "textItalic", "text", meta.pn ? String(this.currentOption("priceLabelTextColor", "#FFFFFF")) : String(this.currentOption("textColor", "#FFFFFF")), styles.sdW100, !enabled)}
        </div>
        <textarea
          className={cx(styles.sdArea, (meta.pn || meta.am || meta.ak || meta.rg) && styles.sdPntext, meta.co && !meta.cm && styles.sdCoarea, meta.cm && styles.sdCmarea)}
          disabled={!enabled}
          value={meta.rg ? String(((this.currentOption("customText", {}) as Opts).text ?? "")) : textValue}
          onFocus={() => { if (meta.rg) this.rangeTextBefore = String(((this.currentOption("customText", {}) as Opts).text ?? "")); else this.textBefore = textValue; }}
          onChange={(event) => {
            const value = event.target.value;
            if (meta.rg) {
              const current = (this.currentOption("customText", {}) as Opts);
              this.setState((state) => ({ options: { ...state.options, customText: { ...current, text: value } } }));
              this.livePreviewRangeText(value);
            } else {
              this.setState((state) => ({ options: { ...state.options, text: value } }));
              this.livePreviewText(value);
            }
          }}
          onBlur={() => {
            if (meta.rg) {
              const current = (this.currentOption("customText", {}) as Opts);
              const value = String(current.text ?? "");
              if (value !== this.rangeTextBefore) {
                this.rangeTextBefore = value;
                this.patchOptions({ customText: { ...current, text: value } }, "text");
              }
            } else {
              const value = String(this.currentOption("text", ""));
              if (value !== this.textBefore) {
                this.textBefore = value;
                this.patchOptions({ text: value }, "text");
              }
            }
          }}
        />
        {meta.rg ? null : (!meta.sh && !meta.am && !meta.ak ? (
          <div className={cx(styles.sdAlignrow, meta.pn && styles.sdPntext)}>
            <span className={styles.sdLbl}>Text alignment</span>
            <Select items={meta.rc ? SHAPE_V_ALIGN : V_ALIGN} value={String(this.currentOption("textVAlign", "top"))} onChange={(value) => this.patchOptions({ textVAlign: value }, meta.hz || meta.vl || meta.rc ? "labels alignment vertical" : "text vertical alignment")} className={styles.sdW100} />
            <Select items={H_ALIGN} value={String(this.currentOption("textHAlign", "center"))} onChange={(value) => this.patchOptions({ textHAlign: value }, meta.hz || meta.vl || meta.rc ? "labels alignment horizontal" : "text horizontal alignment")} className={styles.sdW100} />
          </div>
        ) : null)}
      </>
    );
  }

  private renderCoordinatesTab(): ReactNode {
    if (this.meta?.sg) return this.renderSignpostCoords();
    return this.renderCoords();
  }

  private renderSignpostCoords() {
    const selected = this.selected();
    const percent = selected?.verticalPercent?.(selected.getViewport?.()) ?? 0;
    return (
      <div className={styles.sdCrow}>
        <span className={styles.sdLbl}>#1 (vertical position %, bar)</span>
        <NumberInput value={percent.toFixed(2)} className={styles.sdNum} step="0.01" onCommit={(value) => {
          const next = Number(value);
          const live = this.selected();
          if (!live?.setVerticalPercent || !live.getViewport || !Number.isFinite(next)) return;
          live.setVerticalPercent(next, live.getViewport());
          this.controller().setSelectedAnchors(live.anchors.map((anchor) => ({ ...anchor })) as never, "vertical position Y coordinate");
          this.setState({ anchors: live.anchors.map((anchor) => ({ ...anchor })) });
        }} />
        <NumberInput value={String(this.barIndex(this.state.anchors[0]?.time))} className={styles.sdNum} step="1" onCommit={(value) => {
          const bar = Number(value);
          if (!Number.isFinite(bar)) return;
          const next = this.state.anchors.map((anchor) => ({ ...anchor }));
          next[0].time = this.timeAt(Math.round(bar), next[0].time);
          this.patchAnchors(next, "bar index");
        }} />
      </div>
    );
  }

  private renderCoords() {
    const meta = this.meta!;
    const anchors = this.state.anchors.slice(0, meta.ang || meta.hz || meta.vl || meta.cl ? 1 : undefined);
    return (
      <>
        {anchors.map((anchor, index) => {
          const barOnly = meta.vl || meta.rt || meta.fv;
          return (
            <div className={styles.sdCrow} key={index}>
              <span className={styles.sdLbl}>#{index + 1} ({meta.hzPriceOnly ? "price" : barOnly ? "bar" : "price, bar"})</span>
              {meta.hzPriceOnly || barOnly ? null : <NumberInput value={anchor.price.toFixed(2)} className={styles.sdNum} step="0.01" onCommit={(value) => {
                const next = this.state.anchors.map((item) => ({ ...item }));
                const price = Number(value);
                if (Number.isFinite(price)) next[index].price = price;
                this.patchAnchors(next, `${index} point`);
              }} />}
              {meta.hzPriceOnly ? <NumberInput value={anchor.price.toFixed(2)} className={styles.sdNum} step="0.01" onCommit={(value) => {
                const next = this.state.anchors.map((item) => ({ ...item }));
                const price = Number(value);
                if (Number.isFinite(price)) next[index].price = price;
                this.patchAnchors(next, `${index} point`);
              }} /> : <NumberInput value={String(this.barIndex(anchor.time))} className={styles.sdNum} step="1" onCommit={(value) => {
                const next = this.state.anchors.map((item) => ({ ...item }));
                const bar = Number(value);
                if (!meta.hzPriceOnly && Number.isFinite(bar)) next[index].time = this.timeAt(Math.round(bar), next[index].time);
                this.patchAnchors(next, `${index} point`);
              }} />}
            </div>
          );
        })}
        {meta.ang ? this.renderAngleRow() : null}
      </>
    );
  }

  private renderAngleRow() {
    const pixels = this.anglePixels();
    const degrees = pixels ? String(Math.round((Math.atan2(-(pixels[1].y - pixels[0].y), pixels[1].x - pixels[0].x) * 180) / Math.PI)) : "0";
    return (
      <div className={styles.sdCrow}>
        <span className={styles.sdLbl}>Angle</span>
        <NumberInput value={degrees} className={styles.sdNum} step="1" onCommit={(value) => {
          const degree = Number(value);
          const current = this.anglePixels();
          if (!current || !Number.isFinite(degree)) return;
          const length = Math.hypot(current[1].x - current[0].x, current[1].y - current[0].y);
          const rad = (degree * Math.PI) / 180;
          const logical = this.controller().chartApi.timeScale().coordinateToLogical((current[0].x + length * Math.cos(rad)) as never);
          if (logical === null) return;
          const price = this.controller().seriesApi.coordinateToPrice(current[0].y - length * Math.sin(rad));
          if (price === null) return;
          const next = this.state.anchors.map((item) => ({ ...item }));
          next[1].time = this.timeAt(Math.round(Number(logical)) + 1, next[1].time);
          next[1].price = price;
          this.patchAnchors(next, "angle");
        }} />
      </div>
    );
  }

  private renderVisibilityTab() {
    const visibility = (this.state.options.visibility as Record<string, { enabled: boolean; min: number; max: number }> | undefined) ?? {};
    return (
      <>
        {UNITS.map((unit) => {
          const saved = visibility[unit.key];
          const current = {
            enabled: saved?.enabled ?? true,
            min: saved?.min ?? unit.min,
            max: saved?.max ?? unit.max,
          };
          return (
            <div className={cx(styles.sdVrow, !current.enabled && styles.off)} key={unit.key}>
              <Checkbox label={unit.label} checked={current.enabled} onChange={(value) => this.patchOptions({ visibility: { ...visibility, [unit.key]: { ...current, enabled: value } } }, `visibility on ${unit.label.toLowerCase()}`)} />
              <NumberInput value={String(current.min)} className={styles.sdNum} step="1" disabled={!current.enabled} onCommit={(value) => {
                const min = Math.min(Math.max(unit.min, Number(value) || unit.min), current.max);
                this.patchOptions({ visibility: { ...visibility, [unit.key]: { ...current, min } } }, `visibility on ${unit.label.toLowerCase()}`);
              }} />
              <VisibilitySlider enabled={current.enabled} min={unit.min} max={unit.max} currentMin={current.min} currentMax={current.max} onChange={(min, max) => this.patchOptions({ visibility: { ...visibility, [unit.key]: { ...current, min, max } } }, `visibility on ${unit.label.toLowerCase()}`)} />
              <NumberInput value={String(current.max)} className={styles.sdNum} step="1" disabled={!current.enabled} onCommit={(value) => {
                const max = Math.max(Math.min(unit.max, Number(value) || unit.max), current.min);
                this.patchOptions({ visibility: { ...visibility, [unit.key]: { ...current, max } } }, `visibility on ${unit.label.toLowerCase()}`);
              }} />
            </div>
          );
        })}
      </>
    );
  }

  private renderFibStyle() {
    const levels = ((this.currentOption("levels", []) as Array<{ value: number; enabled: boolean; color: string }>)).map((level) => ({ ...level }));
    return (
      <>
        <div className={cx(styles.sdRow, styles.sdFirst)}><Checkbox label="Trend line" checked={!!this.currentOption("trendLineVisible", false)} onChange={(value) => this.patchOptions({ trendLineVisible: value }, "trend line visibility")} /><ColorButton color={this.state.style.lineColor} width={this.state.style.lineWidth} line thickness onChange={(color, _opacity, width) => { const patch: Partial<DrawingStyleState> = { lineColor: color }; if (width !== undefined) patch.lineWidth = width; this.patchStyle(patch, width !== undefined && width !== this.state.style.lineWidth ? "trend line width" : "trend line color"); }} /><DashButton dash={this.state.style.lineDash} onChange={(lineDash) => this.patchStyle({ lineDash }, "trend line style")} /></div>
        <div className={cx(styles.sdRow, styles.sdLevelsRow, this.meta?.fc && styles.sdFirst)}><span className={cx(styles.sdLbl, styles.sdCw)}>Levels line</span><ThicknessButton value={Number(this.currentOption("levelsWidth", 1))} onChange={(value) => this.patchOptions({ levelsWidth: value }, "levels line width")} /><DashButton dash={this.currentOption("levelsDash", []) as number[]} onChange={(lineDash) => this.patchOptions({ levelsDash: lineDash }, "levels line style")} /></div>
        <div className={cx(styles.sdRow, styles.sdExtFirst)}><Checkbox label={this.meta?.fc ? "Extend left" : "Extend lines left"} checked={!!this.currentOption("extendLeft", false)} onChange={(value) => this.patchOptions({ extendLeft: value }, "line extending left")} /></div>
        <div className={styles.sdRow}><Checkbox label={this.meta?.fc ? "Extend right" : "Extend lines right"} checked={!!this.currentOption("extendRight", false)} onChange={(value) => this.patchOptions({ extendRight: value }, "line extending right")} /></div>
        <div className={styles.sdGrid}>
          {levels.map((level, index) => (
            <div key={index} className={cx(styles.sdLv, !level.enabled && styles.off)}>
              <Checkbox label="" checked={level.enabled} onChange={(value) => this.patchOptions({ levels: levels.map((item, i) => i === index ? { ...item, enabled: value } : item) }, `level ${index + 1} line visibility`)} />
              <NumberInput value={String(level.value)} className={styles.sdLvin} disabled={!level.enabled} inputMode="decimal" onCommit={(value) => { const num = parseFloat(value); if (Number.isFinite(num) && num !== levels[index].value) this.patchOptions({ levels: levels.map((item, i) => i === index ? { ...item, value: num } : item) }, `level ${index + 1} line coeff`); }} />
              <SimpleColorButton color={level.color} disabled={!level.enabled} onChange={(color, opacity) => this.patchOptions({ levels: levels.map((item, i) => i === index ? { ...item, color: composeColor(color, opacity) } : item) }, `level ${index + 1} line color`)} className={cx(styles.sdBtn, styles.sdLvsw)} />
            </div>
          ))}
        </div>
        <div className={cx(styles.sdRow, styles.sdOneRow)}><span className={cx(styles.sdLbl, styles.sdCw)}>Use one color</span><SimpleColorButton color={levels[0]?.color ?? "#2962FF"} onChange={(color) => this.patchOptions({ levels: levels.map((item) => ({ ...item, color })) }, "levels color")} className={oneColorButtonClass} /></div>
        <div className={styles.sdRow}><Checkbox label="Background" checked={!!this.currentOption("backgroundVisible", false)} onChange={(value) => this.patchOptions({ backgroundVisible: value }, "background visibility")} /><OpacitySlider value={Number(this.currentOption("backgroundOpacity", 0.2))} onChange={(value) => this.patchOptions({ backgroundOpacity: value }, "background transparency")} /></div>
        {this.meta?.fc ? null : <div className={styles.sdRow}><Checkbox label="Reverse" checked={!!this.currentOption("reverse", false)} onChange={(value) => this.patchOptions({ reverse: value }, "reverse")} /></div>}
        <div className={styles.sdRow}><Checkbox label="Prices" checked={!!this.currentOption("showPrices", false)} onChange={(value) => this.patchOptions({ showPrices: value }, "prices visibility")} /></div>
        <div className={styles.sdRow}><Checkbox label="Levels" checked={!!this.currentOption("showLevels", false)} onChange={(value) => this.patchOptions({ showLevels: value }, "style")} /><Select items={FIB_LEVEL_MODES} value={String(this.currentOption("levelsMode", "values"))} onChange={(value) => this.patchOptions({ levelsMode: value }, "style")} className={styles.sdW100} /></div>
        <div className={styles.sdRow}><span className={cx(styles.sdLbl, styles.sdCw)}>Labels</span><Select items={H_ALIGN} value={String(this.currentOption("labelHAlign", "left"))} onChange={(value) => this.patchOptions({ labelHAlign: value }, "labels alignment")} className={styles.sdW100} /><Select items={V_ALIGN} value={String(this.currentOption("labelVAlign", this.meta?.fc ? "middle" : "top"))} onChange={(value) => this.patchOptions({ labelVAlign: value }, "labels alignment")} className={styles.sdW100} /></div>
        <div className={styles.sdRow}><span className={cx(styles.sdLbl, styles.sdCw)}>Font size</span><Select items={FIB_SIZES} value={String(this.currentOption("fontSize", 12))} onChange={(value) => this.patchOptions({ fontSize: Number(value) }, "labels font size")} className={styles.sdW100} /></div>
        {this.meta?.fc ? null : <div className={styles.sdRow}><Checkbox label="Fib levels based on log scale" checked={!!this.currentOption("logScale", false)} onChange={(value) => this.patchOptions({ logScale: value }, "log scale")} /></div>}
        <div className={styles.sdPad} />
      </>
    );
  }

  private renderChannelStyle() { return <div className={cx(styles.sdXrows, styles.sdPcrows)}><DialogRow label="Channel">{this.renderLineControls(undefined, { noEnds: true, noDash: true })}</DialogRow></div>; }
  private renderCurveStyle() { return <div className={cx(styles.sdXrows, styles.sdPcrows)}><DialogRow label="Line">{this.renderLineControls(undefined, { noChecker: true })}</DialogRow></div>; }
  private renderRectStyle() {
    const filled = Boolean(this.currentOption("filled", true));
    return <div className={cx(styles.sdXrows, styles.sdPcrows, this.meta?.selType === "polyline" && styles.sdPoly)}><DialogRow label="Border"><ColorButton color={this.state.style.lineColor} width={this.state.style.lineWidth} line thickness onChange={(color, _opacity, width) => this.patchStyle({ lineColor: color, ...(width !== undefined ? { lineWidth: width } : {}) }, "border color")} /></DialogRow><DialogRow label={<Checkbox label="Background" checked={filled} onChange={(value) => this.patchOptions({ filled: value }, "background visibility")} />}><ColorButton color={this.state.style.fillColor ?? (TYPE_STYLE[this.meta!.selType]?.fillColor as string) ?? "rgba(156, 39, 176, 0.2)"} onChange={(color, opacity) => this.patchStyle({ fillColor: composeColor(color, opacity) }, "background color")} className={bgColorButtonClass} checker disabled={!filled} /></DialogRow></div>;
  }
  private renderFlatStyle() { return <div className={cx(styles.sdXrows, styles.sdPcrows)}><DialogRow label="Line">{this.renderLineControls(undefined, { noChecker: true })}</DialogRow><DialogRow label={<Checkbox label="Prices" checked={!!this.currentOption("showPrices", false)} onChange={(value) => this.patchOptions({ showPrices: value }, "text visibility")} />}>{this.renderTextToolsRow("textColor", "textSize", "textBold", "textItalic", "text", "#FF9800")}</DialogRow><DialogRow label={<Checkbox label="Background" checked={!!this.currentOption("filled", false)} onChange={(value) => this.patchOptions({ filled: value }, "background visibility")} />}><ColorButton color={this.state.style.fillColor ?? "rgba(255, 152, 0, 0.2)"} onChange={(color, opacity) => this.patchStyle({ fillColor: composeColor(color, opacity) }, "background color")} className={bgColorButtonClass} checker disabled={!this.currentOption("filled", false)} /></DialogRow></div>; }
  private renderPitchforkStyle() { return <div className={cx(styles.sdXrows, styles.sdPfrows)}><DialogRow label={this.meta?.selType === "pitchfan" ? "Median" : <Checkbox label="Extend lines" checked={!!this.currentOption("extendLines", false)} onChange={(value) => this.patchOptions({ extendLines: value }, "extend lines")} /> }>{this.renderLineControls(undefined, { noEnds: true })}</DialogRow><DialogRow label="Use one color"><SimpleColorButton color={(((this.currentOption("levels", []) as Opts[])[0] ?? {}).color as string) ?? "#2962FF"} onChange={(color) => this.patchOptions({ levels: (this.currentOption("levels", []) as Opts[]).map((item) => ({ ...item, color })) }, "levels color")} className={oneColorButtonClass} /></DialogRow><DialogRow label={<Checkbox label="Background" checked={!!this.currentOption("backgroundVisible", false)} onChange={(value) => this.patchOptions({ backgroundVisible: value }, "background visibility")} />}><OpacitySlider value={Number(this.currentOption("backgroundOpacity", 0.2))} onChange={(value) => this.patchOptions({ backgroundOpacity: value }, "background transparency")} /></DialogRow>{this.meta?.selType === "pitchfan" ? null : <DialogRow label="Style"><Select items={PITCHFORK_STYLES} value={String(this.currentOption("variant", "original"))} onChange={(value) => this.patchOptions({ variant: value }, "style")} className={styles.sdPfstyle} /></DialogRow>}</div>; }
  private renderTimeZoneStyle() { return <div className={cx(styles.sdXrows, styles.sdPfrows, styles.sdTzrows)}><DialogRow label="Use one color"><SimpleColorButton color={(((this.currentOption("levels", []) as Opts[])[0] ?? {}).color as string) ?? "#2962FF"} onChange={(color) => this.patchOptions({ levels: (this.currentOption("levels", []) as Opts[]).map((item) => ({ ...item, color })) }, "levels color")} className={oneColorButtonClass} /></DialogRow><DialogRow label={<Checkbox label="Background" checked={!!this.currentOption("backgroundVisible", false)} onChange={(value) => this.patchOptions({ backgroundVisible: value }, "background visibility")} />}><OpacitySlider value={Number(this.currentOption("backgroundOpacity", 0.2))} onChange={(value) => this.patchOptions({ backgroundOpacity: value }, "background transparency")} /></DialogRow></div>; }
  private renderGannFanStyle() {
    const fillBackground = Boolean(this.currentOption("fillBackground", true));
    const showLabels = Boolean(this.currentOption("showLabels", true));
    return <div className={cx(styles.sdXrows, styles.sdPfrows, styles.sdTzrows)}><DialogRow label="Use one color"><SimpleColorButton color={(((this.currentOption("levels", []) as Opts[])[0] ?? {}).color as string) ?? "#2962FF"} onChange={(color) => this.patchOptions({ levels: (this.currentOption("levels", []) as Opts[]).map((item) => ({ ...item, color })) }, "levels color")} className={oneColorButtonClass} /></DialogRow><DialogRow label={<Checkbox label="Background" checked={fillBackground} onChange={(value) => this.patchOptions({ fillBackground: value }, "background visibility")} />}><OpacitySlider value={Number(this.currentOption("backgroundOpacity", 0.2))} onChange={(value) => this.patchOptions({ backgroundOpacity: value }, "background transparency")} /></DialogRow><DialogRow label={<Checkbox label="Labels" checked={showLabels} onChange={(value) => this.patchOptions({ showLabels: value }, "labels visibility")} />} /></div>;
  }
  private renderFibFanStyle() { return <div className={styles.sdXrows}><DialogRow label="Use one color"><SimpleColorButton color={(((this.currentOption("hlevels", []) as Opts[])[0] ?? {}).color as string) ?? "#2962FF"} onChange={(color) => this.patchOptions({ hlevels: (this.currentOption("hlevels", []) as Opts[]).map((item) => ({ ...item, color })), vlevels: (this.currentOption("vlevels", []) as Opts[]).map((item) => ({ ...item, color })) }, "levels color")} className={oneColorButtonClass} /></DialogRow></div>; }
  private renderGannBoxStyle() { return <div className={styles.sdXrows}><DialogRow label="Use one color"><SimpleColorButton color={(((this.currentOption("priceLevels", []) as Opts[])[0] ?? {}).color as string) ?? "#2962FF"} onChange={(color) => this.patchOptions({ priceLevels: (this.currentOption("priceLevels", []) as Opts[]).map((item) => ({ ...item, color })), timeLevels: (this.currentOption("timeLevels", []) as Opts[]).map((item) => ({ ...item, color })) }, "levels color")} className={oneColorButtonClass} /></DialogRow></div>; }
  private renderGannSquareFixedStyle() { return <div className={styles.sdXrows}><DialogRow label="Use one color"><SimpleColorButton color={(((this.currentOption("levels", []) as Opts[])[0] ?? {}).color as string) ?? "#2962FF"} onChange={(color) => this.patchOptions({ levels: (this.currentOption("levels", []) as Opts[]).map((item) => ({ ...item, color })), fanlines: (this.currentOption("fanlines", []) as Opts[]).map((item) => ({ ...item, color })), arcs: (this.currentOption("arcs", []) as Opts[]).map((item) => ({ ...item, color })) }, "color")} className={oneColorButtonClass} /></DialogRow></div>; }
  private renderPatternStyle() { return <div className={cx(styles.sdXrows, this.meta?.xnf && styles.sdXnf)}><DialogRow label="Label">{this.renderTextToolsRow("textColor", "fontSize", "bold", "italic", "label", "#ffffff")}</DialogRow><DialogRow label="Border"><ColorButton color={this.state.style.lineColor} width={this.state.style.lineWidth} line thickness onChange={(color, _opacity, width) => this.patchStyle({ lineColor: color, ...(width !== undefined ? { lineWidth: width } : {}) }, "border color")} /></DialogRow>{this.meta?.xnf ? null : <DialogRow label={<Checkbox label="Background" checked={!!this.currentOption("filled", false)} onChange={(value) => this.patchOptions({ filled: value }, "background visibility")} />}><ColorButton color={this.state.style.fillColor ?? "rgba(41, 98, 255, 0.15)"} onChange={(color, opacity) => this.patchStyle({ fillColor: composeColor(color, opacity) }, "background color")} className={bgColorButtonClass} checker disabled={!this.currentOption("filled", false)} /></DialogRow>}</div>; }
  private renderCycleStyle() { return <div className={cx(styles.sdXrows, styles.sdCy, this.meta?.tcy && styles.sdCyt)}><DialogRow label={this.meta?.tcy ? "Line" : "Lines"}><ColorButton color={this.state.style.lineColor} width={this.state.style.lineWidth} line thickness onChange={(color, _opacity, width) => this.patchStyle({ lineColor: color, ...(width !== undefined ? { lineWidth: width } : {}) }, "line color")} /><DashButton dash={this.state.style.lineDash} onChange={(lineDash) => this.patchStyle({ lineDash }, "line style")} /></DialogRow></div>; }
  private renderElliottStyle() {
    const showWave = Boolean(this.currentOption("showWave", true));
    return <div className={cx(styles.sdXrows, styles.sdEl)}><DialogRow label="Color"><ColorButton color={this.state.style.lineColor} onChange={(color, opacity) => this.patchStyle({ lineColor: composeColor(color, opacity) }, "color")} className={bgColorButtonClass} checker /></DialogRow><DialogRow label={<Checkbox label="Wave" checked={showWave} onChange={(value) => this.patchOptions({ showWave: value }, "line visibility")} />}><ThicknessButton value={this.state.style.lineWidth} onChange={(value) => this.patchStyle({ lineWidth: value }, "line width")} disabled={!showWave} /></DialogRow><DialogRow label="Degree"><Select items={ELLIOTT_DEGREES.map((label, index) => ({ value: String(index), label }))} value={String(this.currentOption("degree", 7))} onChange={(value) => this.patchOptions({ degree: Number(value) }, "degree")} className={styles.sdLw150} /></DialogRow></div>;
  }
  private renderPositionStyle() { return <div className={cx(styles.sdXrows, styles.sdLp)}><DialogRow label="Lines"><ColorButton color={this.state.style.lineColor} width={this.state.style.lineWidth} line thickness onChange={(color, _opacity, width) => this.patchStyle({ lineColor: color, ...(width !== undefined ? { lineWidth: width } : {}) }, "line color")} /></DialogRow><DialogRow label="Stop color"><ColorButton color={String(this.currentOption("stopBackground", "rgba(242, 54, 69, 0.2)"))} onChange={(color, opacity) => this.patchOptions({ stopBackground: composeColor(color, opacity) }, "stop color")} className={bgColorButtonClass} checker /></DialogRow><DialogRow label="Target color"><ColorButton color={String(this.currentOption("profitBackground", "rgba(8, 153, 129, 0.2)"))} onChange={(color, opacity) => this.patchOptions({ profitBackground: composeColor(color, opacity) }, "target color")} className={bgColorButtonClass} checker /></DialogRow><DialogRow label="Text">{this.renderTextToolsRow("textColor", "fontSize", "textBold", "textItalic", "font", "#ffffff")}</DialogRow><DialogRow label={<Checkbox label="Price labels" checked={!!this.currentOption("showPriceLabels", false)} onChange={(value) => this.patchOptions({ showPriceLabels: value }, "price labels visibility")} />} /><DialogRow label={<Checkbox label="Compact stats mode" checked={!!this.currentOption("compact", false)} onChange={(value) => this.patchOptions({ compact: value }, "compact stats mode")} />} /><DialogRow label={<Checkbox label="Always show stats" checked={!!this.currentOption("alwaysShowStats", false)} onChange={(value) => this.patchOptions({ alwaysShowStats: value }, "always show stats")} />} /></div>; }
  private renderPositionInputs() { const selected = this.selected(); const levels = selected?.levelPrices?.(); const format = selected?.formatPrice?.bind(selected) ?? ((value: number) => String(value)); return <div className={styles.sdLpin}><div className={styles.sdLprow} style={{ top: 24 }}><span className={styles.sdLbl}>Account size</span><NumberInput value={String(this.currentOption("accountSize", 1000))} className={cx(styles.sdNum, styles.sdLpnum)} step="1" onCommit={(value) => { const num = Number(value); if (!Number.isNaN(num)) this.patchOptions({ accountSize: num }, "account size"); }} /></div><div className={styles.sdLprow} style={{ top: 74 }}><span className={styles.sdLbl}>Lot size</span><NumberInput value={String(this.currentOption("lotSize", 1))} className={cx(styles.sdNum, styles.sdLpnum)} step="1" onCommit={(value) => { const num = Number(value); if (!Number.isNaN(num)) this.patchOptions({ lotSize: num }, "lot size"); }} /></div><div className={styles.sdLprow} style={{ top: 124 }}><span className={styles.sdLbl}>Risk</span><NumberInput value={Number(this.currentOption("risk", 25)).toFixed(2)} className={cx(styles.sdNum, styles.sdLpnum)} step="0.01" onCommit={(value) => { const num = Number(value); if (!Number.isNaN(num)) this.patchOptions({ risk: num }, "risk"); }} /><Select items={RISK_MODES} value={String(this.currentOption("riskDisplayMode", "percents"))} onChange={(value) => this.patchOptions({ riskDisplayMode: value }, "risk display mode")} className={styles.sdW100} /></div><div className={styles.sdLprow} style={{ top: 174 }}><span className={styles.sdLbl}>Entry price</span><NumberInput value={format(levels?.entry ?? 0)} className={cx(styles.sdNum, styles.sdLpnum)} step="0.01" onCommit={(value) => { const num = Number(value); if (!selected?.setLevelPrice || !Number.isFinite(num)) return; selected.setLevelPrice("entry", num); this.controller().changeSelected({}, "entry price"); this.setState((state) => ({ positionVersion: state.positionVersion + 1 })); }} /></div><div className={styles.sdLphead} style={{ top: 239 }}>PROFIT LEVEL</div><div className={styles.sdLprow} style={{ top: 270 }}><span className={styles.sdLbl}>Ticks</span><NumberInput value={String(this.currentOption("profitTicks", 0))} className={cx(styles.sdNum, styles.sdLpnum)} step="1" onCommit={(value) => { const num = Math.max(1, Math.round(Number(value))); if (Number.isFinite(num)) this.patchOptions({ profitTicks: num }, "profit level"); }} /></div><div className={styles.sdLprow} style={{ top: 320 }}><span className={styles.sdLbl}>Price</span><NumberInput value={format(levels?.profit ?? 0)} className={cx(styles.sdNum, styles.sdLpnum)} step="0.01" onCommit={(value) => { const num = Number(value); if (!selected?.setLevelPrice || !Number.isFinite(num)) return; selected.setLevelPrice("profit", num); this.controller().changeSelected({}, "profit level"); this.setState((state) => ({ positionVersion: state.positionVersion + 1 })); }} /></div><div className={styles.sdLphead} style={{ top: 385 }}>STOP LEVEL</div><div className={styles.sdLprow} style={{ top: 416 }}><span className={styles.sdLbl}>Ticks</span><NumberInput value={String(this.currentOption("stopTicks", 0))} className={cx(styles.sdNum, styles.sdLpnum)} step="1" onCommit={(value) => { const num = Math.max(1, Math.round(Number(value))); if (Number.isFinite(num)) this.patchOptions({ stopTicks: num }, "stop level"); }} /></div><div className={styles.sdLprow} style={{ top: 466 }}><span className={styles.sdLbl}>Price</span><NumberInput value={format(levels?.stop ?? 0)} className={cx(styles.sdNum, styles.sdLpnum)} step="0.01" onCommit={(value) => { const num = Number(value); if (!selected?.setLevelPrice || !Number.isFinite(num)) return; selected.setLevelPrice("stop", num); this.controller().changeSelected({}, "stop level"); this.setState((state) => ({ positionVersion: state.positionVersion + 1 })); }} /></div></div>; }
  private renderRegressionInputs() { return <div className={styles.sdRtin}><div className={styles.sdRtrow} style={{ top: 22.5 }}><span className={styles.sdLbl}>Upper Deviation</span><NumberInput value={String(this.currentOption("upperDeviation", ""))} className={cx(styles.sdNum, styles.sdRtnum)} step="0.1" onCommit={(value) => { const num = Number(value); if (value.trim() !== "" && Number.isFinite(num)) this.patchOptions({ upperDeviation: num }, "change Upper Deviation property"); }} /></div><div className={styles.sdRtrow} style={{ top: 72.5 }}><span className={styles.sdLbl}>Lower Deviation</span><NumberInput value={String(this.currentOption("lowerDeviation", ""))} className={cx(styles.sdNum, styles.sdRtnum)} step="0.1" onCommit={(value) => { const num = Number(value); if (value.trim() !== "" && Number.isFinite(num)) this.patchOptions({ lowerDeviation: num }, "change Lower Deviation property"); }} /></div><div className={styles.sdRtrow} style={{ top: 122.5 }}><Checkbox label="Use Upper Deviation" checked={!!this.currentOption("useUpper", false)} onChange={(value) => this.patchOptions({ useUpper: value }, "change Use Upper Deviation property")} /></div><div className={styles.sdRtrow} style={{ top: 156.5 }}><Checkbox label="Use Lower Deviation" checked={!!this.currentOption("useLower", false)} onChange={(value) => this.patchOptions({ useLower: value }, "change Use Lower Deviation property")} /></div><div className={styles.sdRtrow} style={{ top: 190.5 }}><span className={styles.sdLbl}>Source</span><Select items={REGRESSION_SOURCE_ITEMS} value={String(this.currentOption("source", "close"))} onChange={(value) => this.patchOptions({ source: value }, "change Source property")} className={styles.sdW100} /></div></div>; }
  private renderRegressionStyle() { return <div className={cx(styles.sdXrows, styles.sdPcrows)}><DialogRow label={<Checkbox label="Extend lines" checked={!!this.currentOption("extendLines", false)} onChange={(value) => this.patchOptions({ extendLines: value }, "extend lines")} />} /><DialogRow label={<Checkbox label="Pearson's R" checked={!!this.currentOption("showPearsons", false)} onChange={(value) => this.patchOptions({ showPearsons: value }, "show pearson's r")} />} /></div>; }
  private renderForecastStyle() { return <div className={cx(styles.sdXrows, styles.sdFc)}><DialogRow label="Line"><ColorButton color={this.state.style.lineColor} width={this.state.style.lineWidth} line thickness onChange={(color, _opacity, width) => this.patchStyle({ lineColor: color, ...(width !== undefined ? { lineWidth: width } : {}) }, "line color")} /></DialogRow></div>; }
  private renderBarsPatternStyle() { const modes = [{ value: "hl", label: "HL bars" }, { value: "oc", label: "OC bars" }, { value: "close", label: "Line - close" }, { value: "open", label: "Line - open" }, { value: "high", label: "Line - high" }, { value: "low", label: "Line - low" }, { value: "hl2", label: "Line - HL/2" }]; return <div className={cx(styles.sdXrows, styles.sdBp)}><DialogRow label="Color"><ColorButton color={this.state.style.lineColor} onChange={(color, opacity) => this.patchStyle({ lineColor: composeColor(color, opacity) }, "color")} className={bgColorButtonClass} checker /></DialogRow><DialogRow label="Mode"><Select items={modes} value={String(this.currentOption("mode", "hl"))} onChange={(value) => this.patchOptions({ mode: value }, "mode")} className={styles.sdBpsel} /></DialogRow><DialogRow label={<Checkbox label="Mirrored" checked={!!this.currentOption("mirrored", false)} onChange={(value) => this.patchOptions({ mirrored: value }, "mirrored")} />} /><DialogRow label={<Checkbox label="Flipped" checked={!!this.currentOption("flipped", false)} onChange={(value) => this.patchOptions({ flipped: value }, "flipped")} />} /></div>; }
  private renderProjectionStyle() { return <div className={cx(styles.sdXrows, styles.sdGfd)}><DialogRow label="Background"><ColorButton color={String(this.currentOption("color1", "rgba(41, 98, 255, 0.2)"))} onChange={(color, opacity) => this.patchOptions({ color1: composeColor(color, opacity) }, "change Projection background color 1")} className={bgColorButtonClass} checker /> <ColorButton color={String(this.currentOption("color2", "rgba(156, 39, 176, 0.2)"))} onChange={(color, opacity) => this.patchOptions({ color2: composeColor(color, opacity) }, "change Projection background color 2")} className={bgColorButtonClass} checker /></DialogRow><DialogRow label="Border"><ColorButton color={this.state.style.lineColor} width={this.state.style.lineWidth} line thickness onChange={(color, _opacity, width) => this.patchStyle({ lineColor: color, ...(width !== undefined ? { lineWidth: width } : {}) }, "line color")} /></DialogRow></div>; }
  private renderFrvpInputs() { return <div className={cx(styles.sdXrows, styles.sdGfd, styles.sdGhin, styles.sdFrin)}><DialogRow label="Rows Layout"><Select items={[{ value: "rows", label: "Number Of Rows" }, { value: "ticks", label: "Ticks Per Row" }]} value={String(this.currentOption("rowsLayout", "rows"))} onChange={(value) => this.patchOptions({ rowsLayout: value }, "change Rows Layout property")} className={styles.sdW100} /></DialogRow><DialogRow label="Row Size"><NumberInput value={String(this.currentOption("rows", ""))} className={styles.sdNum} step="1" onCommit={(value) => { const num = Math.round(Number(value)); if (value.trim() !== "" && Number.isFinite(num) && num >= 1 && num <= 1000) this.patchOptions({ rows: num }, "change Row Size property"); }} /></DialogRow><DialogRow label="Volume"><Select items={[{ value: "updown", label: "Up/Down" }, { value: "total", label: "Total" }, { value: "delta", label: "Delta" }]} value={String(this.currentOption("volume", "updown"))} onChange={(value) => this.patchOptions({ volume: value }, "change Volume property")} className={styles.sdW100} /></DialogRow><DialogRow label="Value Area Volume"><NumberInput value={String(this.currentOption("vaVolume", ""))} className={styles.sdNum} step="1" onCommit={(value) => { const num = Math.round(Number(value)); if (value.trim() !== "" && Number.isFinite(num) && num >= 1 && num <= 100) this.patchOptions({ vaVolume: num }, "change Value Area Volume property"); }} /></DialogRow></div>; }
  private renderFrvpStyle() { return <div className={cx(styles.sdXrows, styles.sdGfd, styles.sdFrst, styles.sdPflv)}><DialogRow label={<Checkbox label="Volume profile" checked={!!this.currentOption("showProfile", false)} onChange={(value) => this.patchOptions({ showProfile: value }, "change Volume profile visibility")} />} /><DialogRow label={<Checkbox label="Values" checked={!!this.currentOption("showValues", false)} onChange={(value) => this.patchOptions({ showValues: value }, "change Values visibility")} />}><ColorButton color={String(this.currentOption("valuesColor", "#424242"))} onChange={(color, opacity) => this.patchOptions({ valuesColor: composeColor(color, opacity) }, "change Values color")} className={bgColorButtonClass} checker disabled={!this.currentOption("showValues", false)} /></DialogRow></div>; }
  private renderGhostInputs() { return <div className={cx(styles.sdXrows, styles.sdGfd, styles.sdGhin)}><DialogRow label="Avg HL in minticks"><NumberInput value={String(this.currentOption("averageHL", ""))} className={styles.sdNum} step="1" onCommit={(value) => { const num = Math.round(Number(value)); if (value.trim() !== "" && Number.isFinite(num) && num >= 1) this.patchOptions({ averageHL: num }, "change Ghost Feed average HL value"); }} /></DialogRow><DialogRow label="Variance"><NumberInput value={String(this.currentOption("variance", ""))} className={styles.sdNum} step="1" onCommit={(value) => { const num = Math.round(Number(value)); if (value.trim() !== "" && Number.isFinite(num) && num >= 0) this.patchOptions({ variance: num }, "change Ghost Feed variance value"); }} /></DialogRow></div>; }
  private renderGhostStyle() { return <div className={cx(styles.sdXrows, styles.sdGfd)}><DialogRow label="Candles"><ColorButton color={String(this.currentOption("upColor", "#ACE5DC"))} onChange={(color, opacity) => this.patchOptions({ upColor: composeColor(color, opacity) }, "change Ghost Feed up color")} className={bgColorButtonClass} checker /> <ColorButton color={String(this.currentOption("downColor", "#FAA1A4"))} onChange={(color, opacity) => this.patchOptions({ downColor: composeColor(color, opacity) }, "change Ghost Feed down color")} className={bgColorButtonClass} checker /></DialogRow><DialogRow label={<Checkbox label="Borders" checked={!!this.currentOption("drawBorder", false)} onChange={(value) => this.patchOptions({ drawBorder: value }, "change Ghost Feed borders")} />}><ColorButton color={String(this.currentOption("borderUpColor", "#089981"))} onChange={(color, opacity) => this.patchOptions({ borderUpColor: composeColor(color, opacity) }, "change Ghost Feed border up color")} className={bgColorButtonClass} checker disabled={!this.currentOption("drawBorder", false)} /> <ColorButton color={String(this.currentOption("borderDownColor", "#F23645"))} onChange={(color, opacity) => this.patchOptions({ borderDownColor: composeColor(color, opacity) }, "change Ghost Feed border down color")} className={bgColorButtonClass} checker disabled={!this.currentOption("drawBorder", false)} /></DialogRow><DialogRow label={<Checkbox label="Wick" checked={!!this.currentOption("drawWick", false)} onChange={(value) => this.patchOptions({ drawWick: value }, "change Ghost Feed wick")} />}><ColorButton color={String(this.currentOption("wickColor", "#787B86"))} onChange={(color, opacity) => this.patchOptions({ wickColor: composeColor(color, opacity) }, "change Ghost Feed wick color")} className={bgColorButtonClass} checker disabled={!this.currentOption("drawWick", false)} /></DialogRow><DialogRow label="Transparency"><OpacitySlider value={Number(this.currentOption("transparency", 50)) / 100} onChange={(value) => this.patchOptions({ transparency: 100 - Math.round(value * 100) }, "change Ghost Feed transparency")} className={styles.sdOpac} checker inverted /></DialogRow></div>; }
  private renderRangeStyle() {
    const fillBackground = Boolean(this.currentOption("fillBackground", true));
    return <div className={cx(styles.sdXrows, styles.sdRg)}><DialogRow label="Line"><ColorButton color={this.state.style.lineColor} width={this.state.style.lineWidth} line thickness onChange={(color, _opacity, width) => this.patchStyle({ lineColor: color, ...(width !== undefined ? { lineWidth: width } : {}) }, "line color")} /></DialogRow><DialogRow label={<Checkbox label="Background" checked={fillBackground} onChange={(value) => this.patchOptions({ fillBackground: value }, "background visibility")} />}><ColorButton color={this.state.style.fillColor ?? "rgba(41, 98, 255, 0.15)"} onChange={(color, opacity) => this.patchStyle({ fillColor: composeColor(color, opacity) }, "background color")} className={bgColorButtonClass} checker disabled={!fillBackground} /></DialogRow><DialogRow label="Label"><ColorButton color={String(this.currentOption("labelColor", "#000000"))} onChange={(color, opacity) => this.patchOptions({ labelColor: composeColor(color, opacity) }, "label text color")} className={textColorButtonClass} checker /><Select items={SIZES} value={String(this.currentOption("labelSize", 12))} onChange={(value) => this.patchOptions({ labelSize: Number(value) }, "label font size")} className={styles.sdW100} /></DialogRow></div>;
  }
  private renderRangeText() { const text = (this.currentOption("customText", {}) as Opts); const enabled = !!text.visible; return <><div className={cx(styles.sdTrow, styles.sdPntext)}><Checkbox label="Text" checked={enabled} onChange={(value) => this.patchOptions({ customText: { ...text, visible: value } }, "text visibility")} />{this.renderTextToolsRow("color", "fontSize", "bold", "italic", "text", String(text.color ?? "#2962FF"), styles.sdW100, !enabled)}</div><textarea className={cx(styles.sdArea, styles.sdPntext)} disabled={!enabled} value={String(text.text ?? "")} onFocus={() => { this.rangeTextBefore = String(text.text ?? ""); }} onChange={(event) => { const value = event.target.value; const next = { ...text, text: value }; this.setState((state) => ({ options: { ...state.options, customText: next } })); this.livePreviewRangeText(value); }} onBlur={() => { const current = this.currentOption("customText", {}) as Opts; const value = String(current.text ?? ""); if (value !== this.rangeTextBefore) { this.rangeTextBefore = value; this.patchOptions({ customText: { ...current, text: value } }, "text"); } }} /></>; }

  private renderInputsTab(): ReactNode {
    if (this.meta?.fv) return this.renderFrvpInputs();
    if (this.meta?.gh) return this.renderGhostInputs();
    if (this.meta?.rt) return this.renderRegressionInputs();
    return this.renderPositionInputs();
  }

  render() {
    if (!this.state.ready || !this.meta) return null;
    const body = this.state.tab === "Style" ? this.renderStyleTab() : this.state.tab === "Text" ? this.renderTextTab() : this.state.tab === "Coordinates" ? this.renderCoordinatesTab() : this.state.tab === "Visibility" ? this.renderVisibilityTab() : this.renderInputsTab();
    return <DialogFrame title={this.meta.title} tabs={this.meta.tabs} activeTab={this.state.tab} onTab={this.setTab} onClose={() => this.finish(true)} body={body} footer={this.renderFooter()} style={this.state.dialogStyle} dialogClassName={this.meta.dialogClassName} hidePencil={this.meta.fv} dialogRef={this.setDialogRef} />;
  }
}
