export const PATTERN_TITLES: Record<string, string> = {
  "xabcd-pattern": "XABCD Pattern",
  "cypher-pattern": "Cypher Pattern",
  "abcd-pattern": "ABCD Pattern",
  "triangle-pattern": "Triangle Pattern",
  "three-drives-pattern": "Three Drives Pattern",
  "head-and-shoulders": "Head and Shoulders",
};

export const PATTERN_TYPES = new Set(Object.keys(PATTERN_TITLES));

/** Patterns whose dialog and toolbar have no background option. */
export const NO_FILL_PATTERNS = new Set(["abcd-pattern", "three-drives-pattern"]);

export const PATTERN_DEFAULT_STYLE: Record<string, { lineColor: string; fillColor: string }> = {
  "xabcd-pattern": { lineColor: "#2962FF", fillColor: "rgba(41, 98, 255, 0.15)" },
  "cypher-pattern": { lineColor: "#2962FF", fillColor: "rgba(41, 98, 255, 0.15)" },
  "abcd-pattern": { lineColor: "#089981", fillColor: "rgba(8, 153, 129, 0.15)" },
  "triangle-pattern": { lineColor: "#673ab7", fillColor: "rgba(103, 58, 183, 0.15)" },
  "three-drives-pattern": { lineColor: "#673ab7", fillColor: "rgba(149, 40, 204, 0.5)" },
  "head-and-shoulders": { lineColor: "#089981", fillColor: "rgba(8, 153, 129, 0.15)" },
};

export const ELLIOTT_TITLES: Record<string, string> = {
  "elliott-impulse-wave": "Elliott Impulse Wave (12345)",
  "elliott-triangle-wave": "Elliott Triangle Wave (ABCDE)",
  "elliott-triple-combo": "Elliott Triple Combo Wave (WXYXZ)",
  "elliott-correction-wave": "Elliott Correction Wave (ABC)",
  "elliott-double-combo": "Elliott Double Combo Wave (WXY)",
};

export const ELLIOTT_TYPES = new Set(Object.keys(ELLIOTT_TITLES));

export const ELLIOTT_DEFAULT_STYLE: Record<string, { lineColor: string }> = {
  "elliott-impulse-wave": { lineColor: "#3d85c6" },
  "elliott-triangle-wave": { lineColor: "#FF9800" },
  "elliott-triple-combo": { lineColor: "#6aa84f" },
  "elliott-correction-wave": { lineColor: "#3d85c6" },
  "elliott-double-combo": { lineColor: "#6aa84f" },
};

export const ELLIOTT_DEGREES = [
  "Supermillennium", "Millennium", "Submillennium", "Grand supercycle", "Supercycle", "Cycle", "Primary", "Intermediate",
  "Minor", "Minute", "Minuette", "Subminuette", "Micro", "Submicro", "Minuscule",
];

export const CYCLE_TITLES: Record<string, string> = {
  "cyclic-lines": "Cyclic Lines",
  "time-cycles": "Time Cycles",
  "sine-line": "Sine Line",
};

export const CYCLE_TYPES = new Set(Object.keys(CYCLE_TITLES));

export const RANGE_TITLES: Record<string, string> = {
  "date-range": "Date Range",
  "price-range": "Price Range",
  "date-price-range": "Date and Price Range",
};

export const RANGE_TYPES = new Set(Object.keys(RANGE_TITLES));

export const RANGE_DEFAULT_STYLE = { lineColor: "#2962FF", fillColor: "rgba(41, 98, 255, 0.15)" };

export const CYCLE_DEFAULT_STYLE: Record<string, { lineColor: string; fillColor?: string }> = {
  "cyclic-lines": { lineColor: "#80ccdb" },
  "time-cycles": { lineColor: "#159980", fillColor: "rgba(106, 168, 79, 0.5)" },
  "sine-line": { lineColor: "#159980" },
};

export const RANGE_DEFAULT_OPTIONS = {
  fillBackground: true,
  extendTop: false,
  extendBottom: false,
  extendLeft: false,
  extendRight: false,
  drawBorder: false,
  borderColor: "#2962FF",
  borderWidth: 1,
  labelSize: 12,
  labelColor: "#000000",
  fillLabel: true,
  labelBackground: "#ffffff",
  customText: { visible: false, text: "", color: "#2962FF", fontSize: 12, bold: false, italic: false },
};

export const FORECAST_DEFAULT_OPTIONS = {
  sourceTextColor: "#ffffff",
  sourceBackColor: "#2962FF",
  sourceStrokeColor: "#2962FF",
  targetTextColor: "#ffffff",
  targetBackColor: "#2962FF",
  targetStrokeColor: "#2962FF",
  successTextColor: "#ffffff",
  successBackground: "#4caf50",
  failureTextColor: "#ffffff",
  failureBackground: "#F23645",
  transparency: 10,
};
