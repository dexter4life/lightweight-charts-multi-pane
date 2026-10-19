export interface GroupItem {
  /** Controller tool id. */
  id: string;
  label: string;
  /** Drawing type in the library; null when the item is a cursor mode or has no library tool yet. */
  type: string | null;
  /** Alt+<code> shortcut. */
  hotkey?: { code: string; label: string };
}

export interface ToolGroup {
  id: string;
  title: string;
  items: GroupItem[];
}

type Mk = (id: string, label: string, type: string | null, hotkey?: [string, string]) => GroupItem;
const mk: Mk = (id, label, type, hotkey) => ({
  id,
  label,
  type,
  hotkey: hotkey ? { code: hotkey[0], label: hotkey[1] } : undefined,
});

export const GROUPS: ToolGroup[] = [
  {
    id: "cursors",
    title: "Cursors",
    items: [
      mk("cursor_cross", "Cross", null),
      mk("cursor_dot", "Dot", null),
      mk("cursor_arrow", "Arrow", null),
      mk("cursor_demo", "Demonstration", null),
      mk("cursor_eraser", "Eraser", null),
    ],
  },
  {
    id: "lines",
    title: "Trend Line Tools",
    items: [
      mk("trendline", "Trend Line", "trend-line", ["KeyT", "⌥T"]),
      mk("arrow", "Arrow", "arrow"),
      mk("ray", "Ray", "ray"),
      mk("info-line", "Info Line", "info-line"),
      mk("extended-line", "Extended Line", "extended-line"),
      mk("trend-angle", "Trend Angle", "trend-angle"),
      mk("horizontal-line", "Horizontal Line", "horizontal-line", ["KeyH", "⌥H"]),
      mk("horizontal-ray", "Horizontal Ray", "horizontal-ray", ["KeyJ", "⌥J"]),
      mk("vertical-line", "Vertical Line", "vertical-line", ["KeyV", "⌥V"]),
      mk("cross-line", "Cross Line", "cross-line", ["KeyC", "⌥C"]),
      mk("parallel-channel", "Parallel Channel", "parallel-channel"),
      mk("regression-trend", "Regression Trend", "regression-trend"),
      mk("flat-top-bottom", "Flat Top/Bottom", "flat-top-bottom"),
      mk("disjoint-channel", "Disjoint Channel", "disjoint-channel"),
    ],
  },
  {
    id: "fib",
    title: "Gann and Fibonacci Tools",
    items: [
      mk("fib_retracement", "Fib Retracement", "fib-retracement", ["KeyF", "⌥F"]),
      mk("fib-extension", "Trend-Based Fib Extension", "fib-extension"),
      mk("andrews-pitchfork", "Pitchfork", "andrews-pitchfork"),
      mk("schiff-pitchfork", "Schiff Pitchfork", "schiff-pitchfork"),
      mk("modified-schiff-pitchfork", "Modified Schiff Pitchfork", "modified-schiff-pitchfork"),
      mk("inside-pitchfork", "Inside Pitchfork", "inside-pitchfork"),
      mk("fib-channel", "Fib Channel", "fib-channel"),
      mk("fib-time-zone", "Fib Time Zone", "fib-time-zone"),
      mk("gann-box", "Gann Box", "gann-box"),
      mk("gann-square-fixed", "Gann Square Fixed", "gann-square-fixed"),
      mk("gann-square", "Gann Square", "gann-square"),
      mk("gann-fan", "Gann Fan", "gann-fan"),
      mk("fib-speed-fan", "Fib Speed Resistance Fan", "fib-speed-fan"),
      mk("fib-time-extension", "Trend-Based Fib Time", "fib-time-extension"),
      mk("fib-circles", "Fib Circles", "fib-circles"),
      mk("pitchfan", "Pitchfan", "pitchfan"),
      mk("fib-spiral", "Fib Spiral", "fib-spiral"),
      mk("fib-arcs", "Fib Speed Resistance Arcs", "fib-arcs"),
      mk("fib-wedge", "Fib Wedge", "fib-wedge"),
    ],
  },
  {
    id: "shapes",
    title: "Brushes and Shapes",
    items: [
      mk("brush", "Brush", "brush"),
      mk("highlighter", "Highlighter", "highlighter"),
      mk("rectangle", "Rectangle", "rectangle"),
      mk("circle", "Circle", "circle"),
      mk("ellipse", "Ellipse", "ellipse"),
      mk("path", "Path", "path"),
      mk("curve", "Curve", "curve"),
      mk("polyline", "Polyline", "polyline"),
      mk("triangle", "Triangle", "triangle"),
      mk("rotated-rectangle", "Rotated Rectangle", "rotated-rectangle"),
      mk("arc", "Arc", "arc"),
      mk("double-curve", "Double Curve", "double-curve"),
    ],
  },
  {
    id: "text",
    title: "Annotation Tools",
    items: [
      mk("text", "Text", "text-annotation"),
      mk("anchored-text", "Anchored Text", "anchored-text"),
      mk("note", "Note", "note"),
      mk("pin", "Anchored Note", "pin"),
      mk("signpost", "Signpost", "signpost"),
      mk("callout", "Callout", "callout"),
      mk("comment", "Comment", "comment"),
      mk("price-label", "Price Label", "price-label"),
      mk("price-note", "Price Note", "price-note"),
      mk("arrow-marker", "Arrow Marker", "arrow-marker"),
      mk("arrow-mark-left", "Arrow Mark Left", "arrow-mark-left"),
      mk("arrow-mark-right", "Arrow Mark Right", "arrow-mark-right"),
      mk("arrow-mark-up", "Arrow Mark Up", "arrow-mark-up"),
      mk("arrow-mark-down", "Arrow Mark Down", "arrow-mark-down"),
      mk("flag-mark", "Flag Mark", "flag-mark"),
    ],
  },
  {
    id: "patterns",
    title: "Patterns",
    items: [
      mk("xabcd_pattern", "XABCD Pattern", "xabcd-pattern"),
      mk("cypher-pattern", "Cypher Pattern", "cypher-pattern"),
      mk("abcd-pattern", "ABCD Pattern", "abcd-pattern"),
      mk("triangle-pattern", "Triangle Pattern", "triangle-pattern"),
      mk("three-drives-pattern", "Three Drives Pattern", "three-drives-pattern"),
      mk("head-and-shoulders", "Head and Shoulders", "head-and-shoulders"),
      mk("elliott-impulse-wave", "Elliott Impulse Wave (12345)", "elliott-impulse-wave"),
      mk("elliott-triangle-wave", "Elliott Triangle Wave (ABCDE)", "elliott-triangle-wave"),
      mk("elliott-triple-combo", "Elliott Triple Combo Wave (WXYXZ)", "elliott-triple-combo"),
      mk("elliott-correction-wave", "Elliott Correction Wave (ABC)", "elliott-correction-wave"),
      mk("elliott-double-combo", "Elliott Double Combo Wave (WXY)", "elliott-double-combo"),
      mk("cyclic-lines", "Cyclic Lines", "cyclic-lines"),
      mk("time-cycles", "Time Cycles", "time-cycles"),
      mk("sine-line", "Sine Line", "sine-line"),
    ],
  },
  {
    id: "forecasting",
    title: "Prediction and Measurement Tools",
    items: [
      mk("long_position", "Long Position", "long-position"),
      mk("short-position", "Short Position", "short-position"),
      mk("forecast", "Forecast", "forecast"),
      mk("date-range", "Date Range", "date-range"),
      mk("price-range", "Price Range", "price-range"),
      mk("date-price-range", "Date and Price Range", "date-price-range"),
      mk("bars-pattern", "Bars Pattern", "bars-pattern"),
      mk("ghost-feed", "Ghost Feed", "ghost-feed"),
      mk("projection", "Projection", "projection"),
      mk("fixed-range-volume-profile", "Fixed Range Volume Profile", "fixed-range-volume-profile"),
    ],
  },
  {
    id: "icons",
    title: "Icons",
    items: [mk("icon", "Icon", "icon")],
  },
];

export const ALL_ITEMS: GroupItem[] = GROUPS.flatMap((grp) => grp.items);
