import { GridLayoutPreset } from "@ui/gridlayout";
import type { ReactNode } from "react";

import Layout10_5x2Icon from "./Icons/Layout10_5x2Icon";
import Layout10ColumnsIcon from "./Icons/Layout10ColumnsIcon";
import Layout10RowsIcon from "./Icons/Layout10RowsIcon";
import Layout12_4x3Icon from "./Icons/Layout12_4x3Icon";
import Layout12_6x2Icon from "./Icons/Layout12_6x2Icon";
import Layout12RowsIcon from "./Icons/Layout12RowsIcon";
import Layout14_7x2Icon from "./Icons/Layout14_7x2Icon";
import Layout16_4x4GridIcon from "./Icons/Layout16_4x4GridIcon";
import Layout16_4x4Icon from "./Icons/Layout16_4x4Icon";
import Layout1SingleIcon from "./Icons/Layout1SingleIcon";
import Layout2HorizontalIcon from "./Icons/Layout2HorizontalIcon";
import Layout2VerticalIcon from "./Icons/Layout2VerticalIcon";
import Layout3ColumnsIcon from "./Icons/Layout3ColumnsIcon";
import Layout3RowsIcon from "./Icons/Layout3RowsIcon";
import Layout3SplitBottomIcon from "./Icons/Layout3SplitBottomIcon";
import Layout3SplitLeftIcon from "./Icons/Layout3SplitLeftIcon";
import Layout3SplitRightIcon from "./Icons/Layout3SplitRightIcon";
import Layout3SplitTopIcon from "./Icons/Layout3SplitTopIcon";
import Layout4_2x2Icon from "./Icons/Layout4_2x2Icon";
import Layout4_2x2LeftLargeIcon from "./Icons/Layout4_2x2LeftLargeIcon";
import Layout4_2x2RightLargeIcon from "./Icons/Layout4_2x2RightLargeIcon";
import Layout4ColumnsIcon from "./Icons/Layout4ColumnsIcon";
import Layout4GridIcon from "./Icons/Layout4GridIcon";
import Layout4RowsIcon from "./Icons/Layout4RowsIcon";
import Layout4SplitBottomLargeIcon from "./Icons/Layout4SplitBottomLargeIcon";
import Layout4SplitLeftLargeIcon from "./Icons/Layout4SplitLeftLargeIcon";
import Layout4SplitRightLargeIcon from "./Icons/Layout4SplitRightLargeIcon";
import Layout4SplitTopLargeIcon from "./Icons/Layout4SplitTopLargeIcon";
import Layout5_1x4Icon from "./Icons/Layout5_1x4Icon";
import Layout5_2cols_3rows_RightIcon from "./Icons/Layout5_2cols_3rows_RightIcon";
import Layout5_2x3Icon from "./Icons/Layout5_2x3Icon";
import Layout5_2x3LeftIcon from "./Icons/Layout5_2x3LeftIcon";
import Layout5_3rows_2cols_LeftIcon from "./Icons/Layout5_3rows_2cols_LeftIcon";
import Layout5_3x2Icon from "./Icons/Layout5_3x2Icon";
import Layout5_3x2RightIcon from "./Icons/Layout5_3x2RightIcon";
import Layout5_4x1Icon from "./Icons/Layout5_4x1Icon";
import Layout5ColumnsIcon from "./Icons/Layout5ColumnsIcon";
import Layout5RowsIcon from "./Icons/Layout5RowsIcon";
import Layout5SplitLeftIcon from "./Icons/Layout5SplitLeftIcon";
import Layout5SplitRightIcon from "./Icons/Layout5SplitRightIcon";
import Layout6_2x3Icon from "./Icons/Layout6_2x3Icon";
import Layout6_2x4Icon from "./Icons/Layout6_2x4Icon";
import Layout6_3x2Icon from "./Icons/Layout6_3x2Icon";
import Layout6_4x2Icon from "./Icons/Layout6_4x2Icon";
import Layout6ColumnsIcon from "./Icons/Layout6ColumnsIcon";
import Layout6RowsIcon from "./Icons/Layout6RowsIcon";
import Layout7_3x4Icon from "./Icons/Layout7_3x4Icon";
import Layout7_4x3Icon from "./Icons/Layout7_4x3Icon";
import Layout7_4x3SplitIcon from "./Icons/Layout7_4x3SplitIcon";
import Layout7ColumnsIcon from "./Icons/Layout7ColumnsIcon";
import Layout7SplitLeftIcon from "./Icons/Layout7SplitLeftIcon";
import Layout8_2x4Icon from "./Icons/Layout8_2x4Icon";
import Layout8_4x2Icon from "./Icons/Layout8_4x2Icon";
import Layout8ColumnsIcon from "./Icons/Layout8ColumnsIcon";
import Layout8RowsIcon from "./Icons/Layout8RowsIcon";
import Layout9_3x3Icon from "./Icons/Layout9_3x3Icon";
import Layout9_5x4Icon from "./Icons/Layout9_5x4Icon";
import Layout9ColumnsIcon from "./Icons/Layout9ColumnsIcon";
import Layout9RowsIcon from "./Icons/Layout9RowsIcon";

export interface LayoutShape {
  preset: GridLayoutPreset;
  icon: ReactNode;
}

export interface LayoutRow {
  panes: number;
  lines: number;
  shapes: LayoutShape[];
}

export const layouts: LayoutRow[] = [
  // Row 1 — 1 pane
  {
    panes: 1,
    lines: 0,
    shapes: [{ preset: "1-single", icon: <Layout1SingleIcon /> }],
  },
  // Row 2 — 2 panes
  {
    panes: 2,
    lines: 1,
    shapes: [
      { preset: "2-horizontal", icon: <Layout2HorizontalIcon /> },
      { preset: "2-vertical", icon: <Layout2VerticalIcon /> },
    ],
  },
  // Row 3 — 3 panes
  {
    panes: 3,
    lines: 2,
    shapes: [
      { preset: "3-rows", icon: <Layout3RowsIcon /> },
      { preset: "3-columns", icon: <Layout3ColumnsIcon /> },
      { preset: "3-split-left", icon: <Layout3SplitLeftIcon /> },
      { preset: "3-split-right", icon: <Layout3SplitRightIcon /> },
      { preset: "3-split-top", icon: <Layout3SplitTopIcon /> },
      { preset: "3-split-bottom", icon: <Layout3SplitBottomIcon /> },
    ],
  },
  // Row 4 — 4 panes
  {
    panes: 4,
    lines: 3,
    shapes: [
      { preset: "4-grid", icon: <Layout4GridIcon /> },
      { preset: "4-columns", icon: <Layout4ColumnsIcon /> },
      { preset: "4-rows", icon: <Layout4RowsIcon /> },
      { preset: "4-split-right-large", icon: <Layout4SplitRightLargeIcon /> },
      { preset: "4-split-left-large", icon: <Layout4SplitLeftLargeIcon /> },
      { preset: "4-split-top-large", icon: <Layout4SplitTopLargeIcon /> },
      { preset: "4-split-bottom-large", icon: <Layout4SplitBottomLargeIcon /> },
      { preset: "4-2x2-left-large", icon: <Layout4_2x2LeftLargeIcon /> },
      { preset: "4-2x2-right-large", icon: <Layout4_2x2RightLargeIcon /> },
      { preset: "4-2x2", icon: <Layout4_2x2Icon /> },
    ],
  },
  // Row 5 — 5 panes
  {
    panes: 5,
    lines: 4,
    shapes: [
      { preset: "5-1x4", icon: <Layout5_1x4Icon /> },
      { preset: "5-rows", icon: <Layout5RowsIcon /> },
      { preset: "5-columns", icon: <Layout5ColumnsIcon /> },
      { preset: "5-split-right", icon: <Layout5SplitRightIcon /> },
      { preset: "5-split-left", icon: <Layout5SplitLeftIcon /> },
      { preset: "5-2x3", icon: <Layout5_2x3Icon /> },
      { preset: "5-3x2", icon: <Layout5_3x2Icon /> },
      { preset: "5-4x1", icon: <Layout5_4x1Icon /> },
      { preset: "5-2x3-left", icon: <Layout5_2x3LeftIcon /> },
      { preset: "5-3x2-right", icon: <Layout5_3x2RightIcon /> },
      { preset: "5-2cols-3rows-right", icon: <Layout5_2cols_3rows_RightIcon /> },
      { preset: "5-3rows-2cols-left", icon: <Layout5_3rows_2cols_LeftIcon /> },
    ],
  },
  // Row 6 — 6 panes
  {
    panes: 6,
    lines: 5,
    shapes: [
      { preset: "6-3x2", icon: <Layout6_3x2Icon /> },
      { preset: "6-rows", icon: <Layout6RowsIcon /> },
      { preset: "6-columns", icon: <Layout6ColumnsIcon /> },
      { preset: "6-2x3", icon: <Layout6_2x3Icon /> },
      { preset: "6-2x4", icon: <Layout6_2x4Icon /> },
      { preset: "6-4x2", icon: <Layout6_4x2Icon /> },
    ],
  },
  // Row 7 — 7 panes
  {
    panes: 7,
    lines: 6,
    shapes: [
      { preset: "7-4x3-split", icon: <Layout7_4x3SplitIcon /> },
      { preset: "7-3x4", icon: <Layout7_3x4Icon /> },
      { preset: "7-4x3", icon: <Layout7_4x3Icon /> },
      { preset: "7-columns", icon: <Layout7ColumnsIcon /> },
      { preset: "7-split-left", icon: <Layout7SplitLeftIcon /> },
    ],
  },
  // Row 8 — 8 panes
  {
    panes: 8,
    lines: 7,
    shapes: [
      { preset: "8-4x2", icon: <Layout8_4x2Icon /> },
      { preset: "8-2x4", icon: <Layout8_2x4Icon /> },
      { preset: "8-rows", icon: <Layout8RowsIcon /> },
      { preset: "8-columns", icon: <Layout8ColumnsIcon /> },
    ],
  },
  // Row 9 — 9 panes
  {
    panes: 9,
    lines: 8,
    shapes: [
      { preset: "9-3x3", icon: <Layout9_3x3Icon /> },
      { preset: "9-5x4", icon: <Layout9_5x4Icon /> },
      { preset: "9-rows", icon: <Layout9ColumnsIcon /> },
      { preset: "9-columns", icon: <Layout9RowsIcon /> },
    ],
  },
  // Row 10 — 10 panes
  {
    panes: 10,
    lines: 9,
    shapes: [
      { preset: "10-5x2", icon: <Layout10_5x2Icon /> },
      { preset: "10-rows", icon: <Layout10ColumnsIcon /> },
      { preset: "10-columns", icon: <Layout10RowsIcon /> },
    ],
  },
  // Row 12 — 12 panes
  {
    panes: 12,
    lines: 11,
    shapes: [
      { preset: "12-6x2", icon: <Layout12_6x2Icon /> },
      { preset: "12-4x3", icon: <Layout12_4x3Icon /> },
      { preset: "12-rows", icon: <Layout12RowsIcon /> },
    ],
  },
  // Row 14 — 14 panes
  {
    panes: 14,
    lines: 13,
    shapes: [{ preset: "14-7x2", icon: <Layout14_7x2Icon /> }],
  },
  // Row 16 — 16 panes
  {
    panes: 16,
    lines: 15,
    shapes: [
      { preset: "16-4x4", icon: <Layout16_4x4Icon /> },
      { preset: "16-4x4-grid", icon: <Layout16_4x4GridIcon /> },
    ],
  },
];
