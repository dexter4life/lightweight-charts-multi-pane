import type { ReactNode } from "react";
import type { MenuItem } from "../../common/Menu";
import { ObjectSettingsIcons, ObjectSettingsPencilIcon, type IconComponent } from "../../icons";

export type Opts = Record<string, unknown>;
export type Tab = "Inputs" | "Style" | "Text" | "Coordinates" | "Visibility";

export const PENCIL = ObjectSettingsPencilIcon;
export const ICON = ObjectSettingsIcons;

const renderIcon = (Icon: IconComponent): ReactNode => <Icon />;

export const DASH_VALUES: Record<string, number[]> = { solid: [], dashed: [6, 6], dotted: [2, 4] };
export const dashKey = (dash?: number[]) => (!dash || !dash.length ? "solid" : dash[0] <= 2 ? "dotted" : "dashed");

export const DASHES: MenuItem[] = [
  { value: "solid", label: "Line", icon: renderIcon(ICON.solid) },
  { value: "dashed", label: "Dashed line", icon: renderIcon(ICON.dashed) },
  { value: "dotted", label: "Dotted line", icon: renderIcon(ICON.dotted) },
];

export const LEFT_ENDS: MenuItem[] = [
  { value: "normal", label: "Normal", icon: renderIcon(ICON.leftNormal) },
  { value: "arrow", label: "Arrow", icon: renderIcon(ICON.leftArrow) },
];

export const RIGHT_ENDS: MenuItem[] = [
  { value: "normal", label: "Normal", icon: renderIcon(ICON.rightNormal) },
  { value: "arrow", label: "Arrow", icon: renderIcon(ICON.rightArrow) },
];

export const STATS_POS: MenuItem[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export const SIZES: MenuItem[] = [10, 11, 12, 14, 16, 20, 24, 28, 32, 40].map((value) => ({ value: String(value), label: String(value) }));
export const FIB_SIZES: MenuItem[] = [10, 11, 12, 14, 16, 20, 24].map((value) => ({ value: String(value), label: String(value) }));
export const FIB_THICKNESS: MenuItem[] = [1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value}px` }));

export const V_ALIGN: MenuItem[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];

export const ORIENT: MenuItem[] = [
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];

export const H_ALIGN: MenuItem[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export const SHAPE_V_ALIGN: MenuItem[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Inside" },
  { value: "bottom", label: "Bottom" },
];

export const SHAPE_TITLES: Record<string, string> = {
  circle: "Circle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  "rotated-rectangle": "Rotated Rectangle",
  arc: "Arc",
  path: "Path",
  polyline: "Polyline",
  curve: "Curve",
  "double-curve": "Double Curve",
};

export const CHECKS = [
  { key: "extendLeft", label: "Extend left line", undo: "line extending left" },
  { key: "extendRight", label: "Extend right line", undo: "line extending right" },
  { key: "middlePoint", label: "Middle point", undo: "middle point visibility" },
  { key: "priceLabels", label: "Price labels", undo: "price labels visibility" },
];

export const STATS = [
  { key: "statsPrice", label: "Price range", undo: "price range visibility" },
  { key: "statsBars", label: "Bars range", undo: "bars range visibility" },
  { key: "statsDate", label: "Date/time range", undo: "date/time range visibility" },
  { key: "statsDistance", label: "Distance", undo: "distance visibility" },
  { key: "statsAngle", label: "Angle", undo: "angle visibility" },
  { key: "alwaysShowStats", label: "Always show stats", undo: "always show stats" },
];

export const UNITS = [
  { key: "minutes", label: "Minutes", min: 1, max: 59 },
  { key: "hours", label: "Hours", min: 1, max: 24 },
  { key: "days", label: "Days", min: 1, max: 366 },
  { key: "weeks", label: "Weeks", min: 1, max: 52 },
  { key: "months", label: "Months", min: 1, max: 12 },
];

export const TREND_TABS: Tab[] = ["Style", "Text", "Coordinates", "Visibility"];
export const ANGLE_TABS: Tab[] = ["Style", "Coordinates", "Visibility"];
export const FIB_TABS: Tab[] = ["Style", "Coordinates", "Visibility"];
export const RANGE_TABS: Tab[] = ["Style", "Text", "Coordinates", "Visibility"];
export const WEDGE_TABS: Tab[] = ["Style", "Visibility"];
export const NO_COORD_SHAPE_TABS: Tab[] = ["Style", "Text", "Visibility"];
export const BRUSH_TABS: Tab[] = ["Style", "Visibility"];
export const TEXT_TABS: Tab[] = ["Text", "Visibility"];
export const NOTE_TABS: Tab[] = ["Style", "Text", "Coordinates", "Visibility"];
export const PIN_TABS: Tab[] = ["Style", "Text", "Visibility"];
export const CALLOUT_TABS: Tab[] = ["Text", "Coordinates", "Visibility"];
export const LABEL_TABS: Tab[] = ["Style", "Coordinates", "Visibility"];
export const POSITION_TABS: Tab[] = ["Inputs", "Style", "Visibility"];
export const REGRESSION_TABS: Tab[] = ["Inputs", "Style", "Coordinates", "Visibility"];
export const ICON_TABS: Tab[] = ["Style", "Visibility"];
export const EMOJI_TABS: Tab[] = ["Visibility"];

export const NO_COORD_SHAPES = new Set(["ellipse"]);
export const CURVES = new Set(["curve", "double-curve"]);
export const NO_TEXT_SHAPES = new Set(["triangle", "curve", "double-curve"]);
export const STYLE_ONLY_SHAPES = new Set(["rotated-rectangle", "arc", "path", "polyline"]);
export const LINE_SHAPES = new Set(["path"]);
export const ANGLE_STATS = ["statsPrice", "statsBars", "alwaysShowStats"];

export const ARROW_MARK_TITLES: Record<string, string> = {
  "arrow-mark-up": "Arrow Mark Up",
  "arrow-mark-down": "Arrow Mark Down",
  "arrow-mark-left": "Arrow Mark Left",
  "arrow-mark-right": "Arrow Mark Right",
};

export const PITCHFORKS: Record<string, string> = {
  "andrews-pitchfork": "Pitchfork",
  "schiff-pitchfork": "Schiff Pitchfork",
  "modified-schiff-pitchfork": "Modified Schiff Pitchfork",
  "inside-pitchfork": "Inside Pitchfork",
  pitchfan: "Pitchfan",
};

export const DEFAULT_VARIANTS: Record<string, string> = {
  "andrews-pitchfork": "original",
  "schiff-pitchfork": "schiff",
  "modified-schiff-pitchfork": "modified-schiff",
  "inside-pitchfork": "inside",
};

export const PITCHFORK_STYLES: MenuItem[] = [
  { value: "original", label: "Original" },
  { value: "schiff", label: "Schiff" },
  { value: "modified-schiff", label: "Modified Schiff" },
  { value: "inside", label: "Inside" },
];

export const RISK_MODES: MenuItem[] = [
  { value: "percents", label: "%" },
  { value: "money", label: "Cash" },
];

export const FIB_LEVEL_MODES: MenuItem[] = [
  { value: "values", label: "Values" },
  { value: "percents", label: "Percents" },
];

export const REGRESSION_SOURCE_ITEMS: MenuItem[] = ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"].map((value) => ({ value, label: value }));

export interface FibLevel {
  value: number;
  enabled: boolean;
  color: string;
}

export const DEFAULT_OPTIONS: Opts = {
  extendLeft: false,
  extendRight: false,
  middlePoint: false,
  priceLabels: false,
  statsPrice: false,
  statsBars: false,
  statsDate: false,
  statsDistance: false,
  statsAngle: false,
  alwaysShowStats: false,
  statsPosition: "right",
  leftEnd: "normal",
  rightEnd: "normal",
  showText: false,
  text: "",
  textSize: 14,
  textBold: false,
  textItalic: false,
  textVAlign: "top",
  textHAlign: "center",
};

export const LINE_FAMILY: Record<string, { title: string; options?: Opts }> = {
  "trend-line": { title: "Trend Line" },
  arrow: { title: "Arrow", options: { rightEnd: "arrow" } },
  ray: { title: "Ray", options: { extendRight: true } },
  "extended-line": { title: "Extended Line", options: { extendLeft: true, extendRight: true } },
  "trend-angle": { title: "Trend Angle" },
  "horizontal-line": { title: "Horizontal Line", options: { priceLabels: true, textVAlign: "bottom", textSize: 12 } },
  "vertical-line": { title: "Vertical Line", options: { timeLabels: true, extendLine: true, textOrientation: "vertical", textVAlign: "bottom", textHAlign: "right", textSize: 14 } },
  "parallel-channel": { title: "Parallel Channel" },
  "regression-trend": { title: "Regression Trend" },
  "flat-top-bottom": { title: "Flat Top/Bottom" },
  "disjoint-channel": { title: "Disjoint Channel" },
  "cross-line": { title: "Cross Line", options: { priceLabels: true, timeLabels: true } },
  "horizontal-ray": { title: "Horizontal Ray", options: { priceLabels: true, textVAlign: "bottom", textSize: 12 } },
  "info-line": { title: "Info Line", options: { statsPrice: true, statsBars: true, statsDate: true, statsDistance: true, statsAngle: true, alwaysShowStats: true, statsPosition: "center" } },
};

const HEIGHTS: Record<Tab, number> = { Inputs: 706, Style: 825, Text: 431, Coordinates: 313, Visibility: 450 };

export const heightOf = (tab: Tab, brush: boolean, txt = false, xp = false, lp = false, ic = false, ang = false, hz = false, vl = false, cl = false, pc = false, rt = false, rc = false, sh = false, nt = false, sg = false, co = false, cm = false, pl = false, pn = false) =>
  pn && tab === "Style" ? 400 : pl ? (tab === "Style" ? 350 : tab === "Visibility" ? 450 : 313) : co ? (tab === "Text" ? (cm ? 313 : 615) : tab === "Visibility" ? 450 : 313) : sg ? (tab === "Text" ? 381 : tab === "Visibility" ? 450 : 313) : sh && !rc && tab === "Style" ? 313 : sh && tab === "Text" ? 380 : rc && tab === "Style" ? 400 : rt && tab === "Inputs" ? 418 : (pc || rt) && tab === "Style" ? 450 : cl && tab === "Style" ? 350 : vl && tab === "Style" ? 350 : vl && tab === "Text" ? 481 : hz && tab === "Style" ? 313 : ang && tab === "Style" ? 696 : ic && tab === "Style" ? 313 : brush && tab === "Style" ? 312 : nt && tab === "Text" ? 565 : nt && tab === "Style" ? 313 : txt && tab === "Text" ? 614 : xp && tab === "Style" ? 350 : xp && tab === "Coordinates" ? 450 : lp && tab === "Style" ? 550 : HEIGHTS[tab];

export const widthOf = (tab: Tab, fib: boolean, vl = false, ft = false, sg = false, pn = false) =>
  tab === "Visibility" ? 454 : pn && tab === "Style" ? 401.6 : sg && tab === "Coordinates" ? 448 : vl && tab === "Text" ? 386 : fib && tab === "Style" ? 452 : ft && tab === "Style" ? 389 : 380;

export const CHECKER = "repeating-conic-gradient(#c0c3cb 0% 25%, #fff 0% 50%) 0 0 / 12px 12px";
export const swatch = (color: string) => `linear-gradient(${color},${color}), ${CHECKER}`;

export const lwPreview = (width: number): ReactNode => <i style={{ display: "block", width: "50px", height: `${width}px`, background: "currentColor", flex: "none" }} />;

export const FRVP_DEFAULTS = {
  rowsLayout: "rows",
  rows: 24,
  volume: "updown",
  vaVolume: 70,
  percentWidth: 30,
  placement: "left",
  showProfile: true,
  showValues: false,
  valuesColor: "#424242",
  upColor: "rgba(21, 146, 230, 0.24)",
  downColor: "rgba(251, 193, 35, 0.24)",
  vaUpColor: "rgba(21, 146, 230, 0.7)",
  vaDownColor: "rgba(251, 193, 35, 0.7)",
  showPoc: true,
  pocColor: "#ff0000",
  pocWidth: 2,
  pocDash: [] as number[],
  showDevPoc: false,
  devPocColor: "#ff0000",
  devPocWidth: 1,
  devPocDash: [] as number[],
  showDevVA: false,
  devVAColor: "#0000ff",
  devVAWidth: 1,
  devVADash: [] as number[],
  boxColor: "rgba(55, 166, 239, 0.06)",
};
