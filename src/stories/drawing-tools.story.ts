import { mountDrawingChart, createDrawingFromRegistry, pickAnchors } from "./chart-helpers";

/** @type {import("@storybook/html").Meta} */
const meta = {
  title: "Drawing Tools/All Tools",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

/**
 * Mount a chart, create a drawing, and return the container element so
 * Storybook renders it.  Mirrors the createDrawing() flow in
 * tmp/lightweight-charts-drawing/demo/main.ts.
 */
function renderStory(toolType, id, fractions) {
  const { manager, data, container } = mountDrawingChart();
  createDrawingFromRegistry(manager, toolType, id, pickAnchors(data, fractions));
  return container;
}

// ============ Line Tools ============

export const TrendLine = {
  render: () => renderStory("trend-line", "tl-1", [0.1, 0.5]),
};

export const HorizontalLine = {
  render: () => renderStory("horizontal-line", "hl-1", [0.3]),
};

export const VerticalLine = {
  render: () => renderStory("vertical-line", "vl-1", [0.4]),
};

export const Ray = {
  render: () => renderStory("ray", "ray-1", [0.15, 0.5]),
};

export const Arrow = {
  render: () => renderStory("arrow", "arr-1", [0.2, 0.5]),
};

export const ExtendedLine = {
  render: () => renderStory("extended-line", "el-1", [0.1, 0.4]),
};

export const CrossLine = {
  render: () => renderStory("cross-line", "cl-1", [0.4]),
};

export const InfoLine = {
  render: () => renderStory("info-line", "il-1", [0.1, 0.5]),
};

export const TrendAngle = {
  render: () => renderStory("trend-angle", "ta-1", [0.1, 0.5]),
};

export const HorizontalRay = {
  render: () => renderStory("horizontal-ray", "hr-1", [0.3]),
};

// ============ Shape Tools ============

export const Rectangle = {
  render: () => renderStory("rectangle", "rect-1", [0.2, 0.4]),
};

export const Circle = {
  render: () => renderStory("circle", "circ-1", [0.2, 0.4]),
};

export const Triangle = {
  render: () => renderStory("triangle", "tri-1", [0.15, 0.35, 0.55]),
};

export const PriceRange = {
  render: () => renderStory("price-range", "pr-1", [0.2, 0.4]),
};

export const Ellipse = {
  render: () => renderStory("ellipse", "ell-1", [0.2, 0.4]),
};

export const Arc = {
  render: () => renderStory("arc", "arc-1", [0.1, 0.3, 0.5]),
};

export const RotatedRectangle = {
  render: () => renderStory("rotated-rectangle", "rr-1", [0.1, 0.3, 0.5]),
};

export const Path = {
  render: () => renderStory("path", "path-1", [0.15, 0.45]),
};

export const Polyline = {
  render: () => renderStory("polyline", "poly-1", [0.15, 0.45]),
};

export const Curve = {
  render: () => renderStory("curve", "curve-1", [0.1, 0.25, 0.4, 0.55]),
};

export const DoubleCurve = {
  render: () => renderStory("double-curve", "dcurve-1", [0.1, 0.3, 0.5]),
};

// ============ Channel Tools ============

export const ParallelChannel = {
  render: () => renderStory("parallel-channel", "pc-1", [0.15, 0.35, 0.55]),
};

export const RegressionTrend = {
  render: () => renderStory("regression-trend", "rt-1", [0.15, 0.45]),
};

export const FlatTopBottom = {
  render: () => renderStory("flat-top-bottom", "ftb-1", [0.15, 0.35, 0.55]),
};

export const DisjointChannel = {
  render: () => renderStory("disjoint-channel", "dc-1", [0.1, 0.25, 0.4, 0.55]),
};

// ============ Fibonacci Tools ============

export const FibRetracement = {
  render: () => renderStory("fib-retracement", "fib-1", [0.15, 0.45]),
};

export const FibExtension = {
  render: () => renderStory("fib-extension", "fibext-1", [0.1, 0.3, 0.5]),
};

export const FibChannel = {
  render: () => renderStory("fib-channel", "fibch-1", [0.1, 0.3, 0.5]),
};

export const FibTimeZone = {
  render: () => renderStory("fib-time-zone", "fibtz-1", [0.15, 0.45]),
};

export const FibSpeedFan = {
  render: () => renderStory("fib-speed-fan", "fibsF-1", [0.15, 0.45]),
};

export const FibTimeExtension = {
  render: () => renderStory("fib-time-extension", "fibte-1", [0.1, 0.3, 0.5]),
};

export const FibCircles = {
  render: () => renderStory("fib-circles", "fibcirc-1", [0.15, 0.4]),
};

export const FibArcs = {
  render: () => renderStory("fib-arcs", "fibarcs-1", [0.15, 0.4]),
};

export const FibWedge = {
  render: () => renderStory("fib-wedge", "fibw-1", [0.1, 0.3, 0.5]),
};

export const FibSpiral = {
  render: () => renderStory("fib-spiral", "fibs-1", [0.15, 0.4]),
};

export const Pitchfan = {
  render: () => renderStory("pitchfan", "pf-1", [0.1, 0.3, 0.5]),
};

// ============ Pitchfork Tools ============

export const AndrewsPitchfork = {
  render: () => renderStory("andrews-pitchfork", "ap-1", [0.1, 0.3, 0.5]),
};

export const SchiffPitchfork = {
  render: () => renderStory("schiff-pitchfork", "sp-1", [0.1, 0.3, 0.5]),
};

export const ModifiedSchiffPitchfork = {
  render: () => renderStory("modified-schiff-pitchfork", "msp-1", [0.1, 0.3, 0.5]),
};

export const InsidePitchfork = {
  render: () => renderStory("inside-pitchfork", "ip-1", [0.1, 0.3, 0.5]),
};

// ============ Gann Tools ============

export const GannFan = {
  render: () => renderStory("gann-fan", "gf-1", [0.15, 0.4]),
};

export const GannBox = {
  render: () => renderStory("gann-box", "gb-1", [0.15, 0.4]),
};

export const GannSquareFixed = {
  render: () => renderStory("gann-square-fixed", "gsf-1", [0.3]),
};

export const GannSquare = {
  render: () => renderStory("gann-square", "gs-1", [0.15, 0.4]),
};

// ============ Forecasting Tools ============

export const LongPosition = {
  render: () => renderStory("long-position", "lp-1", [0.1, 0.3, 0.5]),
};

export const ShortPosition = {
  render: () => renderStory("short-position", "sp2-1", [0.1, 0.3, 0.5]),
};

export const DateRange = {
  render: () => renderStory("date-range", "dr-1", [0.1, 0.5]),
};

export const DatePriceRange = {
  render: () => renderStory("date-price-range", "dpr-1", [0.1, 0.5]),
};

export const Projection = {
  render: () => renderStory("projection", "proj-1", [0.1, 0.3, 0.5]),
};

export const Forecast = {
  render: () => renderStory("forecast", "fc-1", [0.15, 0.4]),
};

export const BarsPattern = {
  render: () => renderStory("bars-pattern", "bp-1", [0.1, 0.3, 0.5]),
};

// ============ Annotation Tools ============

export const TextAnnotation = {
  render: () => renderStory("text-annotation", "ta-1", [0.4]),
};

export const Callout = {
  render: () => renderStory("callout", "co-1", [0.3, 0.5]),
};

export const Brush = {
  render: () => renderStory("brush", "br-1", [0.15, 0.45]),
};

export const Highlighter = {
  render: () => renderStory("highlighter", "hi-1", [0.15, 0.45]),
};

export const ArrowMarker = {
  render: () => renderStory("arrow-marker", "am-1", [0.4]),
};

export const ArrowMarkUp = {
  render: () => renderStory("arrow-mark-up", "amu-1", [0.4]),
};

export const ArrowMarkDown = {
  render: () => renderStory("arrow-mark-down", "amd-1", [0.4]),
};

export const AnchoredText = {
  render: () => renderStory("anchored-text", "at-1", [0.3, 0.5]),
};

export const Note = {
  render: () => renderStory("note", "note-1", [0.4]),
};

export const PriceNote = {
  render: () => renderStory("price-note", "pn-1", [0.4]),
};

export const PriceLabel = {
  render: () => renderStory("price-label", "pl-1", [0.4]),
};

export const FlagMark = {
  render: () => renderStory("flag-mark", "fm-1", [0.4]),
};

export const Pin = {
  render: () => renderStory("pin", "pin-1", [0.4]),
};

export const Comment = {
  render: () => renderStory("comment", "cm-1", [0.4]),
};

export const Signpost = {
  render: () => renderStory("signpost", "sg-1", [0.4]),
};

export const Table = {
  render: () => renderStory("table", "tbl-1", [0.4]),
};