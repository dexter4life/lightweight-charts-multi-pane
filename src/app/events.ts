/** Dispatched on `window` by the host page to open a symbol in a new tab. */
export const CHART_LAB_OPEN_SYMBOL = "chartlab:open-symbol";

export interface OpenSymbolDetail {
  symbol: string;
  description?: string;
  type?: string;
  exchange?: string;
  /** Last price, used as the starting level of the generated mock series. */
  price?: number;
  /** Opaque host data handed back to `renderSymbolIcon`. */
  meta?: unknown;
}

export const openSymbolInNewTab = (detail: OpenSymbolDetail) =>
  window.dispatchEvent(new CustomEvent<OpenSymbolDetail>(CHART_LAB_OPEN_SYMBOL, { detail }));

/** Dispatched on `window` by the host page to add an indicator to the active chart. */
export const CHART_LAB_ADD_INDICATOR = "chartlab:add-indicator";

export interface AddIndicatorDetail {
  /** Indicator kind, e.g. `ext:ema`. */
  kind: string;
}

export const addIndicatorToChart = (detail: AddIndicatorDetail) =>
  window.dispatchEvent(new CustomEvent<AddIndicatorDetail>(CHART_LAB_ADD_INDICATOR, { detail }));
