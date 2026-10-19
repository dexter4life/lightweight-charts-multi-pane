import type { IconComponent } from "./createIcon";
import { createIcon } from "./createIcon";

const toolIconsById = {
  cursor_cross: createIcon("CursorCrossToolIcon", (<path d={"M14 5v6M14 17v6M5 14h6M17 14h6"} />)),
  cursor_dot: createIcon("CursorDotToolIcon", (<circle cx={"14"} cy={"14"} r={"2.2"} fill={"currentColor"} />)),
  cursor_arrow: createIcon("CursorArrowToolIcon", (<path d={"M9 6l11 8-5 1.2 3 5.3-2 1.2-3-5.3L9 20z"} />)),
  cursor_demo: createIcon("CursorDemoToolIcon", (<>
  <circle cx={"14"} cy={"14"} r={"10"} />
  <path d={"M10.5 9.5l8 5.2-3.4 1 -1.4 3.4z"} />
</>)),
  cursor_eraser: createIcon("CursorEraserToolIcon", (<path d={"M7 17l8-9 6 5-6 7H10zM12 20h9"} />)),
  trendline: createIcon("TrendlineToolIcon", (<>
  <path d={"M8.5 19.5L19.5 8.5"} />
  <circle cx={"7"} cy={"21"} r={"2"} />
  <circle cx={"21"} cy={"7"} r={"2"} />
</>)),
  arrow: createIcon("ArrowToolIcon", (<>
  <path d={"M8 20L20 8M20 8h-6M20 8v6"} />
  <circle cx={"7"} cy={"21"} r={"2"} />
</>)),
  ray: createIcon("RayToolIcon", (<>
  <path d={"M9 19L24 4"} />
  <circle cx={"7"} cy={"21"} r={"2"} />
  <circle cx={"14"} cy={"14"} r={"2"} />
</>)),
  "info-line": createIcon("InfoLineToolIcon", (<>
  <path d={"M8.5 19.5L19.5 8.5"} />
  <circle cx={"7"} cy={"21"} r={"2"} />
  <circle cx={"21"} cy={"7"} r={"2"} />
  <rect x={"11"} y={"9"} width={"6"} height={"4"} rx={"1"} transform={"rotate(0)"} />
</>)),
  "extended-line": createIcon("ExtendedLineToolIcon", (<>
  <path d={"M4 24L24 4"} />
  <circle cx={"10"} cy={"18"} r={"2"} />
  <circle cx={"18"} cy={"10"} r={"2"} />
</>)),
  "trend-angle": createIcon("TrendAngleToolIcon", (<>
  <path d={"M6 21h16M6 21L20 9"} />
  <path d={"M13 21a7 7 0 00-2-5"} />
  <circle cx={"6"} cy={"21"} r={"2"} />
  <circle cx={"20"} cy={"9"} r={"2"} />
</>)),
  "horizontal-line": createIcon("HorizontalLineToolIcon", (<>
  <path d={"M4 14h20"} />
  <circle cx={"14"} cy={"14"} r={"2"} />
</>)),
  "horizontal-ray": createIcon("HorizontalRayToolIcon", (<>
  <path d={"M10 14h14"} />
  <circle cx={"8"} cy={"14"} r={"2"} />
</>)),
  "vertical-line": createIcon("VerticalLineToolIcon", (<>
  <path d={"M14 4v20"} />
  <circle cx={"14"} cy={"14"} r={"2"} />
</>)),
  "cross-line": createIcon("CrossLineToolIcon", (<>
  <path d={"M14 4v20M4 14h20"} />
  <circle cx={"14"} cy={"14"} r={"2"} />
</>)),
  "parallel-channel": createIcon("ParallelChannelToolIcon", (<>
  <path d={"M6 17L20 7M8 23L22 13"} />
  <circle cx={"6"} cy={"17"} r={"2"} />
  <circle cx={"22"} cy={"13"} r={"2"} />
</>)),
  "regression-trend": createIcon("RegressionTrendToolIcon", (<>
  <path d={"M5 20L23 8M5 15L23 3M5 25L23 13"} strokeDasharray={"2 2"} />
  <path d={"M5 20L23 8"} />
</>)),
  "flat-top-bottom": createIcon("FlatTopBottomToolIcon", (<>
  <path d={"M5 8h18M6 20l16-8"} />
  <circle cx={"6"} cy={"20"} r={"2"} />
  <circle cx={"22"} cy={"12"} r={"2"} />
</>)),
  "disjoint-channel": createIcon("DisjointChannelToolIcon", (<>
  <path d={"M5 18l8-9M15 22l8-9"} />
  <circle cx={"5"} cy={"18"} r={"2"} />
  <circle cx={"23"} cy={"13"} r={"2"} />
</>)),
  fib_retracement: createIcon("FibRetracementToolIcon", (<>
  <path d={"M6 7h16M6 12h16M6 17h16M6 22h16"} />
  <circle cx={"7"} cy={"7"} r={"1.6"} />
  <circle cx={"21"} cy={"22"} r={"1.6"} />
</>)),
  "fib-extension": createIcon("FibExtensionToolIcon", (<>
  <path d={"M5 6h18M5 12h18M5 18h18M5 23h18"} />
  <circle cx={"6"} cy={"6"} r={"2"} />
  <circle cx={"22"} cy={"12"} r={"2"} />
  <circle cx={"6"} cy={"23"} r={"2"} />
</>)),
  "andrews-pitchfork": createIcon("AndrewsPitchforkToolIcon", (<>
  <path d={"M5 22L14 8M14 8l9 10M9 15l10 3M14 8v14"} />
  <circle cx={"5"} cy={"22"} r={"2"} />
</>)),
  "schiff-pitchfork": createIcon("SchiffPitchforkToolIcon", (<>
  <path d={"M5 22L14 8M14 8l9 10M9 15l10 3M14 8v14"} />
  <circle cx={"5"} cy={"22"} r={"2"} />
</>)),
  "modified-schiff-pitchfork": createIcon("ModifiedSchiffPitchforkToolIcon", (<>
  <path d={"M5 22L14 8M14 8l9 10M9 15l10 3M14 8v14"} />
  <circle cx={"5"} cy={"22"} r={"2"} />
</>)),
  "inside-pitchfork": createIcon("InsidePitchforkToolIcon", (<>
  <path d={"M5 22L14 8M14 8l9 10M9 15l10 3M14 8v14"} />
  <circle cx={"5"} cy={"22"} r={"2"} />
</>)),
  "fib-channel": createIcon("FibChannelToolIcon", (<path d={"M5 22L23 10M5 17L23 5M5 25L23 13"} />)),
  "fib-time-zone": createIcon("FibTimeZoneToolIcon", (<path d={"M6 5v18M11 5v18M16 5v18M21 5v18"} />)),
  "gann-box": createIcon("GannBoxToolIcon", (<>
  <rect x={"5"} y={"5"} width={"18"} height={"18"} />
  <path d={"M5 5l18 18M5 23L23 5M14 5v18M5 14h18"} />
</>)),
  "gann-square-fixed": createIcon("GannSquareFixedToolIcon", (<>
  <rect x={"5"} y={"5"} width={"18"} height={"18"} />
  <path d={"M5 5l18 18M5 23L23 5M14 5v18M5 14h18"} />
</>)),
  "gann-square": createIcon("GannSquareToolIcon", (<>
  <rect x={"5"} y={"5"} width={"18"} height={"18"} />
  <path d={"M5 5l18 18M5 23L23 5M14 5v18M5 14h18"} />
</>)),
  "gann-fan": createIcon("GannFanToolIcon", (<>
  <path d={"M5 23L23 5M5 23L23 11M5 23L23 17M5 23L17 5M5 23L11 5"} />
  <circle cx={"5"} cy={"23"} r={"2"} />
</>)),
  "fib-speed-fan": createIcon("FibSpeedFanToolIcon", (<>
  <path d={"M5 23L23 5M5 23L23 11M5 23L23 17M5 23L17 5M5 23L11 5"} />
  <circle cx={"5"} cy={"23"} r={"2"} />
</>)),
  "fib-time-extension": createIcon("FibTimeExtensionToolIcon", (<path d={"M6 5v18M11 5v18M16 5v18M21 5v18"} />)),
  "fib-circles": createIcon("FibCirclesToolIcon", (<>
  <circle cx={"14"} cy={"14"} r={"9"} />
  <circle cx={"14"} cy={"14"} r={"5"} />
  <circle cx={"14"} cy={"14"} r={"1.5"} />
</>)),
  pitchfan: createIcon("PitchfanToolIcon", (<>
  <path d={"M5 22L22 5M5 22L22 11M5 22L22 17M5 22L22 22"} />
  <circle cx={"5"} cy={"22"} r={"2"} />
</>)),
  "fib-spiral": createIcon("FibSpiralToolIcon", (<path d={"M14 14a2 2 0 112 2 4 4 0 11-6-4 7 7 0 1110 8"} />)),
  "fib-arcs": createIcon("FibArcsToolIcon", (<>
  <path d={"M5 22a13 13 0 0118-9M8 22a9 9 0 0112-5M5 22L23 22"} />
  <circle cx={"5"} cy={"22"} r={"2"} />
</>)),
  "fib-wedge": createIcon("FibWedgeToolIcon", (<>
  <path d={"M6 22L22 6M6 22L22 14M6 22a13 13 0 0116-8"} />
  <circle cx={"6"} cy={"22"} r={"2"} />
</>)),
  brush: createIcon("BrushToolIcon", (<path d={"M18 5l5 5-8 8-5-5zM10 13c-3 1-3 5-5 8 4 0 8 0 8-4"} />)),
  highlighter: createIcon("HighlighterToolIcon", (<path d={"M7 21l3-1 10-10-3-3L7 17zM6 24h10"} />)),
  rectangle: createIcon("RectangleToolIcon", (<>
  <rect x={"6"} y={"7"} width={"16"} height={"14"} />
  <circle cx={"6"} cy={"7"} r={"2"} />
  <circle cx={"22"} cy={"21"} r={"2"} />
</>)),
  circle: createIcon("CircleToolIcon", (<>
  <circle cx={"14"} cy={"14"} r={"8"} />
  <circle cx={"14"} cy={"14"} r={"2"} />
</>)),
  ellipse: createIcon("EllipseToolIcon", (<>
  <ellipse cx={"14"} cy={"14"} rx={"10"} ry={"6.5"} />
  <circle cx={"14"} cy={"14"} r={"2"} />
</>)),
  path: createIcon("PathToolIcon", (<>
  <path d={"M5 21l6-9 5 5 7-9"} />
  <circle cx={"5"} cy={"21"} r={"2"} />
  <circle cx={"23"} cy={"8"} r={"2"} />
</>)),
  curve: createIcon("CurveToolIcon", (<>
  <path d={"M5 21C9 5 19 5 23 21"} />
  <circle cx={"5"} cy={"21"} r={"2"} />
  <circle cx={"23"} cy={"21"} r={"2"} />
</>)),
  polyline: createIcon("PolylineToolIcon", (<>
  <path d={"M5 20l5-10 6 8 6-11"} />
  <circle cx={"5"} cy={"20"} r={"2"} />
  <circle cx={"10"} cy={"10"} r={"2"} />
  <circle cx={"16"} cy={"18"} r={"2"} />
  <circle cx={"22"} cy={"7"} r={"2"} />
</>)),
  triangle: createIcon("TriangleToolIcon", (<>
  <path d={"M14 6l9 16H5z"} />
  <circle cx={"14"} cy={"6"} r={"2"} />
</>)),
  "rotated-rectangle": createIcon("RotatedRectangleToolIcon", (<path d={"M5 15l8-9 10 6-8 9z"} />)),
  arc: createIcon("ArcToolIcon", (<>
  <path d={"M5 20a10 10 0 0118 0"} />
  <circle cx={"5"} cy={"20"} r={"2"} />
  <circle cx={"23"} cy={"20"} r={"2"} />
</>)),
  "double-curve": createIcon("DoubleCurveToolIcon", (<path d={"M4 16c3-9 7-9 10 0s7 9 10 0"} />)),
  text: createIcon("TextToolIcon", (<path d={"M8 8V6h12v2M14 6v16M11 22h6"} />)),
  "anchored-text": createIcon("AnchoredTextToolIcon", (<path d={"M8 6h12M14 6v11M11 17h6M14 17v8M11 22l3 3 3-3"} />)),
  note: createIcon("NoteToolIcon", (<>
  <path d={"M7 6h14v14h-5l-4 4v-4H7z"} />
  <path d={"M10 11h8M10 15h5"} />
</>)),
  pin: createIcon("PinToolIcon", (<>
  <path d={"M14 24s-6-6-6-11a6 6 0 0112 0c0 5-6 11-6 11z"} />
  <circle cx={"14"} cy={"13"} r={"2"} />
</>)),
  signpost: createIcon("SignpostToolIcon", (<path d={"M14 4v20M8 8h12l2 3-2 3H8zM20 18H8"} />)),
  callout: createIcon("CalloutToolIcon", (<path d={"M6 6h16v11h-8l-4 5v-5H6z"} />)),
  comment: createIcon("CommentToolIcon", (<>
  <path d={"M6 7h16v11H12l-5 4v-4H6z"} />
  <path d={"M10 11h8M10 14h5"} />
</>)),
  "price-label": createIcon("PriceLabelToolIcon", (<path d={"M5 8h14l4 6-4 6H5z"} />)),
  "price-note": createIcon("PriceNoteToolIcon", (<>
  <path d={"M5 20L14 12h9"} />
  <circle cx={"5"} cy={"20"} r={"1.6"} />
  <path d={"M14 8h9v8h-9z"} />
</>)),
  "arrow-marker": createIcon("ArrowMarkerToolIcon", (<path d={"M14 24V8M7 15l7-8 7 8"} />)),
  "arrow-mark-left": createIcon("ArrowMarkLeftToolIcon", (<path d={"M24 14H8M15 7l-8 7 8 7"} />)),
  "arrow-mark-right": createIcon("ArrowMarkRightToolIcon", (<path d={"M4 14h16M13 7l8 7-8 7"} />)),
  "arrow-mark-up": createIcon("ArrowMarkUpToolIcon", (<path d={"M14 24V8M7 15l7-8 7 8"} />)),
  "arrow-mark-down": createIcon("ArrowMarkDownToolIcon", (<path d={"M14 4v16M7 13l7 8 7-8"} />)),
  "flag-mark": createIcon("FlagMarkToolIcon", (<path d={"M8 24V5M8 6h12l-3 4 3 4H8"} />)),
  xabcd_pattern: createIcon("XabcdPatternToolIcon", (<>
  <path d={"M6 20l5-12 5 9 6-10M11 8l11-1M6 20l10-3"} />
  <circle cx={"6"} cy={"20"} r={"1.5"} />
  <circle cx={"11"} cy={"8"} r={"1.5"} />
  <circle cx={"16"} cy={"17"} r={"1.5"} />
  <circle cx={"22"} cy={"7"} r={"1.5"} />
</>)),
  "cypher-pattern": createIcon("CypherPatternToolIcon", (<path d={"M5 20l5-11 6 9 7-12M10 9l-5 11M16 18L5 20"} />)),
  "abcd-pattern": createIcon("AbcdPatternToolIcon", (<>
  <path d={"M6 21l5-12 7 12 4-14"} />
  <circle cx={"6"} cy={"21"} r={"2"} />
  <circle cx={"11"} cy={"9"} r={"2"} />
  <circle cx={"18"} cy={"21"} r={"2"} />
  <circle cx={"22"} cy={"7"} r={"2"} />
</>)),
  "triangle-pattern": createIcon("TrianglePatternToolIcon", (<path d={"M5 8l18 4M5 22l18-6M5 8l9 14 9-10"} />)),
  "three-drives-pattern": createIcon("ThreeDrivesPatternToolIcon", (<path d={"M4 20l4-10 3 6 4-9 3 8 5-10"} />)),
  "head-and-shoulders": createIcon("HeadAndShouldersToolIcon", (<path d={"M4 20l4-7 3 4 3-10 3 10 3-4 4 7"} />)),
  "elliott-impulse-wave": createIcon("ElliottImpulseWaveToolIcon", (<path d={"M4 21l5-9 3 5 5-12 3 7 4-5"} />)),
  "elliott-triangle-wave": createIcon("ElliottTriangleWaveToolIcon", (<path d={"M4 21l5-9 3 5 5-12 3 7 4-5"} />)),
  "elliott-triple-combo": createIcon("ElliottTripleComboToolIcon", (<path d={"M4 21l5-9 3 5 5-12 3 7 4-5"} />)),
  "elliott-correction-wave": createIcon("ElliottCorrectionWaveToolIcon", (<path d={"M4 8l7 11 4-6 9 8"} />)),
  "elliott-double-combo": createIcon("ElliottDoubleComboToolIcon", (<path d={"M4 8l7 11 4-6 9 8"} />)),
  "cyclic-lines": createIcon("CyclicLinesToolIcon", (<path d={"M6 5v18M12 5v18M18 5v18M24 5v18"} />)),
  "time-cycles": createIcon("TimeCyclesToolIcon", (<path d={"M4 20a5 5 0 0110 0 5 5 0 0110 0"} />)),
  "sine-line": createIcon("SineLineToolIcon", (<path d={"M4 14c3-12 6-12 10 0s7 12 10 0"} />)),
  long_position: createIcon("LongPositionToolIcon", (<>
  <rect x={"6"} y={"6"} width={"16"} height={"7"} />
  <rect x={"6"} y={"13"} width={"16"} height={"9"} />
  <path d={"M6 13h16"} />
</>)),
  "short-position": createIcon("ShortPositionToolIcon", (<>
  <rect x={"6"} y={"6"} width={"16"} height={"7"} />
  <rect x={"6"} y={"13"} width={"16"} height={"9"} />
  <path d={"M6 13h16"} strokeDasharray={"2 2"} />
</>)),
  forecast: createIcon("ForecastToolIcon", (<>
  <path d={"M5 20l7-7 4 4 7-8"} />
  <path d={"M18 9h5v5"} />
  <circle cx={"5"} cy={"20"} r={"2"} />
</>)),
  "date-range": createIcon("DateRangeToolIcon", (<path d={"M6 6v16M22 6v16M6 14h16M9 11l-3 3 3 3M19 11l3 3-3 3"} />)),
  "price-range": createIcon("PriceRangeToolIcon", (<path d={"M6 6h16M6 22h16M14 6v16M11 9l3-3 3 3M11 19l3 3 3-3"} />)),
  "date-price-range": createIcon("DatePriceRangeToolIcon", (<>
  <rect x={"6"} y={"6"} width={"16"} height={"16"} />
  <path d={"M6 14h16M14 6v16"} />
</>)),
  "bars-pattern": createIcon("BarsPatternToolIcon", (<path d={"M7 7v14M7 11h-2M7 17h2M14 5v14M14 9h-2M14 15h2M21 9v14M21 13h-2M21 19h2"} />)),
  "ghost-feed": createIcon("GhostFeedToolIcon", (<path d={"M8 21V10a6 6 0 0112 0v11l-3-2-3 2-3-2z"} />)),
  projection: createIcon("ProjectionToolIcon", (<>
  <path d={"M5 21l7-9M12 12l11-3M12 12l5 8"} />
  <circle cx={"5"} cy={"21"} r={"2"} />
  <circle cx={"12"} cy={"12"} r={"2"} />
</>)),
  "fixed-range-volume-profile": createIcon("FixedRangeVolumeProfileToolIcon", (<path d={"M5 6h12M5 10h9M5 14h14M5 18h7M5 22h10"} />)),
  icon: createIcon("IconToolIcon", (<path d={"M14 22s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0122 11c0 6-8 11-8 11z"} />)),
} as const satisfies Record<string, IconComponent>;

export type ToolIconName = keyof typeof toolIconsById;
export const toolIcons: Record<string, IconComponent> = toolIconsById;
