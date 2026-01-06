// ============================================
// Geo Utilities (Public Transit Algorithm)
// ============================================

import type { LatLng } from "@/types";

export interface Vector2D {
  x: number;
  y: number;
}

const EARTH_RADIUS_METERS = 6371000;

// Memoization cache for distance calculations
const distanceCache = new Map<string, number>();
const CACHE_SIZE_LIMIT = 10000;

function createDistanceCacheKey(a: LatLng, b: LatLng): string {
  // Create a consistent key regardless of order
  const lat1 = Math.round(a.lat * 1000000) / 1000000;
  const lng1 = Math.round(a.lng * 1000000) / 1000000;
  const lat2 = Math.round(b.lat * 1000000) / 1000000;
  const lng2 = Math.round(b.lng * 1000000) / 1000000;

  if (lat1 < lat2 || (lat1 === lat2 && lng1 < lng2)) {
    return `${lat1},${lng1}:${lat2},${lng2}`;
  }
  return `${lat2},${lng2}:${lat1},${lng1}`;
}

export function calculateDistance(a: LatLng, b: LatLng): number {
  // Validate inputs
  if (
    !a ||
    !b ||
    !Number.isFinite(a.lat) ||
    !Number.isFinite(a.lng) ||
    !Number.isFinite(b.lat) ||
    !Number.isFinite(b.lng)
  ) {
    throw new Error("Invalid coordinates for distance calculation");
  }

  // Check cache
  const cacheKey = createDistanceCacheKey(a, b);
  const cached = distanceCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  const distance = EARTH_RADIUS_METERS * c;

  // Store in cache (with size limit)
  if (distanceCache.size >= CACHE_SIZE_LIMIT) {
    // Remove oldest entry (first key)
    const firstKey = distanceCache.keys().next().value;
    if (firstKey) {
      distanceCache.delete(firstKey);
    }
  }
  distanceCache.set(cacheKey, distance);

  return distance;
}

/**
 * Clear the distance calculation cache
 * Useful for testing or memory management
 */
export function clearDistanceCache(): void {
  distanceCache.clear();
}

// Memoization cache for centroid calculations
const centroidCache = new Map<string, LatLng>();
const CENTROID_CACHE_SIZE_LIMIT = 1000;

function createCentroidCacheKey(points: LatLng[]): string {
  // Create a hash of the points array
  return points
    .map((p) => {
      const lat = Math.round(p.lat * 1000000) / 1000000;
      const lng = Math.round(p.lng * 1000000) / 1000000;
      return `${lat},${lng}`;
    })
    .sort()
    .join('|');
}

export function calculateCentroid(points: LatLng[]): LatLng {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error("Cannot calculate centroid of empty points array");
  }

  // Filter out invalid points
  const validPoints = points.filter(
    (p) =>
      p &&
      typeof p === "object" &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng)
  );

  if (validPoints.length === 0) {
    throw new Error("No valid points to calculate centroid");
  }

  // Check cache
  const cacheKey = createCentroidCacheKey(validPoints);
  const cached = centroidCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const sum = validPoints.reduce(
    (acc, point) => {
      acc.lat += point.lat;
      acc.lng += point.lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );

  const centroid = {
    lat: sum.lat / validPoints.length,
    lng: sum.lng / validPoints.length,
  };

  // Store in cache (with size limit)
  if (centroidCache.size >= CENTROID_CACHE_SIZE_LIMIT) {
    const firstKey = centroidCache.keys().next().value;
    if (firstKey) {
      centroidCache.delete(firstKey);
    }
  }
  centroidCache.set(cacheKey, centroid);

  return centroid;
}

/**
 * Clear the centroid calculation cache
 * Useful for testing or memory management
 */
export function clearCentroidCache(): void {
  centroidCache.clear();
}

export function calculateDirectionVector(from: LatLng, to: LatLng): Vector2D {
  const vector = { x: to.lng - from.lng, y: to.lat - from.lat };
  const magnitude = Math.hypot(vector.x, vector.y);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  };
}

export function dotProduct(v1: Vector2D, v2: Vector2D): number {
  return v1.x * v2.x + v1.y * v2.y;
}

export function projectOntoAxis(point: LatLng, axis: Vector2D): number {
  return point.lng * axis.x + point.lat * axis.y;
}
