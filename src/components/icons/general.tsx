import type { IconComponent } from "./createIcon";
import { createIcon } from "./createIcon";

export const Icons = {
  cmReset: createIcon("CmResetIcon", (<path d={"M8 14a6 6 0 106-6H9M9 5v3.5H12.5"} />)),
  cmCheck: createIcon("CmCheckIcon", (<path d={"M8 14.5l4 4 8-9"} />)),
  cmClone: createIcon("CmCloneIcon", (<>
  <rect x={"8"} y={"8"} width={"11"} height={"11"} rx={"1.5"} />
  <path d={"M12 22h8a2 2 0 002-2v-8"} />
</>)),
  cmEyeOff: createIcon("CmEyeOffIcon", (<>
  <path d={"M5 14s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM6 22L22 6"} />
  <circle cx={"14"} cy={"14"} r={"2.5"} />
</>)),
  cmOrder: createIcon("CmOrderIcon", (<path d={"M14 6l8 4-8 4-8-4zM6 15l8 4 8-4M6 19.5l8 4 8-4"} />)),
  cmCursor: createIcon("CmCursorIcon", (<>
  <path d={"M14 5v18M5 14h18"} strokeDasharray={"2 2"} />
  <circle cx={"14"} cy={"14"} r={"2"} />
</>)),
  cross: createIcon("CrossIcon", (<path d={"M14 5v6M14 17v6M5 14h6M17 14h6"} />)),
  dot: createIcon("DotIcon", (<circle cx={"14"} cy={"14"} r={"2.2"} fill={"currentColor"} />)),
  arrow: createIcon("ArrowIcon", (<path d={"M9 6l11 8-5 1.2 3 5.3-2 1.2-3-5.3L9 20z"} />)),
  eraser: createIcon("EraserIcon", (<path d={"M7 17l8-9 6 5-6 7H10zM12 20h9"} />)),
  trendline: createIcon("TrendlineIcon", (<>
  <path d={"M7 21L21 7"} />
  <circle cx={"7"} cy={"21"} r={"2"} />
  <circle cx={"21"} cy={"7"} r={"2"} />
</>)),
  fib: createIcon("FibIcon", (<>
  <path d={"M6 7h16M6 12h16M6 17h16M6 22h16"} />
  <circle cx={"7"} cy={"7"} r={"1.6"} />
  <circle cx={"21"} cy={"22"} r={"1.6"} />
</>)),
  brush: createIcon("BrushIcon", (<path d={"M18 5l5 5-8 8-5-5zM10 13c-3 1-3 5-5 8 4 0 8 0 8-4"} />)),
  text: createIcon("TextIcon", (<path d={"M8 8V6h12v2M14 6v16M11 22h6"} />)),
  xabcd: createIcon("XabcdIcon", (<>
  <path d={"M6 20l5-12 5 9 6-10M11 8l11-1M6 20l10-3"} />
  <circle cx={"6"} cy={"20"} r={"1.5"} />
  <circle cx={"11"} cy={"8"} r={"1.5"} />
  <circle cx={"16"} cy={"17"} r={"1.5"} />
  <circle cx={"22"} cy={"7"} r={"1.5"} />
</>)),
  longPosition: createIcon("LongPositionIcon", (<>
  <rect x={"6"} y={"6"} width={"16"} height={"7"} />
  <rect x={"6"} y={"13"} width={"16"} height={"9"} />
  <path d={"M6 13h16"} />
</>)),
  icon: createIcon("IconIcon", (<path d={"M14 22s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0122 11c0 6-8 11-8 11z"} />)),
  measure: createIcon("MeasureIcon", (<path d={"M5 17L17 5l6 6L11 23zM9 13l2 2M12 10l2 2M15 7l2 2"} />)),
  zoomIn: createIcon("ZoomInIcon", (<>
  <circle cx={"13"} cy={"13"} r={"7"} />
  <path d={"M18 18l6 6M13 10v6M10 13h6"} />
</>)),
  zoomOut: createIcon("ZoomOutIcon", (<>
  <circle cx={"13"} cy={"13"} r={"7"} />
  <path d={"M18 18l6 6M10 13h6"} />
</>)),
  magnet: createIcon("MagnetIcon", (<path d={"M8 21V12a6 6 0 0112 0v9h-4v-9a2 2 0 00-4 0v9zM8 17h4M16 17h4"} />)),
  magnetStrong: createIcon("MagnetStrongIcon", (<path d={"M8 17v-5a6 6 0 0112 0v5h-4v-5a2 2 0 00-4 0v5zM8 14h4M16 14h4M9 20l-1 3M19 20l1 3M14 21v3"} />)),
  stay: createIcon("StayIcon", (<>
  <path d={"M7 21l4-1 10-10-3-3L8 17zM17 9l3 3"} />
  <circle cx={"21"} cy={"20"} r={"3"} />
</>)),
  lockOpen: createIcon("LockOpenIcon", (<>
  <rect x={"7"} y={"13"} width={"14"} height={"10"} rx={"2"} />
  <path d={"M10 13V9a4 4 0 017.5-2"} />
</>)),
  lock: createIcon("LockIcon", (<>
  <rect x={"7"} y={"13"} width={"14"} height={"10"} rx={"2"} />
  <path d={"M10 13V9a4 4 0 018 0v4"} />
</>)),
  eye: createIcon("EyeIcon", (<>
  <path d={"M4 14s4-7 10-7 10 7 10 7-4 7-10 7S4 14 4 14z"} />
  <circle cx={"14"} cy={"14"} r={"3"} />
</>)),
  eyeOff: createIcon("EyeOffIcon", (<>
  <path d={"M4 14s4-7 10-7 10 7 10 7-4 7-10 7S4 14 4 14z"} />
  <circle cx={"14"} cy={"14"} r={"3"} />
  <path d={"M6 22L22 6"} />
</>)),
  trash: createIcon("TrashIcon", (<path d={"M7 9h14M11 9V6h6v3M9 9l1 14h8l1-14M12 12v8M16 12v8"} />)),
  layers: createIcon("LayersIcon", (<path d={"M14 6l9 5-9 5-9-5zM5 15l9 5 9-5M5 19l9 5 9-5"} />)),
  more: createIcon("MoreIcon", (<>
  <circle cx={"7"} cy={"14"} r={"1.2"} fill={"currentColor"} />
  <circle cx={"14"} cy={"14"} r={"1.2"} fill={"currentColor"} />
  <circle cx={"21"} cy={"14"} r={"1.2"} fill={"currentColor"} />
</>)),
  pencil: createIcon("PencilIcon", (<path d={"M8 20l-1 3 3-1L21 11l-2-2zM18 8l2 2"} />)),
  gear: createIcon("GearIcon", (<>
  <circle cx={"14"} cy={"14"} r={"3"} />
  <path d={"M14 5l2 2.4 3-.8.8 3 3 .8-.8 3 2.4 2-2.4 2 .8 3-3 .8-.8 3-3-.8-2 2.4-2-2.4-3 .8-.8-3-3-.8.8-3L5 14l2.4-2-.8-3 3-.8.8-3 3 .8z"} transform={"scale(.82) translate(3.1 3.1)"} />
</>)),
  grip: createIcon("GripIcon", (<>
  <circle cx={"11"} cy={"9"} r={"1"} fill={"currentColor"} />
  <circle cx={"17"} cy={"9"} r={"1"} fill={"currentColor"} />
  <circle cx={"11"} cy={"14"} r={"1"} fill={"currentColor"} />
  <circle cx={"17"} cy={"14"} r={"1"} fill={"currentColor"} />
  <circle cx={"11"} cy={"19"} r={"1"} fill={"currentColor"} />
  <circle cx={"17"} cy={"19"} r={"1"} fill={"currentColor"} />
</>)),
  ftbGear: createIcon("FtbGearIcon", (<>
  <path d={"M21.56 12.09L23.89 12.52L23.89 15.48L21.56 15.91L20.70 18.00L22.04 19.95L19.95 22.04L18.00 20.70L15.91 21.56L15.48 23.89L12.52 23.89L12.09 21.56L10.00 20.70L8.05 22.04L5.96 19.95L7.30 18.00L6.44 15.91L4.11 15.48L4.11 12.52L6.44 12.09L7.30 10.00L5.96 8.05L8.05 5.96L10.00 7.30L12.09 6.44L12.52 4.11L15.48 4.11L15.91 6.44L18.00 7.30L19.95 5.96L22.04 8.05L20.70 10.00Z"} strokeLinejoin={"round"} />
  <circle cx={"14"} cy={"14"} r={"3.4"} />
</>)),
  ftbBucket: createIcon("FtbBucketIcon", (<>
  <path d={"M9.5 14.5l5.8-5.8a1.4 1.4 0 012 0l3.3 3.3a1.4 1.4 0 010 2l-5.8 5.8a1.4 1.4 0 01-2 0zM15 8.2l-4.4-4.4M10.6 3.8a2 2 0 00-2.8 0L7 4.6M7 4.6l2.7 2.7"} />
  <path d={"M6 17.5c-.9 1.2-1.3 2-1.3 2.6a1.3 1.3 0 002.6 0c0-.6-.4-1.4-1.3-2.6z"} />
</>)),
  ftbText: createIcon("FtbTextIcon", (<path d={"M8 8.5V7h12v1.5M14 7v13M11 20h6"} />)),
  ftbPencil: createIcon("FtbPencilIcon", (<path d={"M7 21l1.2-4.2 9.3-9.3a1.9 1.9 0 012.7 0l.6.6a1.9 1.9 0 010 2.7L11.5 20.8zM16 9.6l2.9 2.9M8.2 16.8l3 3"} />)),
  ftbTrash: createIcon("FtbTrashIcon", (<path d={"M6 8.5h16M11 8.5V6h6v2.5M8 8.5l1.2 14h9.6l1.2-14M12.5 12v7M15.5 12v7"} />)),
  ftbLockOpen: createIcon("FtbLockOpenIcon", (<>
  <rect x={"6.5"} y={"14"} width={"15"} height={"10"} rx={"2.2"} />
  <path d={"M10 14V9.5a4 4 0 017.6-1.6"} />
  <circle cx={"14"} cy={"19"} r={"1"} fill={"currentColor"} stroke={"none"} />
</>)),
  ftbLock: createIcon("FtbLockIcon", (<>
  <rect x={"6.5"} y={"14"} width={"15"} height={"10"} rx={"2.2"} />
  <path d={"M10 14V9.5a4 4 0 018 0V14"} />
  <circle cx={"14"} cy={"19"} r={"1"} fill={"currentColor"} stroke={"none"} />
</>)),
  ftbMore: createIcon("FtbMoreIcon", (<>
  <circle cx={"8"} cy={"14"} r={"2.3"} />
  <circle cx={"14"} cy={"14"} r={"2.3"} />
  <circle cx={"20"} cy={"14"} r={"2.3"} />
</>)),
  ftbGrip: createIcon("FtbGripIcon", (<g fill={"currentColor"} stroke={"none"}>
  <circle cx={"11"} cy={"9"} r={"1.1"} />
  <circle cx={"15.5"} cy={"9"} r={"1.1"} />
  <circle cx={"11"} cy={"14"} r={"1.1"} />
  <circle cx={"15.5"} cy={"14"} r={"1.1"} />
  <circle cx={"11"} cy={"19"} r={"1.1"} />
  <circle cx={"15.5"} cy={"19"} r={"1.1"} />
</g>)),
  star: createIcon("StarIcon", (<path d={"M14 5.5l2.6 5.5 6 .8-4.4 4.2 1.1 6L14 19.1l-5.3 2.9 1.1-6-4.4-4.2 6-.8z"} strokeLinejoin={"round"} />)),
  chevron: createIcon("ChevronIcon", (<path d={"M3 2l3 3-3 3"} />), { viewBox: "0 0 10 10" }),
  undo: createIcon("UndoIcon", (<path d={"M9 11h8a5 5 0 010 10h-4M9 11l4-4M9 11l4 4"} />)),
  redo: createIcon("RedoIcon", (<path d={"M19 11h-8a5 5 0 000 10h4M19 11l-4-4M19 11l-4 4"} />)),
  settings: createIcon("SettingsIcon", (<>
  <circle cx={"14"} cy={"14"} r={"3"} />
  <path d={"M14 5l1.6 2.2 2.7-.5.8 2.6 2.6.8-.5 2.7L23 14l-2.2 1.6.5 2.7-2.6.8-.8 2.6-2.7-.5L14 23l-1.6-2.2-2.7.5-.8-2.6-2.6-.8.5-2.7L5 14l2.2-1.6-.5-2.7 2.6-.8.8-2.6 2.7.5z"} />
</>)),
  fullscreen: createIcon("FullscreenIcon", (<path d={"M7 11V7h4M21 11V7h-4M7 17v4h4M21 17v4h-4"} />)),
  camera: createIcon("CameraIcon", (<>
  <path d={"M6 10h4l1.5-2h5L18 10h4v11H6z"} />
  <circle cx={"14"} cy={"15"} r={"3.5"} />
</>)),
  fullscreenExit: createIcon("FullscreenExitIcon", (<path d={"M11 7v4H7M17 7v4h4M11 21v-4H7M17 21v-4h4"} />)),
  snapSave: createIcon("SnapSaveIcon", (<path d={"M14 6v11M10 13l4 4 4-4M6 18v4h16v-4"} />)),
  snapCopy: createIcon("SnapCopyIcon", (<>
  <rect x={"10"} y={"10"} width={"12"} height={"12"} rx={"1.5"} />
  <path d={"M18 10V7a1 1 0 00-1-1H7a1 1 0 00-1 1v10a1 1 0 001 1h3"} />
</>)),
  snapLink: createIcon("SnapLinkIcon", (<path d={"M12 16a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M16 12a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"} />)),
  snapOpen: createIcon("SnapOpenIcon", (<path d={"M15 6h7v7M22 6L13 15M19 17v4a1 1 0 01-1 1H7a1 1 0 01-1-1V10a1 1 0 011-1h4"} />)),
  snapTweet: createIcon("SnapTweetIcon", (<path d={"M5 20c2 1 4 1.5 6.500 1C17 20.500 20.500 16 20.500 11l1.500-2.500-2 .5C19 7 16 7 15 9.500c-.5 1 0 2 .3 2.500C12 12 9 10.500 7 8c-1 3 0 5 1.500 6C7.500 14 6.500 14 6 13.500 6 16 8 18 10 18.500 8.500 19.500 6.500 19.500 5 20z"} />)),
  alarm: createIcon("AlarmIcon", (<>
  <circle cx={"14"} cy={"15"} r={"7"} />
  <path d={"M14 11.500V15l2.500 1.500M5 8.500l3-2.500M23 8.500l-3-2.500"} />
</>)),
  plus: createIcon("PlusIcon", (<>
  <circle cx={"14"} cy={"14"} r={"8"} />
  <path d={"M14 10v8M10 14h8"} />
</>)),
  candles: createIcon("CandlesIcon", (<>
  <path d={"M10 6v3M10 17v4M18 8v3M18 19v3"} />
  <rect x={"8"} y={"9"} width={"4"} height={"8"} />
  <rect x={"16"} y={"11"} width={"4"} height={"8"} />
</>)),
  ctBars: createIcon("CtBarsIcon", (<path d={"M10 6v16M7 10h3M10 17h3M18 8v14M15 12h3M18 19h3"} />)),
  ctHollow: createIcon("CtHollowIcon", (<>
  <path d={"M10 5v3M10 18v4M18 7v3M18 20v2"} />
  <rect x={"8"} y={"8"} width={"4"} height={"10"} />
  <rect x={"16"} y={"10"} width={"4"} height={"10"} />
  <path d={"M9 10v6M17 12v6"} />
</>)),
  ctColumns: createIcon("CtColumnsIcon", (<>
  <rect x={"5"} y={"14"} width={"4"} height={"8"} />
  <rect x={"12"} y={"9"} width={"4"} height={"13"} />
  <rect x={"19"} y={"16"} width={"4"} height={"6"} />
</>)),
  ctLine: createIcon("CtLineIcon", (<path d={"M5 20l5-5 4 3 5-7 4 2"} />)),
  ctArea: createIcon("CtAreaIcon", (<>
  <path d={"M5 22V19l5-5 4 3 5-7 4 2v10z"} />
  <path d={"M9 22l5-5M13 22l5-8M17 22l6-8"} />
</>)),
  ctBaseline: createIcon("CtBaselineIcon", (<>
  <path d={"M5 14h18"} strokeDasharray={"2 2"} />
  <path d={"M5 17l4-6 4 4 4-7 5 7"} />
</>)),
  ctHiLo: createIcon("CtHiLoIcon", (<>
  <rect x={"7"} y={"7"} width={"4"} height={"12"} />
  <rect x={"16"} y={"10"} width={"4"} height={"12"} />
</>)),
  ctHa: createIcon("CtHaIcon", (<>
  <path d={"M10 5v3M10 18v4M18 7v3M18 20v2"} />
  <rect x={"8"} y={"8"} width={"4"} height={"10"} />
  <rect x={"16"} y={"10"} width={"4"} height={"10"} />
</>)),
  indicators: createIcon("IndicatorsIcon", (<path d={"M6 21c3 0 3-12 6-12M10 14h5M17 15l5 5M22 15l-5 5"} />)),
  close: createIcon("CloseIcon", (<path d={"M8 8l12 12M20 8L8 20"} />)),
  wave: createIcon("WaveIcon", (<path d={"M5 15c3-5 5-5 8-1.5s5 3.5 10-1.5"} />)),
  calendar: createIcon("CalendarIcon", (<>
  <rect x={"6"} y={"8"} width={"16"} height={"14"} rx={"1.5"} />
  <path d={"M6 12h16M10 6v4M18 6v4"} />
</>)),
} as const satisfies Record<string, IconComponent>;

export type IconName = keyof typeof Icons;
