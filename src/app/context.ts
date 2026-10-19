import { createContext } from "react";
import type { SymbolInfo } from "../symbols";
import type { ChartEngine } from "./engine";
import type { ChartSettingsTab } from "../components/dialogs/ChartSettingsDialog";

/** Ways for any component to ask the app shell to show a dialog or panel. */
export interface UiActions {
  openSymbolSearch(initial?: string): void;
  openGoTo(): void;
  openIndicators(): void;
  openIndicatorSettings(id: string): void;
  openVolumeSettings(): void;
  openChartSettings(tab?: ChartSettingsTab): void;
  openObjectSettings(id: string): void;
  toggleObjectTree(): void;
  /** The element wrapping the whole chart grid, for overlays shared by every chart of the tab. */
  chartArea(): HTMLElement | null;
  /** Host-provided symbol icon shown in the chart legend. */
  renderSymbolIcon?(symbol: SymbolInfo): React.ReactNode;
  /** Host-provided symbol lookup; without it the dialog searches the built-in list. */
  searchSymbols?(query: string): Promise<SymbolInfo[]>;
}

export interface LabContextValue {
  engine: ChartEngine;
  ui: UiActions;
}

/** Consume from class components with `static contextType = LabContext; declare context: React.ContextType<typeof LabContext>;`. Always non-null below <ChartLab/>. */
export const LabContext = createContext<LabContextValue>(null as never);
