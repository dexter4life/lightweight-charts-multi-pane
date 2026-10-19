export type PaletteValue = {
  color: string;
  opacity: number;
  width?: number;
  /** Offers a line style row (solid, dashed, dotted) when set. */
  dash?: "solid" | "dashed" | "dotted";
};

export function parseColor(input: string): { hex: string; alpha: number } {
  const hex = input.match(/^#([0-9a-f]{6})$/i);
  if (hex) return { hex: `#${hex[1].toLowerCase()}`, alpha: 1 };
  const match = input.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?/i);
  if (!match) return { hex: "#2962ff", alpha: 1 };
  const hexValue = [match[1], match[2], match[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  return { hex: `#${hexValue}`, alpha: match[4] === undefined ? 1 : Number(match[4]) };
}

export function composeColor(hex: string, alpha: number): string {
  if (alpha >= 1) return hex;
  const numeric = parseInt(hex.slice(1), 16);
  return `rgba(${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}, ${Math.round(alpha * 100) / 100})`;
}
