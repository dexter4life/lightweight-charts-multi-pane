export interface FloatingToolbarMenuRequest {
  x: number;
  y: number;
}

type Listener = (request: FloatingToolbarMenuRequest) => void;

const listeners = new Set<Listener>();

export function openFloatingToolbarMenu(request: FloatingToolbarMenuRequest) {
  listeners.forEach((listener) => listener(request));
}

export function subscribeFloatingToolbarMenu(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
