/**
 * Colour scheme handling for what CSS cannot reach: the chart canvas and the chart-settings defaults.
 * The DOM chrome follows the page's `color-scheme` through `light-dark()` tokens in app/lab-vars.css;
 * the dark palette below mirrors those tokens.
 */

export type ColorScheme = "light" | "dark";

/** Appearance settings that follow the colour scheme for as long as the user has not picked their own. */
export interface Palette {
  bg: string;
  bgTop: string;
  bgBottom: string;
  vertGrid: string;
  horzGrid: string;
  textColor: string;
  scaleLines: string;
}

export const PALETTES: Record<ColorScheme, Palette> = {
  light: {
    bg: "#ffffff",
    bgTop: "#ffffff",
    bgBottom: "#e3eeff",
    vertGrid: "#f2f3f3",
    horzGrid: "#f2f3f3",
    textColor: "#1f1f1f",
    scaleLines: "#e1e3ea",
  },
  dark: {
    bg: "#1f1f1f",
    bgTop: "#1f1f1f",
    bgBottom: "#1d2d52",
    vertGrid: "#292929",
    horzGrid: "#292929",
    textColor: "#d1d1d1",
    scaleLines: "#3a3a3a",
  },
};

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The scheme the page renders with, i.e. what `light-dark()` resolves to for the document. */
export function currentScheme(): ColorScheme {
  if (typeof document === "undefined") return "light";
  const declared = getComputedStyle(document.documentElement).colorScheme.split(/\s+/);
  if (!declared.includes("dark")) return "light";
  // `light dark` leaves the choice to the user's OS setting.
  return declared.includes("light") && !matchMedia(DARK_QUERY).matches ? "light" : "dark";
}

type Listener = (scheme: ColorScheme) => void;

const listeners = new Set<Listener>();
let last: ColorScheme = "light";
let observer: MutationObserver | null = null;
let media: MediaQueryList | null = null;

function check() {
  const next = currentScheme();
  if (next === last) return;
  last = next;
  listeners.forEach((fn) => fn(next));
}

/** Calls `fn` whenever the page switches between light and dark. Returns the unsubscribe function. */
export function onSchemeChange(fn: Listener): () => void {
  if (!listeners.size) {
    last = currentScheme();
    // The host flips `color-scheme` through an attribute or class on <html>.
    observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true });
    media = matchMedia(DARK_QUERY);
    media.addEventListener("change", check);
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size) return;
    observer?.disconnect();
    media?.removeEventListener("change", check);
    observer = null;
    media = null;
  };
}
