import type { IPrimitivePaneView } from '../../../model/ipane-primitive';

import { Drawing } from '../../core/drawing';
import { distanceBetweenPoints } from '../../core/geometry';
import type { Anchor, DrawingOptions, DrawingStyle, IDrawing, Point, SerializedDrawing, Viewport } from '../../core/types';
import type { ArcGeometry, Geometry } from '../../core/geometry';
import { SectorPaneView } from './sector-pane-view';

export interface SectorOptions extends DrawingOptions {
  sweepAngle?: number;
  clockwise?: boolean;
  filled?: boolean;
}

export class Sector extends Drawing {
  readonly type = 'sector';

  protected static readonly REQUIRED_ANCHORS = 2;
  protected static readonly HIT_THRESHOLD = 6;

  private _sectorOptions: SectorOptions;

  constructor(
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<SectorOptions> = {}
  ) {
    const { sweepAngle, clockwise, filled, ...baseOptions } = options;
    super(id, anchors, style, baseOptions);

    this._sectorOptions = {
      ...this._options,
      sweepAngle: sweepAngle ?? 75,
      clockwise: clockwise ?? false,
      filled: filled ?? true,
    };
  }

  get sectorOptions(): SectorOptions {
    return this._sectorOptions;
  }

  setSectorOptions(options: Partial<SectorOptions>): void {
    this._sectorOptions = { ...this._sectorOptions, ...options };
    super.updateOptions(options);
  }

  override updateOptions(options: Partial<SectorOptions>): void {
    this._sectorOptions = { ...this._sectorOptions, ...options };
    super.updateOptions(options);
  }

  override isValid(): boolean {
    return this._anchors.length >= Sector.REQUIRED_ANCHORS;
  }

  override paneViews(): IPrimitivePaneView[] {
    return [new SectorPaneView(this)];
  }

  getSectorGeometry(viewport: Viewport): { center: Point; edge: Point; radius: number; startAngle: number; endAngle: number } | null {
    if (!this.isValid()) {
      return null;
    }

    const center = this.anchorToPixel(this._anchors[0], viewport);
    const edge = this.anchorToPixel(this._anchors[1], viewport);
    if (!center || !edge) {
      return null;
    }

    const radius = distanceBetweenPoints(center, edge);
    const startAngle = Math.atan2(edge.y - center.y, edge.x - center.x);
    const direction = this._sectorOptions.clockwise ? -1 : 1;
    const sweepRadians = ((this._sectorOptions.sweepAngle ?? 75) * Math.PI) / 180;

    return {
      center,
      edge,
      radius,
      startAngle,
      endAngle: startAngle + direction * sweepRadians,
    };
  }

  override computeGeometry(viewport: Viewport): Geometry[] {
    const sector = this.getSectorGeometry(viewport);
    if (!sector) {
      return [];
    }

    return [{
      type: 'arc',
      center: sector.center,
      radius: sector.radius,
      startAngle: sector.startAngle,
      endAngle: sector.endAngle,
      counterClockwise: Boolean(this._sectorOptions.clockwise),
    } as ArcGeometry];
  }

  override testHit(point: Point, viewport: Viewport): boolean {
    const sector = this.getSectorGeometry(viewport);
    if (!sector) {
      return false;
    }

    const distance = distanceBetweenPoints(point, sector.center);
    if (distance > sector.radius + Sector.HIT_THRESHOLD) {
      return false;
    }

    const angle = Math.atan2(point.y - sector.center.y, point.x - sector.center.x);
    if (!angleWithinSweep(angle, sector.startAngle, sector.endAngle, Boolean(this._sectorOptions.clockwise))) {
      return false;
    }

    if (this._sectorOptions.filled) {
      return distance <= sector.radius;
    }

    return Math.abs(distance - sector.radius) <= Sector.HIT_THRESHOLD;
  }

  override toJSON(): SerializedDrawing {
    return {
      ...super.toJSON(),
      options: { ...this._sectorOptions },
    };
  }

  override fromJSON(data: SerializedDrawing): void {
    super.fromJSON(data);
    this._sectorOptions = { ...this._sectorOptions, ...data.options };
  }

  override clone(newId: string): IDrawing {
    return new Sector(newId, [...this._anchors], { ...this._style }, { ...this._sectorOptions });
  }
}

function angleWithinSweep(angle: number, startAngle: number, endAngle: number, clockwise: boolean): boolean {
  const normalizedAngle = normalizeAngle(angle);
  const normalizedStart = normalizeAngle(startAngle);
  const normalizedEnd = normalizeAngle(endAngle);

  if (!clockwise) {
    if (normalizedStart <= normalizedEnd) {
      return normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd;
    }
    return normalizedAngle >= normalizedStart || normalizedAngle <= normalizedEnd;
  }

  if (normalizedEnd <= normalizedStart) {
    return normalizedAngle <= normalizedStart && normalizedAngle >= normalizedEnd;
  }
  return normalizedAngle <= normalizedStart || normalizedAngle >= normalizedEnd;
}

function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}
