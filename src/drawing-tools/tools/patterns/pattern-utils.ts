import { distanceToLineSegment, midpoint } from '../../core/geometry';
import type { Point } from '../../core/types';

export const PATTERN_HIT_THRESHOLD = 6;

export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function distanceToPolyline(point: Point, points: Point[], closed: boolean = false): number {
  if (points.length < 2) return Number.POSITIVE_INFINITY;

  let minDistance = Number.POSITIVE_INFINITY;
  const segmentCount = closed ? points.length : points.length - 1;

  for (let i = 0; i < segmentCount; i++) {
    const next = (i + 1) % points.length;
    minDistance = Math.min(minDistance, distanceToLineSegment(point, points[i], points[next]));
  }

  return minDistance;
}

export function safeRatio(numerator: number, denominator: number): number | null {
  if (Math.abs(denominator) < 1e-9) return null;
  return Math.abs(numerator / denominator);
}

export function formatRatio(value: number | null, precision: number = 3): string {
  if (value === null || !Number.isFinite(value)) return '--';
  return value.toFixed(precision).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function segmentLabelPosition(start: Point, end: Point, offset: number = 12): Point {
  const mid = midpoint(start, end);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return { x: mid.x, y: mid.y - offset };
  }

  const nx = -dy / length;
  const ny = dx / length;

  return {
    x: mid.x + nx * offset,
    y: mid.y + ny * offset,
  };
}

export function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };

  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }

  return {
    x: x / points.length,
    y: y / points.length,
  };
}

export function sampleSinePoints(
  start: Point,
  control: Point,
  viewportWidth: number,
  step: number = 8
): Point[] {
  const quarterPeriod = Math.max(1, Math.abs(control.x - start.x));
  const amplitude = control.y - start.y;
  const points: Point[] = [];

  for (let x = start.x; x <= viewportWidth; x += step) {
    const angle = ((x - start.x) / quarterPeriod) * (Math.PI / 2);
    points.push({
      x,
      y: start.y + amplitude * Math.sin(angle),
    });
  }

  if (points.length === 0 || points[points.length - 1].x < viewportWidth) {
    const angle = ((viewportWidth - start.x) / quarterPeriod) * (Math.PI / 2);
    points.push({
      x: viewportWidth,
      y: start.y + amplitude * Math.sin(angle),
    });
  }

  return points;
}

export function sampleSemicirclePoints(
  startX: number,
  diameter: number,
  baselineY: number,
  segments: number = 24
): Point[] {
  const radius = diameter / 2;
  const centerX = startX + radius;
  const points: Point[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI - (i / segments) * Math.PI;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: baselineY - Math.sin(angle) * radius,
    });
  }

  return points;
}
