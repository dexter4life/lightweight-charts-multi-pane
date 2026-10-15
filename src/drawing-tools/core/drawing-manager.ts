import type { IChartApi } from '../../api/create-chart';
import type { MouseEventParams } from '../../api/ichart-api';
import type { ISeriesApi } from '../../api/iseries-api';
import type { SeriesType } from '../../model/series-options';

import { createFractionalMapper } from './fractional-logical';

import type {
  Anchor,
  DrawingEvent,
  DrawingEventCallback,
  DrawingEventType,
  IDrawing,
  MagnetMode,
  Point,
  SerializedDrawing,
  Viewport,
} from './types';

/**
 * DrawingManager - Central orchestration system for managing drawings.
 *
 * Responsibilities:
 * - Creating, storing, removing drawings
 * - Attaching/detaching to chart series
 * - Hit detection and selection
 * - Interaction state management
 * - JSON import/export
 * - Event emission
 */
export class DrawingManager {
  private _drawings: Map<string, IDrawing> = new Map();
  private _selectedId: string | null = null;
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<SeriesType> | null = null;
  private _container: HTMLElement | null = null;
  private _listeners: Map<DrawingEventType, Set<DrawingEventCallback>> = new Map();
  private _isAttached: boolean = false;

  // Interaction state
  private _activeTool: string | null = null;
  private _isDragging: boolean = false;
  private _dragAnchorIndex: number | null = null;
  private _bodyDrag: {
    startX: number;
    startY: number;
    origin: { x: number; y: number }[];
    moved: boolean;
  } | null = null;
  private _magnet: MagnetMode = 'off';
  private _allLocked: boolean = false;
  private _allVisible: boolean = true;

  constructor() {
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleClick = this.handleClick.bind(this);
  }

  // ============ Lifecycle ============

  /**
   * Attach manager to a chart and series
   */
  attach(
    chart: IChartApi,
    series: ISeriesApi<SeriesType>,
    container: HTMLElement
  ): void {
    if (this._isAttached) {
      this.detach();
    }

    this._chart = chart;
    this._series = series;
    this._container = container;
    this._isAttached = true;

    // Attach all existing drawings
    for (const drawing of this._drawings.values()) {
      if (drawing.options.visible === false) continue;
      drawing.attach(series, chart, this._container ?? undefined);
    }

    // Subscribe to chart events
    chart.subscribeClick(this.handleClick);

    // Add container event listeners for interaction.
    // Capture phase lets us intercept events before they reach the chart's
    // internal canvas handler, so we can stop propagation during a drawing
    // drag and prevent the chart from panning simultaneously.
    container.addEventListener('mousedown', this.handleMouseDown, { capture: true });
    container.addEventListener('mousemove', this.handleMouseMove, { capture: true });
    container.addEventListener('mouseup', this.handleMouseUp, { capture: true });
  }

  /**
   * Detach manager from chart
   */
  detach(): void {
    if (!this._isAttached) return;

    // Detach all drawings
    for (const drawing of this._drawings.values()) {
      drawing.detach();
    }

    // Unsubscribe from chart events
    if (this._chart) {
      this._chart.unsubscribeClick(this.handleClick);
    }

    // Remove container event listeners (capture flag must match the add call)
    if (this._container) {
      this._container.removeEventListener('mousedown', this.handleMouseDown, { capture: true });
      this._container.removeEventListener('mousemove', this.handleMouseMove, { capture: true });
      this._container.removeEventListener('mouseup', this.handleMouseUp, { capture: true });
    }

    this._chart = null;
    this._series = null;
    this._container = null;
    this._isAttached = false;
  }

  /**
   * Check if manager is attached
   */
  isAttached(): boolean {
    return this._isAttached;
  }

  // ============ Drawing Management ============

  /**
   * Add a drawing to the manager
   */
  addDrawing(drawing: IDrawing): void {
    if (this._drawings.has(drawing.id)) {
      console.warn(`Drawing with id ${drawing.id} already exists`);
      return;
    }

    this._drawings.set(drawing.id, drawing);

    // Attach to chart if manager is attached
    if (this._isAttached && this._series && this._chart && drawing.options.visible !== false) {
      drawing.attach(this._series, this._chart, this._container ?? undefined);
    }

    this.emit('drawing:added', { drawingId: drawing.id, drawing });
  }

  /**
   * Remove a drawing by id
   */
  removeDrawing(id: string): void {
    const drawing = this._drawings.get(id);
    if (!drawing) return;

    // Deselect if selected
    if (this._selectedId === id) {
      this.deselectAll();
    }

    // Detach from chart
    drawing.detach();

    this._drawings.delete(id);
    this.emit('drawing:removed', { drawingId: id });
  }

  /**
   * Get a drawing by id
   */
  getDrawing(id: string): IDrawing | undefined {
    return this._drawings.get(id);
  }

  /**
   * Get all drawings
   */
  getAllDrawings(): IDrawing[] {
    return Array.from(this._drawings.values());
  }

  /**
   * Clear all drawings
   */
  clearAll(): void {
    for (const drawing of this._drawings.values()) {
      drawing.detach();
    }
    this._drawings.clear();
    this._selectedId = null;
    this.emit('drawing:cleared', {});
  }

  // ============ Selection ============

  /**
   * Select a drawing by id
   */
  selectDrawing(id: string): void {
    const drawing = this._drawings.get(id);
    if (!drawing) return;

    // Deselect current
    if (this._selectedId && this._selectedId !== id) {
      const current = this._drawings.get(this._selectedId);
      if (current) {
        current.setState('normal');
      }
    }

    drawing.setState('selected');
    this._selectedId = id;
    this.emit('drawing:selected', { drawingId: id, drawing });
  }

  /**
   * Deselect all drawings
   */
  deselectAll(): void {
    if (this._selectedId) {
      const drawing = this._drawings.get(this._selectedId);
      if (drawing) {
        drawing.setState('normal');
      }
      const id = this._selectedId;
      this._selectedId = null;
      this.emit('drawing:deselected', { drawingId: id });
    }
  }

  /**
   * Get selected drawing
   */
  getSelectedDrawing(): IDrawing | null {
    if (!this._selectedId) return null;
    return this._drawings.get(this._selectedId) || null;
  }

  // ============ Tool Management ============

  /**
   * Set the active drawing tool
   */
  setActiveTool(toolType: string | null): void {
    this._activeTool = toolType;
    this.emit('tool:changed', { toolType: toolType || undefined });
  }

  /**
   * Get the active drawing tool
   */
  getActiveTool(): string | null {
    return this._activeTool;
  }

  // ============ Hit Testing ============

  /**
   * Find drawing at point
   */
  hitTest(point: Point): IDrawing | null {
    const viewport = this.getViewport();
    if (!viewport) return null;

    // Test in reverse order (top to bottom)
    const drawings = Array.from(this._drawings.values()).reverse();

    for (const drawing of drawings) {
      if (!drawing.options.visible) continue;
      if (drawing.testHit(point, viewport)) {
        return drawing;
      }
    }

    return null;
  }

  /**
   * Find anchor at point for selected drawing
   */
  hitTestAnchor(point: Point): number | null {
    if (!this._selectedId) return null;

    const drawing = this._drawings.get(this._selectedId);
    if (!drawing) return null;

    const viewport = this.getViewport();
    if (!viewport) return null;

    return drawing.hitTestAnchor(point, viewport);
  }

  // ============ Event Handling ============

  private handleClick(params: MouseEventParams): void {
    if (!params.point) return;

    const point: Point = { x: params.point.x, y: params.point.y };

    // If no active tool, try to select a drawing
    if (!this._activeTool) {
      const hitDrawing = this.hitTest(point);
      if (hitDrawing) {
        this.selectDrawing(hitDrawing.id);
      } else {
        this.deselectAll();
      }
    }
  }

  private handleMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const point = this.getPointFromEvent(event);
    if (!point) return;

    // Check for anchor hit on selected drawing
    if (this._selectedId) {
      const anchorIndex = this.hitTestAnchor(point);
      if (anchorIndex !== null) {
        const drawing = this._drawings.get(this._selectedId);
        if (drawing && !drawing.options.locked) {
          this._isDragging = true;
          this._dragAnchorIndex = anchorIndex;
          drawing.setState('editing');
          drawing.grabControlPoint?.(anchorIndex, point);
          // Stop the event before it reaches the chart's canvas handler so
          // the chart does not enter its pan/scroll state.
          event.stopPropagation();
          event.preventDefault();
          return;
        }
      }
    }

    // Body drag: grab a drawing anywhere on its body and move it as a whole.
    if (this._activeTool || !this.isInsidePlot(point)) return;
    const hit = this.hitTest(point);
    if (!hit) return;

    this.selectDrawing(hit.id);
    event.stopPropagation();
    event.preventDefault();
    if (hit.options.locked) return;

    const viewport = this.getViewport();
    if (!viewport) return;
    const origin = hit.bodyDragOrigin(viewport);
    if (!origin) return;
    this._bodyDrag = { startX: point.x, startY: point.y, origin, moved: false };
    hit.setState('editing');
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this._bodyDrag && this._selectedId) {
      const drawing = this._drawings.get(this._selectedId);
      const point = this.getPointFromEvent(event);
      const viewport = this.getViewport();
      if (drawing && point && viewport) {
        const dx = point.x - this._bodyDrag.startX;
        const dy = point.y - this._bodyDrag.startY;
        if (this._bodyDrag.moved || Math.abs(dx) + Math.abs(dy) > 2) {
          const next = drawing.bodyDragAnchors(this._bodyDrag.origin, dx, dy, viewport);
          if (next) {
            this._bodyDrag.moved = true;
            drawing.setAnchors(next);
            this.emit('drawing:updated', { drawingId: drawing.id, drawing });
          }
        }
      }
      event.stopPropagation();
      return;
    }

    if (!this._isDragging || this._dragAnchorIndex === null) return;
    if (!this._selectedId) return;

    const drawing = this._drawings.get(this._selectedId);
    if (!drawing) return;

    const point = this.getPointFromEvent(event);
    if (!point) return;

    const viewport = this.getViewport();
    if (viewport) {
      drawing.dragControlPoint(this._dragAnchorIndex, point, this.resolveAnchor(point), viewport);
      this.emit('drawing:updated', { drawingId: drawing.id, drawing });
    }

    // Safety net: ensure the chart never processes the move while dragging.
    event.stopPropagation();
  }

  private handleMouseUp(event: MouseEvent): void {
    const wasEditing = this._isDragging || this._bodyDrag !== null;
    const moved = this._isDragging || (this._bodyDrag?.moved ?? false);
    if (wasEditing && this._selectedId) {
      const drawing = this._drawings.get(this._selectedId);
      if (drawing) {
        drawing.setState('selected');
        if (moved) this.emit('drawing:committed', { drawingId: drawing.id, drawing });
      }
      // Prevent the chart from synthesizing a click on mouseup, which could
      // deselect the drawing or trigger placement.
      event.stopPropagation();
    }

    this._isDragging = false;
    this._dragAnchorIndex = null;
    this._bodyDrag = null;
  }

  private isInsidePlot(point: Point): boolean {
    const viewport = this.getViewport();
    if (!viewport) return false;
    return point.x >= 0 && point.x <= viewport.width && point.y >= 0 && point.y <= viewport.height;
  }

  private getPointFromEvent(event: MouseEvent): Point | null {
    if (!this._container) return null;

    const rect = this._container.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  // ============ Viewport ============

  private getViewport(): Viewport | null {
    if (!this._chart || !this._series) return null;

    const timeScale = this._chart.timeScale();
    // Get container height as fallback
    const height = this._container?.clientHeight ?? 400;

    return {
      width: timeScale.width(),
      height,
      timeScale: {
        coordinateToTime: (x: number) => timeScale.coordinateToTime(x),
        timeToCoordinate: (time) => timeScale.timeToCoordinate(time),
        logicalToCoordinate: (logical) => timeScale.logicalToCoordinate(logical),
      },
      priceScale: {
        coordinateToPrice: (y: number) => this._series!.coordinateToPrice(y),
        priceToCoordinate: (price: number) => this._series!.priceToCoordinate(price),
      },
    };
  }

  // ============ Snapping ============

  setMagnetMode(mode: MagnetMode): void {
    this._magnet = mode;
  }

  getMagnetMode(): MagnetMode {
    return this._magnet;
  }

  /**
   * Convert a plot-area pixel point to an anchor, snapping to the nearest
   * bar's OHLC value when the magnet is enabled.
   */
  /** Fractional bar index under a pixel x (not snapped to whole bars). */
  fractionalLogical(x: number): number | null {
    if (!this._chart) return null;
    return createFractionalMapper(this._chart.timeScale())?.toLogical(x) ?? null;
  }

  resolveAnchor(point: Point): Anchor | null {
    const viewport = this.getViewport();
    if (!viewport || !this._series) return null;
    const time = viewport.timeScale.coordinateToTime(point.x);
    const price = viewport.priceScale.coordinateToPrice(point.y);
    if (time === null || price === null) return null;
    if (this._magnet === 'off') return { time, price };

    const bar = this._series.data().find((d) => d.time === time) as
      | Record<string, unknown>
      | undefined;
    if (!bar) return { time, price };

    const candidates: number[] = [];
    for (const key of ['open', 'high', 'low', 'close', 'value']) {
      const v = bar[key];
      if (typeof v === 'number') candidates.push(v);
    }
    let best = price;
    let bestDist = Infinity;
    for (const c of candidates) {
      const cy = viewport.priceScale.priceToCoordinate(c);
      if (cy === null) continue;
      const dist = Math.abs(cy - point.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    if (this._magnet === 'weak' && bestDist > 12) return { time, price };
    return { time, price: best };
  }

  // ============ Bulk state / ordering ============

  /** Lock or unlock every drawing (persisted on each drawing's options). */
  setAllLocked(locked: boolean): void {
    this._allLocked = locked;
    for (const drawing of this._drawings.values()) {
      drawing.updateOptions({ locked });
    }
    this.emit('drawing:committed', {});
  }

  isAllLocked(): boolean {
    return this._allLocked;
  }

  /** Show or hide a single drawing by detaching/attaching its primitive. */
  setDrawingVisible(id: string, visible: boolean): void {
    const drawing = this._drawings.get(id);
    if (!drawing) return;
    drawing.updateOptions({ visible });
    if (!this._isAttached || !this._series || !this._chart) return;
    if (visible && !drawing.isAttached()) {
      drawing.attach(this._series, this._chart, this._container ?? undefined);
    } else if (!visible && drawing.isAttached()) {
      if (this._selectedId === id) this.deselectAll();
      drawing.detach();
    }
  }

  setAllVisible(visible: boolean): void {
    this._allVisible = visible;
    for (const id of this._drawings.keys()) {
      this.setDrawingVisible(id, visible);
    }
    this.emit('drawing:committed', {});
  }

  isAllVisible(): boolean {
    return this._allVisible;
  }

  /** Move a drawing to the top (or bottom) of the paint order. */
  reorder(id: string, position: 'front' | 'back'): void {
    const drawing = this._drawings.get(id);
    if (!drawing || !this._isAttached) return;
    const rest = Array.from(this._drawings.values()).filter((d) => d.id !== id);
    const ordered = position === 'front' ? [...rest, drawing] : [drawing, ...rest];
    this._drawings = new Map(ordered.map((d) => [d.id, d]));
    if (this._series && this._chart) {
      for (const d of ordered) {
        if (!d.isAttached()) continue;
        d.detach();
        d.attach(this._series, this._chart, this._container ?? undefined);
      }
    }
    this.emit('drawing:committed', { drawingId: id, drawing });
  }

  /** Remove the currently selected drawing (no-op if locked). */
  removeSelected(): boolean {
    const drawing = this.getSelectedDrawing();
    if (!drawing || drawing.options.locked) return false;
    this.removeDrawing(drawing.id);
    return true;
  }

  /** Signal that a drawing was modified programmatically (style, options). */
  commit(id?: string): void {
    const drawing = id ? this._drawings.get(id) : undefined;
    this.emit('drawing:updated', { drawingId: id, drawing });
    this.emit('drawing:committed', { drawingId: id, drawing });
  }

  // ============ Serialization ============

  /**
   * Export all drawings as JSON
   */
  exportDrawings(): SerializedDrawing[] {
    return this.getAllDrawings().map((d) => d.toJSON());
  }

  /**
   * Import drawings from JSON (requires a factory function)
   */
  importDrawings(
    data: SerializedDrawing[],
    factory: (type: string, data: SerializedDrawing) => IDrawing | null
  ): void {
    for (const item of data) {
      const drawing = factory(item.type, item);
      if (drawing) {
        this.addDrawing(drawing);
      }
    }
  }

  // ============ Events ============

  /**
   * Subscribe to an event
   */
  on(event: DrawingEventType, callback: DrawingEventCallback): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this._listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event
   */
  private emit(type: DrawingEventType, data: Partial<DrawingEvent>): void {
    const event: DrawingEvent = { type, ...data };
    const listeners = this._listeners.get(type);
    if (listeners) {
      for (const callback of listeners) {
        callback(event);
      }
    }
  }
}
