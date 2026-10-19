export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export interface PopupPlacement {
  left: number;
  top: number;
  maxHeight: number;
}

export function placeSidePopup(anchor: HTMLElement, popup: HTMLElement, offsetTop: number): PopupPlacement {
  const rect = anchor.getBoundingClientRect();
  const height = popup.offsetHeight;
  const top = Math.max(8, Math.min(Math.round(rect.top + offsetTop), window.innerHeight - height - 4));
  return { left: Math.round(rect.right + 1), top, maxHeight: window.innerHeight - 16 };
}
