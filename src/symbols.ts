export interface SymbolInfo {
  symbol: string;
  description: string;
  type: string;
  exchange: string;
  /** Starting price and seed of the generated mock series. */
  base: number;
  seed: number;
  /** Opaque host data (e.g. icon info) carried along with the symbol. */
  meta?: unknown;
}

/** The built-in list has no real venue, so none is shown. */
export const NO_EXCHANGE = "";

/** Mock symbol list; a real datafeed plugs in through `searchSymbols`. */
export const SYMBOLS: SymbolInfo[] = [
  { symbol: "BTCUSDT", description: "Bitcoin / TetherUS", base: 65000, seed: 7 },
  { symbol: "ETHUSDT", description: "Ethereum / TetherUS", base: 3500, seed: 11 },
  { symbol: "SOLUSDT", description: "Solana / TetherUS", base: 150, seed: 13 },
  { symbol: "BNBUSDT", description: "BNB / TetherUS", base: 600, seed: 17 },
  { symbol: "LTCUSDT", description: "Litecoin / TetherUS", base: 90, seed: 19 },
  { symbol: "AVAXUSDT", description: "Avalanche / TetherUS", base: 35, seed: 23 },
  { symbol: "LINKUSDT", description: "Chainlink / TetherUS", base: 15, seed: 29 },
  { symbol: "DOTUSDT", description: "Polkadot / TetherUS", base: 7, seed: 31 },
].map((s) => ({ ...s, type: "crypto", exchange: NO_EXCHANGE }));

export function searchSymbols(query: string): SymbolInfo[] {
  const q = query.trim().toLowerCase();
  return q ? SYMBOLS.filter((s) => s.symbol.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) : SYMBOLS;
}
