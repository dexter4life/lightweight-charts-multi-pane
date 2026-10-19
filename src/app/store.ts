import { readStorage, writeStorage } from "../components/chrome/utils";
import type { SymbolInfo } from "../symbols";

export interface StoredTab {
  id: string;
  preset: string;
  symbol?: SymbolInfo;
  /** Resolution id of the tab's first chart. */
  resolution?: string;
}

export interface StoredTabs {
  active: string;
  tabs: StoredTab[];
}

/** Where the shell keeps its tabs. The host can back it with its own store (e.g. Redux). */
export interface ChartLabStore {
  load(): StoredTabs | null;
  save(state: StoredTabs): void;
}

const KEY = "chartlab.tabs";

export const localStore: ChartLabStore = {
  load: () => readStorage<StoredTabs | null>(KEY, null),
  save: (state) => writeStorage(KEY, state),
};
