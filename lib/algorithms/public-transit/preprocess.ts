// ============================================
// Preprocess (Public Transit Algorithm)
// ============================================

import type { TripMode, Waypoint, LatLng } from "@/types";
import { calculateDistance } from "../utils/geo";

const DUPLICATE_DISTANCE_THRESHOLD = 10; // meters

export function preprocessWaypoints(waypoints: Waypoint[]): Waypoint[] {
  if (!Array.isArray(waypoints)) {
    throw new Error("Waypoints must be an array");
  }

  const cleaned: Waypoint[] = [];
  const seenIds = new Set<string>();

  for (const waypoint of waypoints) {
    // Validate waypoint structure
    if (!waypoint || typeof waypoint !== "object") {
      console.warn("[preprocessWaypoints] Invalid waypoint object, skipping");
      continue;
    }

    if (!waypoint.id || typeof waypoint.id !== "string") {
      console.warn(
        "[preprocessWaypoints] Waypoint missing valid ID, skipping:",
        waypoint
      );
      continue;
    }

    if (!waypoint.coord || typeof waypoint.coord !== "object") {
      console.warn(
        `[preprocessWaypoints] Waypoint ${waypoint.id} missing coordinates, skipping`
      );
      continue;
    }

    // Validate coordinates
    if (
      !Number.isFinite(waypoint.coord.lat) ||
      !Number.isFinite(waypoint.coord.lng) ||
      waypoint.coord.lat < -90 ||
      waypoint.coord.lat > 90 ||
      waypoint.coord.lng < -180 ||
      waypoint.coord.lng > 180
    ) {
      console.warn(
        `[preprocessWaypoints] Waypoint ${waypoint.id} has invalid coordinates, skipping`
      );
      continue;
    }

    // Check for duplicate IDs
    if (seenIds.has(waypoint.id)) {
      console.warn(
        `[preprocessWaypoints] Duplicate waypoint ID ${waypoint.id}, skipping`
      );
      continue;
    }
    seenIds.add(waypoint.id);

    // Check for spatial duplicates
    const existingIndex = cleaned.findIndex(
      (item) =>
        calculateDistance(item.coord, waypoint.coord) <
        DUPLICATE_DISTANCE_THRESHOLD
    );

    if (existingIndex >= 0) {
      const existing = cleaned[existingIndex];
      cleaned[existingIndex] = {
        ...existing,
        name: mergeNames(existing.name, waypoint.name),
        isFixed: existing.isFixed || waypoint.isFixed,
        dayLock: existing.dayLock ?? waypoint.dayLock,
        importance: mergeOptionalMax(existing.importance, waypoint.importance),
        stayMinutes: mergeOptionalMax(
          existing.stayMinutes,
          waypoint.stayMinutes
        ),
      };
      console.warn(
        `[preprocessWaypoints] Merged duplicate waypoint ${waypoint.id} into ${existing.id}`
      );
      continue;
    }

    cleaned.push(waypoint);
  }

  if (cleaned.length === 0) {
    throw new Error("No valid waypoints after preprocessing");
  }

  return cleaned;
}

export function determineTripMode(
  lodging?: LatLng,
  start?: LatLng,
  end?: LatLng
): TripMode {
  if (lodging) {
    return "LOOP";
  }

  if (start && end && isSameCoordinate(start, end)) {
    return "LOOP";
  }

  return "OPEN";
}

function mergeNames(first: string, second: string): string {
  if (!first) return second;
  if (!second) return first;
  if (first === second) return first;
  return `${first} / ${second}`;
}

function isSameCoordinate(a: LatLng, b: LatLng): boolean {
  const EPS = 1e-6;
  return Math.abs(a.lat - b.lat) < EPS && Math.abs(a.lng - b.lng) < EPS;
}

function mergeOptionalMax(
  first?: number,
  second?: number
): number | undefined {
  if (first === undefined && second === undefined) {
    return undefined;
  }
  if (first === undefined) return second;
  if (second === undefined) return first;
  return Math.max(first, second);
}
