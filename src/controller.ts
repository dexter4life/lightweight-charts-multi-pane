import { DrawingTools } from "lightweight-charts-multi-pane";
import { CYCLE_DEFAULT_STYLE, ELLIOTT_DEFAULT_STYLE, PATTERN_DEFAULT_STYLE, RANGE_DEFAULT_STYLE, RANGE_TYPES } from "./data/pattern-types";
import type { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts-multi-pane";

import { ALL_ITEMS } from "./data/tool-groups";

type Drawing = DrawingTools.Drawing;
type Anchor = DrawingTools.Anchor;
type Serialized = DrawingTools.SerializedDrawing;

export const CURSOR = "cursor_cross";
const PREVIEW_ID = "__preview__";
/** The finished Measure ruler: shown until the next click, never part of the drawings or their history. */
const MEASURE_ID = "__measure__";
const isTransient = (id: string) => id === PREVIEW_ID || id === MEASURE_ID;
const DRAG_THRESHOLD = 3;
const MAX_HISTORY = 100;
const ZOOM_STEP = 1.222;
const DEFAULT_BAR_SPACING = 6;
const DEFAULT_RIGHT_OFFSET = 9;

export interface ToolInfo {
  id: string;
  type: string | null;
  label: string;
}

/** UI tool id -> registry tool type. */
export const TOOLS: Record<string, ToolInfo> = {
  measure: { id: "measure", type: "measure", label: "Measure" },
  zoom_in: { id: "zoom_in", type: null, label: "Zoom In" },
  emoji: { id: "emoji", type: "emoji", label: "Emoji" },
  sticker: { id: "sticker", type: "sticker", label: "Sticker" },
  ...Object.fromEntries(ALL_ITEMS.map((i) => [i.id, { id: i.id, type: i.type, label: i.label }])),
};

export const ERASER = "cursor_eraser";
const CURSOR_IDS = new Set(["cursor_cross", "cursor_dot", "cursor_arrow", "cursor_demo", ERASER]);
export const isCursorTool = (id: string) => CURSOR_IDS.has(id);

const svgCursor = (svg: string, x: number, y: number, fallback: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;
const CURSOR_CSS: Record<string, string> = {
  cursor_cross: "crosshair",
  cursor_arrow: "default",
  cursor_demo: "default",
  cursor_dot: svgCursor('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="3" fill="#131722" stroke="#fff" stroke-width="1"/></svg>', 8, 8, "default"),
  [ERASER]: svgCursor(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 28 28" fill="#fff" stroke="#131722" stroke-width="1.4" stroke-linejoin="round"><path d="M7 17l8-9 6 5-6 7H10z"/><path d="M10 20h11"/></svg>',
    4, 20, "default",
  ),
};


const labelFor = (type: string) =>
  Object.values(TOOLS).find((t) => t.type === type)?.label ?? type;

export type HideMode = "none" | "drawings" | "indicators" | "all";

export type MagnetMode = "off" | "weak" | "strong";

export interface ControllerState {
  tool: string;
  stay: boolean;
  magnet: MagnetMode;
  /** The strength the magnet button applies when switched on (kept while it is off). */
  magnetKind: Exclude<MagnetMode, "off">;
  locked: boolean;
  hidden: boolean;
  hideMode: HideMode;
  /** What the hide button applies when switched on (kept while it is off). */
  hideKind: Exclude<HideMode, "none">;
  count: number;
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  /** Number of zoom-in steps that Zoom Out can still step back through. */
  zoomDepth: number;
}

interface ViewState {
  range: { from: number; to: number } | null;
  price: { from: number; to: number } | null;
  autoScale: boolean;
}

interface Snapshot {
  drawings: Serialized[];
  label: string;
  /** A zoom step: the view is restored without touching the drawings. */
  zoom?: { kind: "in" | "out"; before: ViewState; after: ViewState; pill?: boolean };
  /** A non-drawing change (resolution, date range) that undoes and redoes itself. */
  action?: { undo: () => void; redo: () => void };
}

/** Per-tool style baselines that differ from the generic blue line. */
export const TYPE_STYLE: Record<string, Partial<DrawingTools.DrawingStyle>> = {
  "fib-retracement": { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] },
  "fib-extension": { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] },
  "fib-channel": { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] },
  "gann-box": { lineColor: "#787B86", lineWidth: 1, lineDash: [] },
  "gann-square-fixed": { lineColor: "#787B86", lineWidth: 1, lineDash: [] },
  "gann-square": { lineColor: "#787B86", lineWidth: 1, lineDash: [] },
  "gann-fan": { lineColor: "#00bcd4", lineWidth: 1, lineDash: [] },
  "fib-speed-fan": { lineColor: "#787B86", lineWidth: 1, lineDash: [] },
  "fib-time-zone": { lineColor: "#808080", lineWidth: 1, lineDash: [6, 6] },
  "fib-circles": { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] },
  "fib-time-extension": { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] },
  "flat-top-bottom": { lineColor: "#FF9800", fillColor: "rgba(255, 152, 0, 0.2)" },
  "disjoint-channel": { lineColor: "#089981", fillColor: "rgba(8, 153, 129, 0.2)" },
  brush: { lineColor: "#00BCD4", lineWidth: 1, fillColor: "rgba(0, 188, 212, 0.5)" },
  highlighter: { lineColor: "rgba(242, 54, 69, 0.2)" },
  ...Object.fromEntries(Object.entries(PATTERN_DEFAULT_STYLE).map(([k, v]) => [k, { ...v, lineWidth: 1 }])),
  ...Object.fromEntries(Object.entries(ELLIOTT_DEFAULT_STYLE).map(([k, v]) => [k, { ...v, lineWidth: 1 }])),
  ...Object.fromEntries(Object.entries(CYCLE_DEFAULT_STYLE).map(([k, v]) => [k, { ...v, lineWidth: 1, lineDash: [] }])),
  ...Object.fromEntries([...RANGE_TYPES].map((k) => [k, { ...RANGE_DEFAULT_STYLE, lineWidth: 1, lineDash: [] }])),
  forecast: { lineColor: "#2962FF", lineWidth: 1, lineDash: [] },
  "bars-pattern": { lineColor: "#2962FF", lineWidth: 2, lineDash: [] },
  "ghost-feed": { lineColor: "#787B86", lineWidth: 1, lineDash: [] },
  projection: { lineColor: "#9598A1", lineWidth: 1, lineDash: [] },
  "fixed-range-volume-profile": { lineColor: "#787B86", lineWidth: 1, lineDash: [] },
  "andrews-pitchfork": { lineColor: "#F23645", lineWidth: 1, lineDash: [] },
  "schiff-pitchfork": { lineColor: "#F23645", lineWidth: 1, lineDash: [] },
  "modified-schiff-pitchfork": { lineColor: "#F23645", lineWidth: 1, lineDash: [] },
  "inside-pitchfork": { lineColor: "#F23645", lineWidth: 1, lineDash: [] },
  circle: { lineColor: "#F19D38", lineWidth: 1, lineDash: [], fillColor: "rgba(241, 157, 56, 0.2)" },
  ellipse: { lineColor: "#DF484C", lineWidth: 1, lineDash: [], fillColor: "rgba(223, 72, 76, 0.2)" },
  triangle: { lineColor: "#459782", lineWidth: 1, lineDash: [], fillColor: "rgba(69, 151, 130, 0.2)" },
  curve: { lineColor: "#2962FF", lineWidth: 1, lineDash: [], fillColor: "rgba(41, 98, 255, 0.2)" },
  "double-curve": { lineColor: "#613CB1", lineWidth: 1, lineDash: [], fillColor: "rgba(97, 60, 177, 0.2)" },
  polyline: { lineColor: "#55B9D1", lineWidth: 1, lineDash: [], fillColor: "rgba(40, 185, 205, 0.2)" },
  arc: { lineColor: "#D63865", lineWidth: 1, lineDash: [], fillColor: "rgba(205, 40, 100, 0.2)" },
  "rotated-rectangle": { lineColor: "#67AD5C", lineWidth: 1, lineDash: [], fillColor: "rgba(103, 173, 92, 0.2)" },
  rectangle: { lineColor: "#9c27b0", lineWidth: 1, lineDash: [], fillColor: "rgba(156, 39, 176, 0.2)" },
  "fib-wedge": { lineColor: "#808080", lineWidth: 1, lineDash: [] },
  "fib-arcs": { lineColor: "#787B86", lineWidth: 1, lineDash: [6, 6] },
  "fib-spiral": { lineColor: "#00bcd4", lineWidth: 1, lineDash: [] },
  pitchfan: { lineColor: "#F23645", lineWidth: 1, lineDash: [] },
  note: { lineColor: "#3861F6" },
  pin: { lineColor: "#3861F6" },
  signpost: { lineColor: "#797B85" },
  callout: { lineColor: "#0097A7" },
  comment: { lineColor: "#2962FF" },
  "price-label": { lineColor: "#2962FF" },
  "price-note": { lineColor: "#2962FF", lineWidth: 1 },
  "arrow-marker": { lineColor: "#1E53E5", lineWidth: 1 },
  "arrow-mark-up": { lineColor: "#089981", lineWidth: 1 },
  "arrow-mark-down": { lineColor: "#CC2F3C", lineWidth: 1 },
  "arrow-mark-left": { lineColor: "#2962FF", lineWidth: 1 },
  "arrow-mark-right": { lineColor: "#2962FF", lineWidth: 1 },
  "flag-mark": { lineColor: "#2962FF", lineWidth: 1 },
  "long-position": { lineColor: "#787B86", lineWidth: 1 },
  "short-position": { lineColor: "#787B86", lineWidth: 1 },
};

/** Tools that are plain text labels and open their dialog as soon as they are placed. */
export const TEXT_TYPES = new Set(["text-annotation", "anchored-text"]);
export const NOTE_TYPES = new Set(["note", "pin"]);
const OPEN_ON_PLACE = new Set(["signpost", "callout", "comment"]);

/** Option keys that describe one particular position, not a default for the next one. */
const PER_DRAWING_OPTIONS = ["text", "profitTicks", "stopTicks", "tickSize", "variant", "scaleRatio", "source", "averageHL", "seed"];

/** Freehand tools collect a stroke while the mouse is down and stay armed afterwards. */
const FREEHAND = new Set(["brush", "highlighter"]);
/** Multi-click tools: every click adds a point and a double-click finishes. */
const VARIABLE = new Set(["path", "polyline", "ghost-feed"]);
/** Variable tools that can be closed by clicking their first point again. */
const CLOSABLE = new Set(["polyline"]);
const CLOSE_RADIUS = 6;
/** The stored start of a stroke sits this far along the path from the mouse-down point. */
const STROKE_INSET = 3.5;

const DEFAULTS_KEY = "chartlab.drawingDefaults";

function loadDefaults(): Record<string, { style?: Partial<DrawingTools.DrawingStyle>; options?: Record<string, unknown> }> {
  try {
    return JSON.parse(localStorage.getItem(DEFAULTS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export interface LinesBinding {
  priceLine(): boolean;
  highLow(): boolean;
  togglePriceLine(): void;
  toggleHighLow(): void;
}

export class DrawingController {
  readonly manager = new DrawingTools.DrawingManager();
  private readonly registry = DrawingTools.getToolRegistry();
  private tool = CURSOR;
  /** The cursor mode (cross, dot or arrow) that Escape and finished drawings return to. */
  private cursorKind = CURSOR;
  private stay = false;
  private magnet: MagnetMode = "off";
  private magnetKind: Exclude<MagnetMode, "off"> = "weak";
  /** Holding the modifier key flips the magnet for as long as it is down. */
  private magnetFlipped = false;
  private locked = false;
  private hideMode: HideMode = "none";
  private hideKind: Exclude<HideMode, "none"> = "drawings";
  private pending: Anchor[] = [];
  /** Screen positions of `pending`, so a double-click does not add its point twice. */
  private pendingPts: Array<{ x: number; y: number }> = [];
  private preview: Drawing | null = null;
  private hoverId: string | null = null;
  private idSeq = 0;
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private listeners = new Set<() => void>();
  private zoomBox: HTMLDivElement | null = null;
  private zoomViews: ViewState[] = [];
  private clipboard: Serialized[] = [];
  private lines: LinesBinding | null = null;
  private lockedTime: number | null = null;

  private down: { x: number; y: number; moved: boolean } | null = null;
  private stroke: Anchor[] = [];
  private disposers: Array<() => void> = [];
  /** The symbol picked in the Icon/Emoji panel; it is stamped on the next placement. */
  private glyphPick: Record<string, Record<string, unknown>> = {};
  private defaults: Record<string, { style?: Partial<DrawingTools.DrawingStyle>; options?: Record<string, unknown> }> = loadDefaults();

  constructor(
    private readonly chart: IChartApi,
    private readonly series: ISeriesApi<SeriesType>,
    private readonly host: HTMLElement,
    private readonly volumeSeries?: ISeriesApi<SeriesType>,
  ) {
    this.manager.attach(chart, series, host);
    this.past = [{ drawings: [], label: "" }];

    this.manager.on("drawing:added", (e) => {
      const d = e.drawingId ? (this.manager.getDrawing(e.drawingId) as unknown as { setInterval?: (u: string, m: number) => void; finalizePlacement?: () => void }) : null;
      d?.setInterval?.("days", 1);
      d?.finalizePlacement?.();
      this.afterChange(e.drawingId, "create");
    });
    this.manager.on("drawing:removed", (e) => this.afterChange(e.drawingId, "remove"));
    this.manager.on("drawing:committed", (e) => this.afterChange(e.drawingId, "move", e.pointIndex));
    this.manager.on("drawing:selected", () => this.emit());
    this.manager.on("drawing:deselected", () => this.emit());
    this.manager.on("drawing:updated", () => this.emit());

    this.applyCursor();
    host.addEventListener("mousedown", this.onDown, true);
    host.addEventListener("mousemove", this.onMove);
    chart.subscribeCrosshairMove(this.holdCursor as never);
    host.addEventListener("mouseup", this.onUp, true);
    host.addEventListener("mouseleave", this.onLeave);
    host.addEventListener("dblclick", this.onDblClick);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keydown", this.onMagnetKey, true);
    window.addEventListener("keyup", this.onMagnetKey, true);
    window.addEventListener("blur", this.onMagnetBlur);
    window.addEventListener("keydown", this.forwardAlt, true);
    window.addEventListener("keyup", this.forwardAlt, true);
    window.addEventListener("blur", this.forwardAlt);
    this.disposers.push(() => {
      window.removeEventListener("keydown", this.forwardAlt, true);
      window.removeEventListener("keyup", this.forwardAlt, true);
      window.removeEventListener("blur", this.forwardAlt);
      window.removeEventListener("keydown", this.onMagnetKey, true);
      window.removeEventListener("keyup", this.onMagnetKey, true);
      window.removeEventListener("blur", this.onMagnetBlur);
      host.removeEventListener("mousedown", this.onDown, true);
      host.removeEventListener("mousemove", this.onMove);
      chart.unsubscribeCrosshairMove(this.holdCursor as never);
      host.removeEventListener("mouseup", this.onUp, true);
      host.removeEventListener("mouseleave", this.onLeave);
      host.removeEventListener("dblclick", this.onDblClick);
      window.removeEventListener("keydown", this.onKey);
    });
  }

  // ---------- state ----------

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  getState(): ControllerState {
    const undo = this.past.length > 1 ? this.past[this.past.length - 1] : null;
    const redo = this.future.length ? this.future[this.future.length - 1] : null;
    return {
      tool: this.tool,
      stay: this.stay,
      magnet: this.magnet,
      magnetKind: this.magnetKind,
      locked: this.locked,
      hidden: this.hideMode === "drawings" || this.hideMode === "all",
      hideMode: this.hideMode,
      hideKind: this.hideKind,
      count: this.real().length,
      selectedId: this.manager.getSelectedDrawing()?.id ?? null,
      canUndo: !!undo,
      canRedo: !!redo,
      undoLabel: undo?.label ?? null,
      redoLabel: redo?.label ?? null,
      zoomDepth: this.zoomViews.length,
    };
  }

  private real() {
    return this.manager.getAllDrawings().filter((d) => !isTransient(d.id));
  }

  // ---------- public actions ----------

  setTool(id: string, keepSelection = false) {
    if (this.tool === id) return;
    const info = TOOLS[id];
    if (!info || (!info.type && !isCursorTool(id) && id !== "zoom_in")) return;
    this.clearMeasure();
    this.cancelPlacement();
    if (!keepSelection) this.manager.deselectAll();
    this.tool = id;
    if (isCursorTool(id) && id !== ERASER) this.cursorKind = id;
    this.manager.setActiveTool(info.type ?? null);
    this.applyCursor();
    this.emit();
  }

  /** Picks a symbol from the Icon/Emoji panel and arms the tool that places it. */
  armGlyph(kind: "icon" | "emoji" | "sticker", value: number | string) {
    this.glyphPick[kind] = kind === "icon" ? { icon: value } : kind === "sticker" ? { sticker: value } : { emoji: value };
    this.setTool(kind);
  }

  /** Back to the user's chosen cursor mode, e.g. after a drawing is finished. */
  private returnToCursor(keepSelection = false) {
    this.setTool(this.cursorKind, keepSelection);
  }

  private applyCursor(hovering = false) {
    // A drawing tool keeps the pointer of the cursor mode the user picked.
    const kind = CURSOR_CSS[this.tool] ?? (this.info?.type ? CURSOR_CSS[this.cursorKind] : undefined);
    this.host.style.cursor = this.tool === CURSOR && hovering ? "pointer" : (kind ?? "");
    // Crosshair type 3 is the library's Demonstration highlight (with an Alt+drag trail); -1 is none of its markers, as the other cursors use the CSS pointer.
    this.chart.applyOptions({ crosshair: { mode: this.crosshairHidden ? 2 : 0, type: this.cursorKind === "cursor_demo" && !this.crosshairHidden ? 3 : -1 } } as never);
  }

  /** Whether the crosshair is hidden, as with the arrow cursor and the eraser. */
  private get crosshairHidden() {
    return this.tool === "cursor_arrow" || this.tool === ERASER;
  }

  setStay(v: boolean) {
    this.stay = v;
    this.emit();
  }

  setMagnet(mode: MagnetMode) {
    this.magnet = mode;
    if (mode !== "off") this.magnetKind = mode;
    this.applyMagnet();
    this.emit();
  }

  /** The toolbar button: switch the magnet on at its last strength, or off. */
  toggleMagnet() {
    this.setMagnet(this.magnet === "off" ? this.magnetKind : "off");
  }

  private applyMagnet() {
    const on = (this.magnet !== "off") !== this.magnetFlipped;
    this.manager.setMagnetMode(on ? this.magnetKind : "off");
  }

  /** False while another chart in a multi-chart grid is the active one. */
  keysEnabled = true;

  private onMagnetKey = (e: KeyboardEvent) => {
    if (!this.keysEnabled) return;
    const key = /Mac|iPhone|iPad/.test(navigator.platform) ? "Meta" : "Control";
    if (e.key !== key) return;
    this.magnetFlipped = e.type === "keydown";
    this.applyMagnet();
  };

  private onMagnetBlur = () => {
    if (!this.magnetFlipped) return;
    this.magnetFlipped = false;
    this.applyMagnet();
  };

  /** The library only tracks Alt on the focused plot; the Demonstration trail needs it wherever the pointer is. */
  private forwardAlt = (e: Event) => {
    // Our own dispatched events are untrusted, and window's capture listeners see them too.
    if (this.cursorKind !== "cursor_demo" || !e.isTrusted) return;
    if (e instanceof KeyboardEvent && e.key !== "Alt") return;
    const alt = e.type !== "blur" && (e as KeyboardEvent | MouseEvent).altKey;
    for (const canvas of this.host.querySelectorAll("canvas[tabindex]")) {
      canvas.dispatchEvent(new KeyboardEvent(alt ? "keydown" : "keyup", { key: "Alt", code: "AltLeft", altKey: alt }));
    }
  };

  setLocked(v: boolean) {
    this.locked = v;
    this.manager.setAllLocked(v);
    this.emit();
  }

  setHideMode(mode: HideMode) {
    this.hideMode = mode;
    if (mode !== "none") this.hideKind = mode;
    this.manager.setAllVisible(!(mode === "drawings" || mode === "all"));
    this.emit();
  }

  toggleHide() {
    this.setHideMode(this.hideMode === "none" ? this.hideKind : "none");
  }

  removeAll() {
    this.clearMeasure();
    if (!this.real().length) return;
    this.cancelPlacement();
    this.manager.clearAll();
    this.pushHistory("remove drawings");
    this.emit();
  }

  removeSelected() {
    const sel = this.manager.getSelectedDrawing();
    if (!sel || sel.options.locked) return;
    this.manager.removeDrawing(sel.id);
  }

  /** Drawings for the object tree, newest first. */
  listObjects(): { id: string; label: string; type: string; locked: boolean; visible: boolean }[] {
    return this.real()
      .map((d) => {
        const type = this.lastType.get(d.id) ?? d.type;
        return { id: d.id, label: labelFor(type), type, locked: !!d.options.locked, visible: d.options.visible !== false };
      })
      .reverse();
  }

  selectObject(id: string) {
    if (this.manager.getSelectedDrawing()?.id === id) return;
    this.manager.selectDrawing(id);
  }

  toggleObjectLock(id: string) {
    const d = this.manager.getAllDrawings().find((x) => x.id === id);
    if (!d) return;
    const lock = !d.options.locked;
    d.updateOptions({ locked: lock });
    this.pushHistory(`${lock ? "lock" : "unlock"} objects`);
    this.emit();
  }

  toggleObjectVisible(id: string) {
    const d = this.manager.getAllDrawings().find((x) => x.id === id);
    if (!d) return;
    const show = d.options.visible === false;
    this.manager.setDrawingVisible(id, show);
    this.pushHistory(`${show ? "show" : "hide"} objects`);
    this.emit();
  }

  removeObject(id: string) {
    if (!this.manager.getAllDrawings().some((x) => x.id === id)) return;
    this.suspendHistory = true;
    this.manager.removeDrawing(id);
    this.suspendHistory = false;
    this.pushHistory("remove objects");
    this.emit();
  }

  getSelected(): DrawingTools.IDrawing | null {
    return this.manager.getSelectedDrawing() ?? null;
  }

  updateSelectedStyle(patch: Partial<DrawingTools.DrawingStyle>) {
    const sel = this.getSelected();
    if (!sel) return;
    const type = this.lastType.get(sel.id);
    const uniform = sel as unknown as {
      applyUniformStyle?: (p: { color?: string; width?: number; dash?: number[] }) => void;
      fibOptions?: Record<string, unknown>;
      pitchforkOptions?: Record<string, unknown>;
      gannOptions?: Record<string, unknown>;
    };
    if (uniform.applyUniformStyle) {
      // Fib-like tools recolour the trend line and every level at once from the floating toolbar.
      uniform.applyUniformStyle({ color: patch.lineColor, width: patch.lineWidth, dash: patch.lineDash });
      const opts = uniform.pitchforkOptions ?? uniform.fibOptions ?? uniform.gannOptions;
      if (type) this.remember(type, { style: sel.style, options: { levels: opts?.levels, levelsWidth: opts?.levelsWidth, hlevels: opts?.hlevels, vlevels: opts?.vlevels, grid: opts?.grid, priceLevels: opts?.priceLevels, timeLevels: opts?.timeLevels, fanlines: opts?.fanlines, arcs: opts?.arcs } });
      this.pushHistory(`change line tool(s) ${patch.lineColor !== undefined ? "color" : patch.lineWidth !== undefined ? "line width" : "line style"}`);
      this.emit();
      return;
    }
    sel.updateStyle(patch);
    if (type) this.remember(type, { style: patch });
    this.pushHistory(`change line tool(s) ${patch.lineColor !== undefined ? "color" : patch.lineWidth !== undefined ? "line width" : "line style"}`);
    this.emit();
  }

  /** Background colour from the floating toolbar's "Line tool backgrounds" button. */
  updateSelectedFill(color: string, _opacity: number) {
    const sel = this.getSelected();
    if (!sel) return;
    sel.updateStyle({ fillColor: color });
    const type = this.lastType.get(sel.id);
    if (type) this.remember(type, { style: { fillColor: color } });
    this.pushHistory("change line tool(s) background color");
    this.emit();
  }

  /** Applies a live settings change to the selected drawing and records one undo step labelled like "change Trend Line {label}". */
  changeSelected(patch: { style?: Partial<DrawingTools.DrawingStyle>; options?: Record<string, unknown> }, label: string) {
    const sel = this.getSelected();
    if (!sel) return;
    if (patch.style) sel.updateStyle(patch.style);
    if (patch.options) {
      const d = sel as unknown as {
        setTrendLineOptions?: (o: Record<string, unknown>) => void;
        setFibOptions?: (o: Record<string, unknown>) => void;
        setBrushOptions?: (o: Record<string, unknown>) => void;
        setHighlighterOptions?: (o: Record<string, unknown>) => void;
        setTextOptions?: (o: Record<string, unknown>) => void;
        setNoteOptions?: (o: Record<string, unknown>) => void;
        setSignpostOptions?: (o: Record<string, unknown>) => void;
        setCalloutOptions?: (o: Record<string, unknown>) => void;
        setCommentOptions?: (o: Record<string, unknown>) => void;
        setPriceLabelOptions?: (o: Record<string, unknown>) => void;
        setPriceNoteOptions?: (o: Record<string, unknown>) => void;
        setArrowMarkerOptions?: (o: Record<string, unknown>) => void;
        setArrowMarkOptions?: (o: Record<string, unknown>) => void;
        setFlagMarkOptions?: (o: Record<string, unknown>) => void;
        setXABCDPatternOptions?: (o: Record<string, unknown>) => void;
        setWaveOptions?: (o: Record<string, unknown>) => void;
        setCycleOptions?: (o: Record<string, unknown>) => void;
        setRangeOptions?: (o: Record<string, unknown>) => void;
        setForecastOptions?: (o: Record<string, unknown>) => void;
        setBarsPatternOptions?: (o: Record<string, unknown>) => void;
        setGhostFeedOptions?: (o: Record<string, unknown>) => void;
        setProjectionOptions?: (o: Record<string, unknown>) => void;
        setFixedRangeVolumeProfileOptions?: (o: Record<string, unknown>) => void;
        setPositionOptions?: (o: Record<string, unknown>) => void;
        setPitchforkOptions?: (o: Record<string, unknown>) => void;
        setGannOptions?: (o: Record<string, unknown>) => void;
        setRectangleOptions?: (o: Record<string, unknown>) => void;
        setShapeOptions?: (o: Record<string, unknown>) => void;
      };
      if (d.setTrendLineOptions) d.setTrendLineOptions(patch.options);
      else if (d.setFibOptions) d.setFibOptions(patch.options);
      else if (d.setBrushOptions) d.setBrushOptions(patch.options);
      else if (d.setHighlighterOptions) d.setHighlighterOptions(patch.options);
      else if (d.setTextOptions) d.setTextOptions(patch.options);
      else if (d.setNoteOptions) d.setNoteOptions(patch.options);
      else if (d.setSignpostOptions) d.setSignpostOptions(patch.options);
      else if (d.setCalloutOptions) d.setCalloutOptions(patch.options);
      else if (d.setCommentOptions) d.setCommentOptions(patch.options);
      else if (d.setPriceLabelOptions) d.setPriceLabelOptions(patch.options);
      else if (d.setPriceNoteOptions) d.setPriceNoteOptions(patch.options);
      else if (d.setArrowMarkerOptions) d.setArrowMarkerOptions(patch.options);
      else if (d.setArrowMarkOptions) d.setArrowMarkOptions(patch.options);
      else if (d.setFlagMarkOptions) d.setFlagMarkOptions(patch.options);
      else if (d.setXABCDPatternOptions) d.setXABCDPatternOptions(patch.options);
      else if (d.setWaveOptions) d.setWaveOptions(patch.options);
      else if (d.setCycleOptions) d.setCycleOptions(patch.options);
      else if (d.setRangeOptions) d.setRangeOptions(patch.options);
      else if (d.setForecastOptions) d.setForecastOptions(patch.options);
      else if (d.setBarsPatternOptions) d.setBarsPatternOptions(patch.options);
      else if (d.setGhostFeedOptions) d.setGhostFeedOptions(patch.options);
      else if (d.setProjectionOptions) d.setProjectionOptions(patch.options);
      else if (d.setFixedRangeVolumeProfileOptions) d.setFixedRangeVolumeProfileOptions(patch.options);
      else if (d.setPositionOptions) d.setPositionOptions(patch.options);
      else if (d.setPitchforkOptions) d.setPitchforkOptions(patch.options);
      else if (d.setGannOptions) d.setGannOptions(patch.options);
      else if (d.setRectangleOptions) d.setRectangleOptions(patch.options);
      else if (d.setShapeOptions) d.setShapeOptions(patch.options);
      else sel.updateOptions(patch.options);
    }
    const type = this.lastType.get(sel.id);
    if (type) this.remember(type, patch);
    this.pushHistory(label.startsWith("change ") ? label : `change ${type ? labelFor(type) : "drawing"} ${label}`);
    this.emit();
  }

  /** Replaces anchors of the selected drawing (Coordinates tab), one undo step per call. */
  setSelectedAnchors(anchors: Anchor[], label: string) {
    const sel = this.getSelected();
    if (!sel) return;
    sel.setAnchors(anchors);
    this.pushHistory(`change ${label}`);
    this.emit();
  }

  beginEdit(): { id: string; depth: number; defaults: string } | null {
    const sel = this.getSelected();
    return sel ? { id: sel.id, depth: this.past.length, defaults: JSON.stringify(this.defaults) } : null;
  }

  /** Reverts every change made since `beginEdit` (dialog Cancel). */
  cancelEdit(token: { id: string; depth: number; defaults: string }) {
    if (this.past.length <= token.depth) return;
    // The remembered per-tool defaults follow the drawing back.
    this.defaults = JSON.parse(token.defaults);
    try {
      localStorage.setItem(DEFAULTS_KEY, token.defaults);
    } catch {
      /* storage unavailable */
    }
    this.past.length = token.depth;
    this.future = [];
    this.apply(this.past[this.past.length - 1].drawings);
    this.manager.selectDrawing(token.id);
    this.emit();
  }

  get chartApi(): IChartApi {
    return this.chart;
  }

  get seriesApi(): ISeriesApi<SeriesType> {
    return this.series;
  }

  private openers = new Set<(id: string) => void>();

  /** Fired when a drawing asks for its settings dialog (double-click / gear). */
  onOpenSettings(fn: (id: string) => void): () => void {
    this.openers.add(fn);
    return () => this.openers.delete(fn);
  }

  openSettings(id?: string) {
    const target = id ?? this.getSelected()?.id;
    if (target) this.openers.forEach((fn) => fn(target));
  }

  toggleSelectedLock() {
    const sel = this.getSelected();
    if (!sel) return;
    const type = this.lastType.get(sel.id);
    const name = type ? labelFor(type) : "drawing";
    const lock = !sel.options.locked;
    sel.updateOptions({ locked: lock });
    this.pushHistory(`${lock ? "lock" : "unlock"} ${name}`);
    this.emit();
  }

  hideSelected() {
    const sel = this.getSelected();
    if (!sel) return;
    const type = this.lastType.get(sel.id);
    this.manager.setDrawingVisible(sel.id, false);
    this.manager.deselectAll();
    this.pushHistory(`hide ${type ? labelFor(type) : "drawing"}`);
    this.emit();
  }

  reorderSelected(position: "front" | "back" | "forward" | "backward") {
    const sel = this.getSelected();
    if (!sel) return;
    const type = this.lastType.get(sel.id);
    const name = type ? labelFor(type) : "drawing";
    this.suspendHistory = true;
    this.manager.reorder(sel.id, position);
    this.suspendHistory = false;
    const verb = { front: `bring ${name} to front`, back: `send ${name} to back`, forward: `bring ${name} forward`, backward: `send ${name} backward` };
    this.pushHistory(verb[position]);
    this.emit();
  }

  /** Whether the selected drawing can move further in the given direction. */
  canReorder(position: "front" | "back" | "forward" | "backward"): boolean {
    const sel = this.getSelected();
    if (!sel) return false;
    const ids = this.real().map((d) => d.id);
    const i = ids.indexOf(sel.id);
    return position === "front" || position === "forward" ? i < ids.length - 1 : i > 0;
  }

  private shiftedCopy(s: Serialized): Serialized {
    const id = this.nextId();
    const a0 = s.anchors[0];
    const y = a0 ? this.series.priceToCoordinate(a0.price) : null;
    const up = y === null ? null : this.series.coordinateToPrice(y - 40);
    const dp = up !== null && a0 ? up - a0.price : 0;
    const copy = JSON.parse(JSON.stringify(s)) as Serialized;
    copy.id = id;
    copy.anchors = copy.anchors.map((a) => ({ ...a, price: a.price + dp }));
    return copy;
  }

  private insertCopies(items: Serialized[], label: string) {
    this.suspendHistory = true;
    this.manager.deselectAll();
    let last = "";
    for (const s of items) {
      const d = this.registry.createDrawing(s.type, s.id, s.anchors, s.style, s.options);
      if (!d) continue;
      this.attachVolume(d);
      d.fromJSON(s);
      this.lastType.set(s.id, s.type);
      this.manager.addDrawing(d);
      last = s.id;
    }
    this.suspendHistory = false;
    if (!last) return;
    this.manager.selectDrawing(last);
    this.pushHistory(label);
    this.emit();
  }

  cloneSelected() {
    const sel = this.getSelected();
    if (!sel) return;
    this.insertCopies([this.shiftedCopy(JSON.parse(JSON.stringify(sel.toJSON())) as Serialized)], "clone line tools");
  }

  copySelected() {
    const sel = this.getSelected();
    if (!sel) return;
    this.clipboard = [JSON.parse(JSON.stringify(sel.toJSON())) as Serialized];
    const type = this.lastType.get(sel.id);
    void navigator.clipboard?.writeText(type ? labelFor(type) : "drawing").catch(() => undefined);
  }

  canPaste() {
    return this.clipboard.length > 0;
  }

  paste() {
    if (!this.clipboard.length) return;
    const type = this.clipboard[0].type;
    this.insertCopies(this.clipboard.map((s) => this.shiftedCopy(s)), `paste ${labelFor(type)}`);
  }

  /** The price-line state lives in the chart settings; the controller only fronts it for the menus. */
  bindLines(lines: LinesBinding) {
    this.lines = lines;
  }

  get priceLineVisible() {
    return this.lines?.priceLine() ?? false;
  }

  togglePriceLine() {
    this.lines?.togglePriceLine();
  }

  get highLowVisible() {
    return this.lines?.highLow() ?? false;
  }

  toggleHighLowLines() {
    this.lines?.toggleHighLow();
  }

  get cursorLocked() {
    return this.lockedTime !== null;
  }

  /** Holds the vertical crosshair line at the time under the cursor (or releases it). */
  toggleCursorLock(x: number) {
    if (this.lockedTime !== null) {
      this.lockedTime = null;
      this.chart.clearCrosshairPosition();
    } else {
      const t = this.chart.timeScale().coordinateToTime(x);
      this.lockedTime = t === null ? null : (t as number);
    }
    this.emit();
  }

  private holdCursor = (p: { time?: unknown; point?: { y: number } }) => {
    if (this.lockedTime === null || !p.point || p.time === this.lockedTime) return;
    const price = this.series.coordinateToPrice(p.point.y);
    if (price !== null) this.chart.setCrosshairPosition(price, this.lockedTime as never, this.series);
  };

  undo() {
    if (this.past.length < 2) return;
    const entry = this.past.pop()!;
    this.future.push(entry);
    if (entry.action) entry.action.undo();
    else if (entry.zoom) this.stepZoom(entry.zoom, "undo");
    else this.apply(this.past[this.past.length - 1].drawings);
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(next);
    if (next.action) next.action.redo();
    else if (next.zoom) this.stepZoom(next.zoom, "redo");
    else this.apply(next.drawings);
  }

  // ---------- zoom ----------

  captureView(): ViewState {
    const scale = this.series.priceScale();
    return {
      range: this.chart.timeScale().getVisibleLogicalRange(),
      price: scale.getVisibleRange(),
      autoScale: scale.options().autoScale,
    };
  }

  applyView(v: ViewState) {
    if (v.range) this.chart.timeScale().setVisibleLogicalRange(v.range);
    const scale = this.series.priceScale();
    if (v.autoScale || !v.price) scale.applyOptions({ autoScale: true });
    else scale.setVisibleRange(v.price);
  }

  private recordZoom(kind: "in" | "out", before: ViewState, after: ViewState, label = "zoom", pill = false) {
    this.pushHistory(label);
    this.past[this.past.length - 1].zoom = { kind, before, after, pill };
  }

  /** After the bars are replaced, re-derives bar-index anchors from their timestamps. */
  remapAnchors(times: number[]) {
    for (const d of this.real()) {
      const anchors = d.anchors;
      if (!anchors.some((a) => a.logical !== undefined)) continue;
      d.setAnchors(
        anchors.map((a) =>
          a.logical === undefined ? a : { ...a, logical: DrawingTools.timeToFractionalLogical(times, a.time as number) ?? a.logical },
        ),
      );
    }
  }

  /** Adds an undo step for a change made outside the drawing list. */
  recordAction(label: string, undo: () => void, redo: () => void) {
    this.pushHistory(label);
    this.past[this.past.length - 1].action = { undo, redo };
    this.emit();
  }

  private get dataLength() {
    return this.series.data().length;
  }

  /** Chart navigation buttons: one zoom step about the right edge, one undo entry per step. */
  zoomStep(dir: "in" | "out") {
    const ts = this.chart.timeScale();
    const r = ts.getVisibleLogicalRange();
    if (!r) return;
    const before = this.captureView();
    const k = dir === "in" ? 1 / ZOOM_STEP : ZOOM_STEP;
    const span = Math.min(Math.max((r.to - r.from) * k, 8), this.dataLength + DEFAULT_RIGHT_OFFSET);
    ts.setVisibleLogicalRange({ from: r.to - span, to: r.to });
    this.recordZoom(dir, before, this.captureView(), `zoom ${dir}`, true);
    this.emit();
  }

  /** Reset chart view: default zoom and scroll position with the price axis auto-fitted. */
  resetView() {
    const before = this.captureView();
    this.zoomViews = [];
    const ts = this.chart.timeScale();
    ts.applyOptions({ barSpacing: DEFAULT_BAR_SPACING });
    ts.scrollToRealTime();
    ts.scrollToPosition(DEFAULT_RIGHT_OFFSET, false);
    this.series.priceScale().applyOptions({ autoScale: true });
    this.recordZoom("out", before, this.captureView(), "reset scales", true);
    this.emit();
  }

  /** Positive scrolls toward newer bars, negative toward older ones. */
  scrollBars(bars: number) {
    const ts = this.chart.timeScale();
    ts.scrollToPosition(ts.scrollPosition() + bars, false);
  }

  /** True when the newest bar is not at its default distance from the right edge. */
  isAwayFromPresent() {
    return Math.abs(this.chart.timeScale().scrollPosition() - DEFAULT_RIGHT_OFFSET) > 0.5;
  }

  backToPresent() {
    this.chart.timeScale().scrollToPosition(DEFAULT_RIGHT_OFFSET, false);
  }

  /** Zooms to a rectangle given in plot coordinates (the Zoom In drag box). */
  private zoomToBox(a: { x: number; y: number }, b: { x: number; y: number }) {
    const before = this.captureView();
    const ts = this.chart.timeScale();
    const from = ts.coordinateToLogical(Math.min(a.x, b.x));
    const to = ts.coordinateToLogical(Math.max(a.x, b.x));
    if (from !== null && to !== null) ts.setVisibleLogicalRange({ from, to });
    const top = this.series.coordinateToPrice(Math.min(a.y, b.y));
    const bottom = this.series.coordinateToPrice(Math.max(a.y, b.y));
    if (top !== null && bottom !== null) this.series.priceScale().setVisibleRange({ from: bottom, to: top });
    this.zoomViews.push(before);
    this.recordZoom("in", before, this.captureView());
  }

  /** Steps back to the view that was showing before the latest zoom in. */
  zoomOut() {
    const target = this.zoomViews.pop();
    if (!target) return;
    const before = this.captureView();
    this.applyView(target);
    this.recordZoom("out", before, target);
    this.emit();
  }

  private stepZoom(z: NonNullable<Snapshot["zoom"]>, dir: "undo" | "redo") {
    // The saved view is the one a zoom-in started from, which a zoom-out pops back to.
    if (z.pill) {
      this.applyView(dir === "undo" ? z.before : z.after);
      this.emit();
      return;
    }
    const saved = z.kind === "in" ? z.before : z.after;
    const pushes = (z.kind === "in") === (dir === "redo");
    if (pushes) this.zoomViews.push(saved);
    else this.zoomViews.pop();
    this.applyView(dir === "undo" ? z.before : z.after);
    this.emit();
  }

  dispose() {
    this.disposers.forEach((d) => d());
    this.manager.detach();
  }

  // ---------- history ----------

  private snapshot(): Serialized[] {
    return this.real().map((d) => JSON.parse(JSON.stringify(d.toJSON())) as Serialized);
  }

  private pushHistory(label: string) {
    this.past.push({ drawings: this.snapshot(), label });
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
  }

  private afterChange(id: string | undefined, kind: "create" | "remove" | "move", pointIndex?: number) {
    if ((id && isTransient(id)) || this.suspendHistory) return;
    const type = id ? this.lastType.get(id) : undefined;
    const name = type ? labelFor(type) : "drawing";
    if (kind === "move") this.pushHistory(pointIndex !== undefined ? `change ${pointIndex} point` : "move drawing(s)");
    else this.pushHistory(`${kind} ${name}`);
    this.emit();
  }

  private lastType = new Map<string, string>();

  private apply(snapshot: Serialized[]) {
    this.cancelPlacement();
    this.suspendHistory = true;
    this.manager.deselectAll();
    this.manager.clearAll();
    for (const s of snapshot) {
      const d = this.registry.createDrawing(s.type, s.id, s.anchors, s.style, s.options);
      if (!d) continue;
      this.attachVolume(d);
      d.fromJSON(s);
      this.lastType.set(s.id, s.type);
      this.manager.addDrawing(d);
    }
    this.suspendHistory = false;
    this.emit();
  }
  private suspendHistory = false;

  // ---------- geometry ----------

  /** Pane-local coordinates: the series pane may sit below other panes. */
  private pt(e: MouseEvent) {
    const r = this.host.getBoundingClientRect();
    return { x: e.clientX - r.left - this.plotLeft(), y: e.clientY - r.top - this.paneTop() };
  }

  private paneRect() {
    const el = this.series.getPane().getHTMLElement();
    const h = this.host.getBoundingClientRect();
    const r = el?.getBoundingClientRect();
    return { top: r ? r.top - h.top : 0, left: r ? r.left - h.left : 0, height: r?.height ?? this.host.clientHeight - this.chart.timeScale().height() };
  }

  /** The top edge of the series pane, relative to the host. */
  paneTop() {
    return this.paneRect().top;
  }

  plotLeft() {
    return this.scaleId === "left" ? this.scaleWidth("left") : 0;
  }

  /** Width of a price axis; LWC throws while the axis has not been rendered yet. */
  scaleWidth(side: "left" | "right") {
    try {
      return this.chart.priceScale(side).width();
    } catch {
      return 0;
    }
  }

  private inPlot(p: { x: number; y: number }) {
    return p.x >= 0 && p.x <= this.chart.timeScale().width() && p.y >= 0 && p.y <= this.paneRect().height;
  }

  /** Re-notifies listeners after the main series changed pane or scale. */
  refreshPaneState() {
    this.emit();
  }

  /** The price scale the main series is pinned to. */
  get scaleId(): "left" | "right" {
    return this.series.options().priceScaleId === "left" ? "left" : "right";
  }

  /** Moves the main series to the left or right price scale, carrying its scale settings along. */
  pinToScale(side: "left" | "right") {
    if (side === this.scaleId) return;
    const other = side === "left" ? "right" : "left";
    const from = this.series.priceScale().options();
    const width = this.chart.priceScale(this.scaleId).options().minimumWidth;
    this.chart.applyOptions({
      [`${side}PriceScale`]: { visible: true, borderVisible: from.borderVisible, borderColor: from.borderColor, minimumWidth: width },
      [`${other}PriceScale`]: { visible: false, minimumWidth: 0 },
    } as never);
    this.series.applyOptions({ priceScaleId: side });
    this.series.priceScale().applyOptions({
      mode: from.mode,
      invertScale: from.invertScale,
      autoScale: from.autoScale,
      scaleMargins: from.scaleMargins,
    });
    this.emit();
  }

  // ---------- placement ----------

  private get info(): ToolInfo | undefined {
    return TOOLS[this.tool];
  }

  private get variable(): boolean {
    return VARIABLE.has(this.info?.type ?? "");
  }

  private get required(): number {
    const t = this.info?.type;
    return t ? (this.registry.get(t)?.requiredAnchors ?? 0) : 0;
  }

  private nextId() {
    return `d${++this.idSeq}_${Date.now().toString(36)}`;
  }

  private style(type?: string) {
    const base = { lineColor: "#2962FF", lineWidth: 2, fillColor: "rgba(41, 98, 255, 0.2)", ...(type ? TYPE_STYLE[type] : undefined) };
    return type ? { ...base, ...this.defaults[type]?.style } : base;
  }

  /** Like TradingView, the last-used properties of a tool become the defaults for the next drawing of that tool. */
  private remember(type: string, patch: { style?: Partial<DrawingTools.DrawingStyle>; options?: Record<string, unknown> }) {
    const cur = this.defaults[type] ?? {};
    const options = { ...cur.options, ...patch.options };
    for (const key of PER_DRAWING_OPTIONS) delete options[key]; // typed text and position levels belong to one drawing
    this.defaults[type] = { style: { ...cur.style, ...patch.style }, options };
    try {
      localStorage.setItem(DEFAULTS_KEY, JSON.stringify(this.defaults));
    } catch {
      /* storage unavailable */
    }
  }

  private clearMeasure() {
    if (this.manager.getDrawing(MEASURE_ID)) this.manager.removeDrawing(MEASURE_ID);
  }

  private cancelPlacement() {
    this.pending = [];
    if (this.preview) {
      this.manager.removeDrawing(PREVIEW_ID);
      this.preview = null;
    }
    this.removeZoomBox();
    this.down = null;
    this.stroke = [];
    this.pendingPts = [];
  }

  private attachVolume(d: unknown) {
    (d as unknown as { setVolumeSeries?: (s: ISeriesApi<SeriesType> | null) => void }).setVolumeSeries?.(this.volumeSeries ?? null);
  }

  private showPreview(anchors: Anchor[]) {
    const type = this.info?.type;
    if (!type) return;
    const filled = [...anchors];
    while (filled.length < Math.max(this.required, 2)) filled.push({ ...anchors[anchors.length - 1] });
    if (!this.preview) {
      const d = this.registry.createDrawing(type, PREVIEW_ID, filled, this.style(type), this.defaults[type]?.options) as Drawing | null;
      if (!d) return;
      this.preview = d;
      (d as unknown as { setVolumeSeries?: (s: ISeriesApi<SeriesType> | null) => void }).setVolumeSeries?.(this.volumeSeries ?? null);
      this.manager.addDrawing(d);
      d.state = "editing";
    } else if (this.variable) {
      this.preview.setAnchors(filled);
    } else {
      filled.forEach((a, i) => this.preview!.updateAnchor(i, a));
    }
    this.preview.placedCount = this.pending.length;
    (this.preview as unknown as { finalizePlacement?: () => void }).finalizePlacement?.();
  }

  private commit(anchors: Anchor[], extraOptions: Record<string, unknown> = {}) {
    const type = this.info?.type;
    if (!type) return;
    if (this.preview) {
      this.manager.removeDrawing(PREVIEW_ID);
      this.preview = null;
    }
    this.pending = [];
    this.pendingPts = [];
    if (type === "measure") {
      this.finishMeasure(type, anchors);
      return;
    }
    const id = this.nextId();
    const options = { ...this.defaults[type]?.options, ...this.glyphPick[type], ...extraOptions };
    const d = this.registry.createDrawing(type, id, anchors, this.style(type), options) as Drawing | null;
    if (!d) return;
    this.attachVolume(d);
    this.lastType.set(id, type);
    this.manager.addDrawing(d);
    (d as unknown as { finalizePlacement?: () => void }).finalizePlacement?.();
    this.manager.selectDrawing(id);
    if (!this.stay && !FREEHAND.has(type)) this.returnToCursor(true);
    else this.emit();
    // Like TradingView, a freshly placed Text opens its dialog straight away.
    if (TEXT_TYPES.has(type) || NOTE_TYPES.has(type) || OPEN_ON_PLACE.has(type)) {
      this.freshId = id;
      this.openSettings(id);
    }
  }

  /** The ruler stays on the chart, outside the history, until the next click. */
  private finishMeasure(type: string, anchors: Anchor[]) {
    this.returnToCursor();
    const d = this.registry.createDrawing(type, MEASURE_ID, anchors, this.style(type)) as Drawing | null;
    if (!d) return;
    (d as unknown as { setVolumeSeries?: (s: ISeriesApi<SeriesType> | null) => void }).setVolumeSeries?.(this.volumeSeries ?? null);
    this.manager.addDrawing(d);
    d.state = "editing";
  }

  /** A just-placed Text hides its floating toolbar while its dialog is open; it stays selected afterwards. */
  freshId: string | null = null;

  endFresh(id: string) {
    if (this.freshId !== id) return;
    this.freshId = null;
    this.emit();
  }

  private get freehand(): boolean {
    return FREEHAND.has(this.info?.type ?? "");
  }

  private showStrokePreview() {
    const type = this.info?.type;
    if (!type) return;
    if (!this.preview) {
      const d = this.registry.createDrawing(type, PREVIEW_ID, [...this.stroke], this.style(type), this.defaults[type]?.options) as Drawing | null;
      if (!d) return;
      this.preview = d;
      this.manager.addDrawing(d);
      d.state = "normal";
    } else {
      this.preview.setAnchors([...this.stroke]);
    }
  }

  /** Freehand points keep their fractional bar position so strokes are not quantised to bars. */
  private strokeAnchor(p: { x: number; y: number }): Anchor | null {
    const a = this.manager.resolveAnchor(p);
    if (!a) return null;
    const logical = this.manager.fractionalLogical(p.x);
    return logical === null ? a : { ...a, logical };
  }

  private collectStroke(p: { x: number; y: number }) {
    const d = this.down;
    if (!d) return;
    if (this.stroke.length === 0) {
      const dist = Math.hypot(p.x - d.x, p.y - d.y);
      if (dist <= STROKE_INSET) return;
      const k = STROKE_INSET / dist;
      const start = this.strokeAnchor({ x: d.x + (p.x - d.x) * k, y: d.y + (p.y - d.y) * k });
      if (start) this.stroke.push(start);
    }
    const a = this.strokeAnchor(p);
    if (a && this.stroke.length) this.stroke.push(a);
    if (this.stroke.length >= 2) this.showStrokePreview();
  }

  // ---------- zoom box ----------

  private removeZoomBox() {
    this.zoomBox?.remove();
    this.zoomBox = null;
  }

  // ---------- events ----------

  private onDown = (e: MouseEvent) => {
    this.forwardAlt(e);
    if (e.button === 0) this.clearMeasure();
    if (e.button !== 0 || this.cursorLike) return;
    const p = this.pt(e);
    if (!this.inPlot(p)) return;
    e.stopPropagation();
    e.preventDefault();
    if (this.tool === ERASER) {
      const hit = this.manager.hitTest(p);
      if (hit && !isTransient(hit.id)) {
        this.setHover(null);
        this.manager.removeDrawing(hit.id);
      }
      return;
    }
    this.down = { ...p, moved: false };
    this.stroke = [];
    if (this.freehand) this.manager.deselectAll();
    if (this.tool === "zoom_in") {
      const box = document.createElement("div");
      Object.assign(box.style, {
        position: "absolute",
        pointerEvents: "none",
        zIndex: "20",
        boxSizing: "border-box",
        border: "1px solid rgba(41,98,255,0.75)",
        background: "rgba(41,98,255,0.3)",
        left: `${p.x - 0.5}px`,
        top: `${p.y - 0.5}px`,
        width: "1px",
        height: "1px",
      });
      this.host.appendChild(box);
      this.zoomBox = box;
    }
  };

  private onMove = (e: MouseEvent) => {
    const p = this.pt(e);
    if (this.down && Math.hypot(p.x - this.down.x, p.y - this.down.y) > DRAG_THRESHOLD) this.down.moved = true;

    if (this.zoomBox && this.down) {
      Object.assign(this.zoomBox.style, {
        left: `${Math.min(p.x, this.down.x) - 0.5}px`,
        top: `${Math.min(p.y, this.down.y) - 0.5}px`,
        width: `${Math.abs(p.x - this.down.x) + 1}px`,
        height: `${Math.abs(p.y - this.down.y) + 1}px`,
      });
      return;
    }

    if (this.cursorLike || this.tool === ERASER) {
      this.updateHover(p);
      return;
    }
    if (!this.info?.type) return;
    if (this.freehand) {
      if (this.down) this.collectStroke(p);
      return;
    }
    const anchor = this.manager.resolveAnchor(p);
    if (!anchor) return;
    if (this.pending.length > 0) {
      this.showPreview([...this.pending, anchor]);
    } else if (this.down?.moved && this.required === 2 && !this.variable) {
      const start = this.manager.resolveAnchor(this.down);
      if (start) {
        this.pending = [start];
        this.showPreview([start, anchor]);
      }
    }
  };

  private onUp = (e: MouseEvent) => {
    if (e.button !== 0 || !this.down) return;
    const start = this.down;
    this.down = null;
    e.stopPropagation();
    const p = this.pt(e);

    if (this.tool === "zoom_in") {
      this.removeZoomBox();
      if (!start.moved) return;
      this.zoomToBox(start, p);
      this.returnToCursor();
      return;
    }

    if (!this.info?.type) return;
    if (this.freehand) {
      const end = this.strokeAnchor(p);
      if (this.stroke.length && end) this.stroke.push(end);
      // A plain click leaves a single-point dot.
      const anchors = this.stroke.length >= 2 ? this.stroke : end ? [end, { ...end }] : [];
      this.stroke = [];
      if (anchors.length) this.commit(anchors);
      return;
    }
    if (start.moved && this.pending.length === 1 && this.required === 2 && !this.variable) {
      const a = this.manager.resolveAnchor(start);
      const b = this.manager.resolveAnchor(p);
      if (a && b) this.commit([a, b]);
      return;
    }
    const anchor = this.manager.resolveAnchor(p);
    if (!anchor) return;
    if (this.variable) {
      const first = this.pendingPts[0];
      if (CLOSABLE.has(this.info?.type ?? "") && this.pending.length >= 3 && first && Math.hypot(p.x - first.x, p.y - first.y) <= CLOSE_RADIUS) {
        this.commit([...this.pending], { closed: true });
        return;
      }
      const last = this.pendingPts[this.pendingPts.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 3) return;
      this.pendingPts.push(p);
      this.pending.push(anchor);
      this.showPreview(this.pending);
      return;
    }
    this.pending.push(anchor);
    if (this.pending.length >= this.required) this.commit([...this.pending]);
    else this.showPreview(this.pending);
  };

  private onDblClick = (e: MouseEvent) => {
    if (this.variable) {
      if (this.pending.length >= 2) this.commit([...this.pending]);
      else this.cancelPlacement();
      return;
    }
    if (!this.cursorLike) return;
    const p = this.pt(e);
    if (!this.inPlot(p)) return;
    const hit = this.manager.hitTest(p);
    if (!hit || isTransient(hit.id)) return;
    this.manager.selectDrawing(hit.id);
    this.openSettings(hit.id);
  };

  private onLeave = () => {
    this.setHover(null);
  };

  private updateHover(p: { x: number; y: number }) {
    if (this.manager.getSelectedDrawing()?.state === "editing") return;
    const hit = this.inPlot(p) ? this.manager.hitTest(p) : null;
    this.setHover(hit && !isTransient(hit.id) ? hit.id : null);
  }

  private setHover(id: string | null) {
    if (id === this.hoverId) return;
    if (this.hoverId) {
      const prev = this.manager.getDrawing(this.hoverId);
      if (prev && prev.state === "hovered") prev.setState("normal");
    }
    this.hoverId = id;
    if (id) {
      const d = this.manager.getDrawing(id);
      if (d && d.state === "normal") d.setState("hovered");
    }
    this.applyCursor(!!id);
  }

  private get cursorLike(): boolean {
    return isCursorTool(this.tool) && this.tool !== ERASER;
  }

  private hotkeyTool(code: string): string | undefined {
    return ALL_ITEMS.find((i) => i.hotkey?.code === code)?.id;
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.keysEnabled) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "Escape") {
      this.clearMeasure();
      this.cancelPlacement();
      this.manager.deselectAll();
      this.returnToCursor();
    } else if (mod && e.altKey && e.code === "KeyH") {
      e.preventDefault();
      this.toggleHide();
    } else if (e.altKey && this.hotkeyTool(e.code)) {
      e.preventDefault();
      this.setTool(this.hotkeyTool(e.code)!);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      this.removeSelected();
    } else if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && !e.altKey && e.key.toLowerCase() === "c") {
      this.copySelected();
    } else if (mod && !e.altKey && e.key.toLowerCase() === "v") {
      e.preventDefault();
      this.paste();
    } else if (e.altKey && !mod && e.code === "KeyR") {
      e.preventDefault();
      this.resetView();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.redo();
    }
  };
}
