// ============================================
// Geo Utilities (Public Transit Algorithm)
// ============================================

import type { LatLng } from "@/types";

export interface Vector2D {
  x: number;
  y: number;
}

const EARTH_RADIUS_METERS = 6371000;

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
  return EARTH_RADIUS_METERS * c;
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

  const sum = validPoints.reduce(
    (acc, point) => {
      acc.lat += point.lat;
      acc.lng += point.lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / validPoints.length,
    lng: sum.lng / validPoints.length,
  };
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
