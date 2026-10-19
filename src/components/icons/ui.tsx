import { PureComponent, type ReactNode, type SVGProps } from "react";
import type { IconComponent, IconProps } from "./createIcon";
import { Icons } from "./general";

interface StaticIconOptions {
  width: number;
  height: number;
  viewBox: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: SVGProps<SVGSVGElement>["strokeLinecap"];
  strokeLinejoin?: SVGProps<SVGSVGElement>["strokeLinejoin"];
}

function scaled(value: number) {
  return Number(value.toFixed(4));
}

function resolveDimensions(
  size: number | undefined,
  width: IconProps["width"],
  height: IconProps["height"],
  defaultWidth: number,
  defaultHeight: number,
) {
  if (width !== undefined || height !== undefined) {
    return {
      width: width ?? defaultWidth,
      height: height ?? defaultHeight,
    };
  }
  if (size === undefined) return { width: defaultWidth, height: defaultHeight };
  const scale = size / Math.max(defaultWidth, defaultHeight);
  return {
    width: scaled(defaultWidth * scale),
    height: scaled(defaultHeight * scale),
  };
}

function createStaticIcon(displayName: string, children: ReactNode, options: StaticIconOptions): IconComponent {
  class StaticIcon extends PureComponent<IconProps> {
    static displayName = displayName;

    render() {
      const { size, width, height, ...rest } = this.props;
      const dims = resolveDimensions(size, width, height, options.width, options.height);
      return (
        <svg
          width={dims.width}
          height={dims.height}
          viewBox={options.viewBox}
          fill={options.fill ?? "none"}
          stroke={options.stroke ?? "currentColor"}
          strokeWidth={options.strokeWidth ?? 1.2}
          strokeLinecap={options.strokeLinecap}
          strokeLinejoin={options.strokeLinejoin}
          aria-hidden="true"
          focusable="false"
          {...rest}
        >
          {children}
        </svg>
      );
    }
  }

  return StaticIcon;
}

const CalendarIcon: IconComponent = Icons.calendar;
const CheckIcon: IconComponent = Icons.cmCheck;
const EyeOffIcon: IconComponent = Icons.eyeOff;
const LayersIcon: IconComponent = Icons.layers;
const SettingsIcon: IconComponent = Icons.settings;
const TrashIcon: IconComponent = Icons.trash;

const CommonChevronIcon = createStaticIcon(
  "CommonChevronIcon",
  <path d="M4 6.5l4 4 4-4" />,
  { width: 16, height: 16, viewBox: "0 0 16 16", strokeWidth: 1.2 },
);
const CommonCloseIcon = createStaticIcon(
  "CommonCloseIcon",
  <path d="M8 8l12 12M20 8L8 20" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.3 },
);
const CommonTickIcon = createStaticIcon(
  "CommonTickIcon",
  <path d="M4.5 9.5l3 3 6-7" />,
  { width: 18, height: 18, viewBox: "0 0 18 18", stroke: "#fff", strokeWidth: 2 },
);

export const CommonIcons = {
  chevron: CommonChevronIcon,
  close: CommonCloseIcon,
  tick: CommonTickIcon,
} as const;

export const ObjectSettingsPencilIcon = createStaticIcon(
  "ObjectSettingsPencilIcon",
  <path d="M7 21l1-4L19 6l3 3L11 20zM17 8l3 3" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2 },
);

const ObjectSettingsSolidIcon = createStaticIcon(
  "ObjectSettingsSolidIcon",
  <path d="M4 14h20" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.25 },
);
const ObjectSettingsDashedIcon = createStaticIcon(
  "ObjectSettingsDashedIcon",
  <>
    <path d="M4 14h5" />
    <path d="M12 14h5" />
    <path d="M20 14h5" />
  </>,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.25 },
);
const ObjectSettingsDottedIcon = createStaticIcon(
  "ObjectSettingsDottedIcon",
  <>
    <path d="M5 14h1.5" />
    <path d="M10 14h1.5" />
    <path d="M15 14h1.5" />
    <path d="M20 14h1.5" />
  </>,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.8 },
);
const ObjectSettingsLeftNormalIcon = createStaticIcon(
  "ObjectSettingsLeftNormalIcon",
  <>
    <circle cx="8" cy="14" r="2.5" />
    <path d="M10.5 14H23" />
  </>,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.4 },
);
const ObjectSettingsLeftArrowIcon = createStaticIcon(
  "ObjectSettingsLeftArrowIcon",
  <path d="M6 14h17M11 9l-5 5 5 5" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.4 },
);
const ObjectSettingsRightNormalIcon = createStaticIcon(
  "ObjectSettingsRightNormalIcon",
  <>
    <circle cx="20" cy="14" r="2.5" />
    <path d="M5 14h12.5" />
  </>,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.4 },
);
const ObjectSettingsRightArrowIcon = createStaticIcon(
  "ObjectSettingsRightArrowIcon",
  <path d="M5 14h17M17 9l5 5-5 5" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.4 },
);

export const ObjectSettingsIcons = {
  solid: ObjectSettingsSolidIcon,
  dashed: ObjectSettingsDashedIcon,
  dotted: ObjectSettingsDottedIcon,
  leftNormal: ObjectSettingsLeftNormalIcon,
  leftArrow: ObjectSettingsLeftArrowIcon,
  rightNormal: ObjectSettingsRightNormalIcon,
  rightArrow: ObjectSettingsRightArrowIcon,
} as const;

const ChartSettingsSymbolTabIcon = createStaticIcon(
  "ChartSettingsSymbolTabIcon",
  <>
    <rect x="6.5" y="9.5" width="5" height="11" />
    <path d="M9 5v4.5M9 20.5V25" />
    <rect x="18.5" y="11.5" width="5" height="9" />
    <path d="M21 7v4.5M21 20.5V24" />
  </>,
  { width: 30, height: 30, viewBox: "0 0 30 30", strokeWidth: 1.2 },
);
const ChartSettingsStatusLineTabIcon = createStaticIcon(
  "ChartSettingsStatusLineTabIcon",
  <path d="M5 7h20M5 7.5V9h20V7.5M6 13h18M6 17h18M6 21h12" />,
  { width: 30, height: 30, viewBox: "0 0 30 30", strokeWidth: 1.2 },
);
const ChartSettingsScalesTabIcon = createStaticIcon(
  "ChartSettingsScalesTabIcon",
  <>
    <path d="M9 5v17h14M6 8l3-3 3 3M20 19l3 3-3 3" />
    <circle cx="9" cy="22" r="2" fill="#fff" />
  </>,
  { width: 30, height: 30, viewBox: "0 0 30 30", strokeWidth: 1.2 },
);
const ChartSettingsAppearanceTabIcon = createStaticIcon(
  "ChartSettingsAppearanceTabIcon",
  <path d="M7 23l1-5L20 6l4 4L12 22zM18 8l4 4M8 18l4 4" />,
  { width: 30, height: 30, viewBox: "0 0 30 30", strokeWidth: 1.2 },
);

export const ChartSettingsTabIcons = {
  Symbol: ChartSettingsSymbolTabIcon,
  "Status line": ChartSettingsStatusLineTabIcon,
  Scales: ChartSettingsScalesTabIcon,
  Appearance: ChartSettingsAppearanceTabIcon,
} as const;

export const ChartSettingsLineIcons = {
  solid: ObjectSettingsSolidIcon,
  dashed: ObjectSettingsDashedIcon,
  dotted: ObjectSettingsDottedIcon,
} as const;

export interface GoToArrowIconProps extends IconProps {
  direction?: "left" | "right";
}

export class GoToArrowIcon extends PureComponent<GoToArrowIconProps> {
  static displayName = "GoToArrowIcon";

  render() {
    const { direction = "left", size, width, height, ...rest } = this.props;
    const dims = resolveDimensions(size, width, height, 16, 16);
    const d = direction === "left" ? "M10 2.5L4.5 8 10 13.5" : "M6 2.5L11.5 8 6 13.5";
    return (
      <svg
        width={dims.width}
        height={dims.height}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        <path d={d} />
      </svg>
    );
  }
}

const GoToCalendarIcon = createStaticIcon(
  "GoToCalendarIcon",
  <>
    <rect x="2.5" y="3.5" width="15" height="14" rx="2" />
    <path d="M2.5 7.5h15M6.5 2v3M13.5 2v3" />
    <g fill="currentColor" stroke="none">
      <circle cx="6.5" cy="10.5" r=".8" />
      <circle cx="10" cy="10.5" r=".8" />
      <circle cx="13.5" cy="10.5" r=".8" />
      <circle cx="6.5" cy="14" r=".8" />
      <circle cx="10" cy="14" r=".8" />
      <circle cx="13.5" cy="14" r=".8" />
    </g>
  </>,
  { width: 20, height: 20, viewBox: "0 0 20 20", strokeWidth: 1.1 },
);
const GoToClockIcon = createStaticIcon(
  "GoToClockIcon",
  <>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 5.5V10l3 2" />
  </>,
  { width: 20, height: 20, viewBox: "0 0 20 20", strokeWidth: 1.1, strokeLinecap: "round" },
);

export const GoToIcons = {
  arrow: GoToArrowIcon,
  calendar: GoToCalendarIcon,
  clock: GoToClockIcon,
} as const;

const SymbolSearchCloseIcon = createStaticIcon(
  "SymbolSearchCloseIcon",
  <path d="M1.5 1.5l14 14M15.5 1.5l-14 14" />,
  { width: 17, height: 17, viewBox: "0 0 17 17", strokeWidth: 1.4, strokeLinecap: "round" },
);
const SymbolSearchSearchIcon = createStaticIcon(
  "SymbolSearchSearchIcon",
  <>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M12.6 12.6L17 17" />
  </>,
  { width: 18, height: 18, viewBox: "0 0 18 18", strokeWidth: 1.2, strokeLinecap: "round" },
);
const SymbolSearchEmptyIcon = createStaticIcon(
  "SymbolSearchEmptyIcon",
  <>
    <path d="M22 90V38C22 21 31 4 44 4s22 17 22 34v52H52V74H36v16z" />
    <path d="M22 36L8 42l9 14 5-8M66 36l14 6-9 14-5-8" />
    <circle cx="36" cy="38" r="2.2" fill="currentColor" />
    <circle cx="52" cy="38" r="2.2" fill="currentColor" />
  </>,
  { width: 88, height: 92, viewBox: "0 0 88 92", strokeWidth: 3, strokeLinejoin: "round" },
);

export const SymbolSearchIcons = {
  close: SymbolSearchCloseIcon,
  search: SymbolSearchSearchIcon,
  empty: SymbolSearchEmptyIcon,
} as const;

export interface FavoritesStarIconProps extends IconProps {
  filled?: boolean;
}

export class FavoritesStarIcon extends PureComponent<FavoritesStarIconProps> {
  static displayName = "FavoritesStarIcon";

  render() {
    const { filled = false, size, width, height, ...rest } = this.props;
    const dims = resolveDimensions(size, width, height, 22, 22);
    return (
      <svg
        width={dims.width}
        height={dims.height}
        viewBox="0 0 22 22"
        fill={filled ? "#ffc107" : "none"}
        stroke={filled ? "#ffc107" : "currentColor"}
        strokeWidth={1.1}
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        <path d="M11 4.6l1.9 4 4.4.6-3.2 3.1.8 4.4L11 14.5l-3.9 2.2.8-4.4-3.2-3.1 4.4-.6z" />
      </svg>
    );
  }
}

export const FavoritesIcons = {
  star: FavoritesStarIcon,
} as const;

const topBarStarPoints = Array.from({ length: 10 }, (_, index) => {
  const angle = (Math.PI / 5) * index - Math.PI / 2;
  const radius = index % 2 === 0 ? 7.5 : 3.3;
  return `${(9 + radius * Math.cos(angle)).toFixed(2)},${(9.6 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

export interface TopBarChevronIconProps extends IconProps {
  up?: boolean;
}

export class TopBarChevronIcon extends PureComponent<TopBarChevronIconProps> {
  static displayName = "TopBarChevronIcon";

  render() {
    const { up = false, size, width, height, ...rest } = this.props;
    const dims = resolveDimensions(size, width, height, 8, 4);
    const d = up ? "M1 3.2 4 .8l3 2.4" : "M1 .8l3 2.4 3-2.4";
    return (
      <svg
        width={dims.width}
        height={dims.height}
        viewBox="0 0 8 4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        <path d={d} />
      </svg>
    );
  }
}

export interface TopBarStarIconProps extends IconProps {
  filled?: boolean;
}

export class TopBarStarIcon extends PureComponent<TopBarStarIconProps> {
  static displayName = "TopBarStarIcon";

  render() {
    const { filled = false, size, width, height, ...rest } = this.props;
    const dims = resolveDimensions(size, width, height, 18, 18);
    return (
      <svg
        width={dims.width}
        height={dims.height}
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        <polygon points={topBarStarPoints} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.1} strokeLinejoin="round" />
      </svg>
    );
  }
}

export const TopBarIcons = {
  chevron: TopBarChevronIcon,
  star: TopBarStarIcon,
} as const;

const CheckMark18x14Icon = createStaticIcon(
  "CheckMark18x14Icon",
  <path d="M1.5 7.5l5 5L16.5 1.5" />,
  { width: 18, height: 14, viewBox: "0 0 18 14", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" },
);

export const BottomBarGoToIcon = createStaticIcon(
  "BottomBarGoToIcon",
  <>
    <rect x="6" y="8" width="16" height="14" rx="1.5" />
    <path d="M6 12h16M10 6v4M18 6v4" />
  </>,
  { width: 22, height: 22, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);

export const BottomBarIcons = {
  check: CheckMark18x14Icon,
  goto: BottomBarGoToIcon,
} as const;

const ColorPalettePlusIcon = createStaticIcon(
  "ColorPalettePlusIcon",
  <path d="M8 3v10M3 8h10" />,
  { width: 16, height: 16, viewBox: "0 0 16 16", strokeWidth: 1.3 },
);

export const ColorPaletteIcons = {
  plus: ColorPalettePlusIcon,
} as const;

const GlyphPickerRecentIcon = createStaticIcon(
  "GlyphPickerRecentIcon",
  <>
    <circle cx="14" cy="14" r="8" />
    <path d="M14 9v5l3 2" />
  </>,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerSmileysIcon = createStaticIcon(
  "GlyphPickerSmileysIcon",
  <>
    <circle cx="14" cy="14" r="8" />
    <path d="M11 12v1M17 12v1M10.5 16.5c1.8 2 5.2 2 7 0" />
  </>,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerFlagsIcon = createStaticIcon(
  "GlyphPickerFlagsIcon",
  <path d="M9 22V6M9 7c3-2 5 2 9 0v8c-4 2-6-2-9 0" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerNatureIcon = createStaticIcon(
  "GlyphPickerNatureIcon",
  <path d="M18 7a8 8 0 100 14 6.5 6.5 0 010-14z" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerCurrencyIcon = createStaticIcon(
  "GlyphPickerCurrencyIcon",
  <path d="M8 8l3 12 3-9 3 9 3-12M7 12h14M7 16h14" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerObjectsIcon = createStaticIcon(
  "GlyphPickerObjectsIcon",
  <path d="M11 18c-2-1-3-3-3-5a6 6 0 0112 0c0 2-1 4-3 5v2h-6zM11.5 22h5" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerArrowsIcon = createStaticIcon(
  "GlyphPickerArrowsIcon",
  <path d="M21 14H8M13 8l-6 6 6 6" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerPeopleIcon = GlyphPickerSmileysIcon;
const GlyphPickerAnimalsIcon = createStaticIcon(
  "GlyphPickerAnimalsIcon",
  <path d="M8 21V9l4 3h4l4-3v12zM12 16h.01M16 16h.01" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerFoodIcon = createStaticIcon(
  "GlyphPickerFoodIcon",
  <path d="M8 12h12l-1.5 10h-9zM10 12c0-3 2-5 4-5s4 2 4 5" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerSportsIcon = createStaticIcon(
  "GlyphPickerSportsIcon",
  <>
    <circle cx="14" cy="14" r="8" />
    <path d="M6 14h16M14 6c3 3 3 13 0 16M14 6c-3 3-3 13 0 16" />
  </>,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerTravelIcon = createStaticIcon(
  "GlyphPickerTravelIcon",
  <path d="M20 8c-6 0-9 4-10 8l2 2c4-1 8-4 8-10zM10 16l-3 1 2-4M12 18l-1 3 4-2" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const GlyphPickerSymbolsIcon = createStaticIcon(
  "GlyphPickerSymbolsIcon",
  <path d="M14 21s-7-4.5-7-9.5a4 4 0 017-2.5 4 4 0 017 2.5c0 5-7 9.5-7 9.5z" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);

export const GlyphPickerTabIcons = {
  recent: GlyphPickerRecentIcon,
  smileys: GlyphPickerSmileysIcon,
  flags: GlyphPickerFlagsIcon,
  nature: GlyphPickerNatureIcon,
  currency: GlyphPickerCurrencyIcon,
  objects: GlyphPickerObjectsIcon,
  arrows: GlyphPickerArrowsIcon,
  people: GlyphPickerPeopleIcon,
  animals: GlyphPickerAnimalsIcon,
  food: GlyphPickerFoodIcon,
  sports: GlyphPickerSportsIcon,
  travel: GlyphPickerTravelIcon,
  symbols: GlyphPickerSymbolsIcon,
} as const;

const ChartNavOutIcon = createStaticIcon(
  "ChartNavOutIcon",
  <path d="M2 7h10" />,
  { width: 14, height: 14, viewBox: "0 0 14 14", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const ChartNavInIcon = createStaticIcon(
  "ChartNavInIcon",
  <path d="M7 2v10M2 7h10" />,
  { width: 14, height: 14, viewBox: "0 0 14 14", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const ChartNavLeftIcon = createStaticIcon(
  "ChartNavLeftIcon",
  <path d="M8.5 1.5L3.5 7l5 5.5" />,
  { width: 14, height: 14, viewBox: "0 0 14 14", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const ChartNavRightIcon = createStaticIcon(
  "ChartNavRightIcon",
  <path d="M5.5 1.5l5 5.5-5 5.5" />,
  { width: 14, height: 14, viewBox: "0 0 14 14", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const ChartNavResetIcon = createStaticIcon(
  "ChartNavResetIcon",
  <>
    <path d="M1 10a6 6 0 1 0 6-6H3" />
    <path d="M5 1L2.5 4 5 7" />
  </>,
  { width: 14, height: 18, viewBox: "0 0 14 18", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const ChartNavPresentIcon = createStaticIcon(
  "ChartNavPresentIcon",
  <path d="M2.5 2.5L7 7l-4.5 4.5M7.5 2.5L12 7l-4.5 4.5" />,
  { width: 14, height: 14, viewBox: "0 0 14 14", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
);

export const ChartNavIcons = {
  out: ChartNavOutIcon,
  in: ChartNavInIcon,
  left: ChartNavLeftIcon,
  right: ChartNavRightIcon,
  reset: ChartNavResetIcon,
  present: ChartNavPresentIcon,
} as const;

const LegendInfoIcon = createStaticIcon(
  "LegendInfoIcon",
  <>
    <circle cx="14" cy="14" r="8.5" />
    <path d="M14 13v6M14 9.6v1.2" />
  </>,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const LegendMoveToIcon = createStaticIcon(
  "LegendMoveToIcon",
  <path d="M14 5.5l-7 5 7 5 7-5zM7 17l7 5 7-5M10.5 13.5L14 16l3.5-2.5" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const LegendPinIcon = createStaticIcon(
  "LegendPinIcon",
  <path d="M7 5v15h15M4 8l3-3 3 3M19 17l3 3-3 3" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const LegendChevronIcon = createStaticIcon(
  "LegendChevronIcon",
  <path d="M11 8l6 6-6 6" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);
const LegendDotsIcon = createStaticIcon(
  "LegendDotsIcon",
  <>
    <circle cx="7.5" cy="14" r="1.7" />
    <circle cx="14" cy="14" r="1.7" />
    <circle cx="20.5" cy="14" r="1.7" />
  </>,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);

const LegendSourceIcon = createStaticIcon(
  "LegendSourceIcon",
  <path d="M11.5 8.5c-1.6 0-2.3.8-2.3 2.3v2.1c0 1.1-.5 1.6-1.4 1.6.9 0 1.4.5 1.4 1.6v2.1c0 1.5.7 2.3 2.3 2.3M16.5 8.5c1.6 0 2.3.8 2.3 2.3v2.1c0 1.1.5 1.6 1.4 1.6-.9 0-1.4.5-1.4 1.6v2.1c0 1.5-.7 2.3-2.3 2.3" />,
  { width: 28, height: 28, viewBox: "0 0 28 28", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" },
);

export const LegendIcons = {
  source: LegendSourceIcon,
  info: LegendInfoIcon,
  moveTo: LegendMoveToIcon,
  pin: LegendPinIcon,
  eyeOff: EyeOffIcon,
  gear: SettingsIcon,
  layers: LayersIcon,
  chev: LegendChevronIcon,
  check: CheckIcon,
  trash: TrashIcon,
  dots: LegendDotsIcon,
} as const;

const ScaleGearIcon = createStaticIcon(
  "ScaleGearIcon",
  <>
    <circle cx="7.5" cy="7.5" r="3.4" />
    <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2M2.9 2.9l1.4 1.4M10.7 10.7l1.4 1.4M12.1 2.9l-1.4 1.4M4.3 10.7l-1.4 1.4" />
  </>,
  { width: 15, height: 15, viewBox: "0 0 15 15", strokeWidth: 1.1, strokeLinecap: "round" },
);
const ScaleGearChevronIcon = createStaticIcon(
  "ScaleGearChevronIcon",
  <path d="M1.5 1.5l4.5 4.5-4.5 4.5" />,
  { width: 8, height: 12, viewBox: "0 0 8 12", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" },
);

export const ScaleGearIcons = {
  gear: ScaleGearIcon,
  check: CheckMark18x14Icon,
  chevron: ScaleGearChevronIcon,
} as const;

const paneFill = { width: 15, height: 15, viewBox: "0 0 15 15", fill: "currentColor", stroke: "none" } as const;
const paneStroke = { width: 15, height: 15, viewBox: "0 0 15 15", strokeWidth: 1 } as const;

/** The buttons in a pane's top-right corner (move, delete, collapse, maximize). */
export const PaneIcons = {
  up: createStaticIcon("PaneUpIcon", <path d="M11.83 6.12l-.66.76L8 4.1V12H7V4.1L3.83 6.88l-.66-.76L7.5 2.34l4.33 3.78z" />, paneFill),
  down: createStaticIcon("PaneDownIcon", <path d="M11.83 8.88l-.66-.76L8 10.9V3H7v7.9L3.83 8.12l-.66.76 4.33 3.78 4.33-3.78z" />, paneFill),
  close: createStaticIcon(
    "PaneCloseIcon",
    <path d="M6.5 2a.5.5 0 0 0-.5.5V3h3v-.5a.5.5 0 0 0-.5-.5h-2ZM10 3h3v1h-1.05l-.86 8.65A1.5 1.5 0 0 1 9.59 14H5.4a1.5 1.5 0 0 1-1.49-1.35L3.05 4H2V3h3v-.5C5 1.67 5.67 1 6.5 1h2c.83 0 1.5.67 1.5 1.5V3ZM4.05 4l.86 8.55a.5.5 0 0 0 .5.45H9.6a.5.5 0 0 0 .5-.45L10.94 4h-6.9Z" />,
    paneFill,
  ),
  collapse: createStaticIcon("PaneCollapseIcon", <><path d="M11 2 7.5 5 4 2" /><path d="M4 13l3.5-3 3.5 3" /></>, paneStroke),
  restore: createStaticIcon("PaneRestoreIcon", <><path d="m4 5 3.5-3L11 5" /><path d="M11 10l-3.5 3L4 10" /></>, paneStroke),
  maximize: createStaticIcon(
    "PaneMaximizeIcon",
    <>
      <path d="M4.5 12A1.5 1.5 0 0 1 3 10.5V9H2v1.5A2.5 2.5 0 0 0 4.5 13h6a2.5 2.5 0 0 0 2.5-2.5V9h-1v1.5c0 .83-.67 1.5-1.5 1.5h-6z" />
      <path d="M4.5 3C3.67 3 3 3.67 3 4.5V6H2V4.5A2.5 2.5 0 0 1 4.5 2h6A2.5 2.5 0 0 1 13 4.5V6h-1V4.5c0-.83-.67-1.5-1.5-1.5h-6z" />
    </>,
    paneFill,
  ),
} as const;
