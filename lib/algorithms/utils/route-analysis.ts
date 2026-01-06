// ============================================
// Route Analysis Utilities
// ============================================

import type { Waypoint } from "@/types";
import { calculateDirectionVector, dotProduct } from "./geo";

export function calculateBacktracking(
  route: string[],
  waypoints: Map<string, Waypoint>
): number {
  if (route.length < 2) {
    return 0;
  }

  const first = waypoints.get(route[0]);
  const last = waypoints.get(route[route.length - 1]);

  if (!first || !last) {
    return 0;
  }

  const globalDirection = calculateDirectionVector(first.coord, last.coord);
  if (globalDirection.x === 0 && globalDirection.y === 0) {
    return 0;
  }

  let backtrackingScore = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const current = waypoints.get(route[i]);
    const next = waypoints.get(route[i + 1]);
    if (!current || !next) continue;

    const stepDirection = calculateDirectionVector(
      current.coord,
      next.coord
    );
    const progress = dotProduct(stepDirection, globalDirection);

    if (progress < 0) {
      backtrackingScore += Math.abs(progress);
    }
  }

  return backtrackingScore;
}

export function doSegmentsIntersect(
  a1: { lat: number; lng: number },
  a2: { lat: number; lng: number },
  b1: { lat: number; lng: number },
  b2: { lat: number; lng: number }
): boolean {
  const cross = (
    p1: { lat: number; lng: number },
    p2: { lat: number; lng: number },
    p3: { lat: number; lng: number }
  ) => (p2.lng - p1.lng) * (p3.lat - p1.lat) - (p2.lat - p1.lat) * (p3.lng - p1.lng);

  const d1 = cross(a1, a2, b1);
  const d2 = cross(a1, a2, b2);
  const d3 = cross(b1, b2, a1);
  const d4 = cross(b1, b2, a2);

  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function calculateCrossing(
  route: string[],
  waypoints: Map<string, Waypoint>
): number {
  if (route.length < 4) {
    return 0;
  }

  let crossings = 0;
  for (let i = 0; i < route.length - 3; i++) {
    const a1 = waypoints.get(route[i]);
    const a2 = waypoints.get(route[i + 1]);
    if (!a1 || !a2) continue;

    for (let j = i + 2; j < route.length - 1; j++) {
      const b1 = waypoints.get(route[j]);
      const b2 = waypoints.get(route[j + 1]);
      if (!b1 || !b2) continue;

      if (doSegmentsIntersect(a1.coord, a2.coord, b1.coord, b2.coord)) {
        crossings += 1;
      }
    }
  }

  return crossings;
}
