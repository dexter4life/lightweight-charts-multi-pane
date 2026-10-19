/**
 * Lets a dialog be dragged by its header. Uses the CSS `translate` property so it works with any
 * positioning (centred, fixed, absolute) and survives the dialog re-rendering its children.
 */
export function makeDraggable(dlg: HTMLElement, handle = "[data-drag-handle]"): () => void {
  let start: { x: number; y: number; ox: number; oy: number } | null = null;
  let off = { x: 0, y: 0 };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const head = target.closest<HTMLElement>(handle);
    if (!head || !dlg.contains(head) || target.closest("button,input,select,textarea,a")) return;
    start = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
    dlg.setPointerCapture(e.pointerId);
    dlg.setAttribute("data-dragging", "");
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!start) return;
    const rect = dlg.getBoundingClientRect();
    let dx = start.ox + e.clientX - start.x;
    let dy = start.oy + e.clientY - start.y;
    const baseX = rect.left - off.x;
    const baseY = rect.top - off.y;
    dx = Math.min(Math.max(dx, 60 - rect.width - baseX), window.innerWidth - 60 - baseX);
    dy = Math.min(Math.max(dy, -baseY), window.innerHeight - 40 - baseY);
    off = { x: dx, y: dy };
    dlg.style.translate = `${dx}px ${dy}px`;
  };

  const endDrag = (e: PointerEvent) => {
    if (!start) return;
    start = null;
    dlg.releasePointerCapture?.(e.pointerId);
    dlg.removeAttribute("data-dragging");
  };

  dlg.addEventListener("pointerdown", onPointerDown);
  dlg.addEventListener("pointermove", onPointerMove);
  dlg.addEventListener("pointerup", endDrag);
  dlg.addEventListener("pointercancel", endDrag);

  return () => {
    dlg.removeEventListener("pointerdown", onPointerDown);
    dlg.removeEventListener("pointermove", onPointerMove);
    dlg.removeEventListener("pointerup", endDrag);
    dlg.removeEventListener("pointercancel", endDrag);
  };
}
