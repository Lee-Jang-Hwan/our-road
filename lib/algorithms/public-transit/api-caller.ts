// ============================================
// Routing API Integration
// ============================================

import type { DayPlan, LatLng, SegmentCost, SegmentKey, Waypoint } from "@/types";
import { getBestTransitRouteWithDetails } from "@/lib/api/odsay";
import { calculateDistance } from "../utils/geo";

export interface SegmentRequest {
  key: SegmentKey;
  fromCoord: LatLng;
  toCoord: LatLng;
}

export function extractSegments(
  dayPlans: DayPlan[],
  waypoints: Map<string, Waypoint>,
  start: LatLng,
  end?: LatLng,
  lodging?: LatLng
): SegmentRequest[] {
  if (!Array.isArray(dayPlans) || dayPlans.length === 0) {
    console.warn("[extractSegments] No day plans provided");
    return [];
  }

  if (!waypoints || waypoints.size === 0) {
    console.warn("[extractSegments] No waypoints provided");
    return [];
  }

  if (!start || !Number.isFinite(start.lat) || !Number.isFinite(start.lng)) {
    throw new Error("Invalid start coordinates");
  }

  const segments: SegmentRequest[] = [];

  const getWaypointCoord = (id: string): LatLng | null => {
    if (!id) return null;
    const waypoint = waypoints.get(id);
    return waypoint ? waypoint.coord : null;
  };

  for (let dayIndex = 0; dayIndex < dayPlans.length; dayIndex++) {
    const dayPlan = dayPlans[dayIndex];
    if (!dayPlan || !Array.isArray(dayPlan.waypointOrder)) {
      console.warn(`[extractSegments] Invalid day plan at index ${dayIndex}`);
      continue;
    }
    if (dayPlan.waypointOrder.length === 0) continue;

    const isFirstDay = dayIndex === 0;
    const isLastDay = dayIndex === dayPlans.length - 1;

    const firstWaypointId = dayPlan.waypointOrder[0];
    const lastWaypointId =
      dayPlan.waypointOrder[dayPlan.waypointOrder.length - 1];

    const startCoord =
      isFirstDay
        ? start
        : lodging ??
          getWaypointCoord(dayPlans[dayIndex - 1].waypointOrder.slice(-1)[0]) ??
          start;

    const firstCoord = getWaypointCoord(firstWaypointId);
    if (firstCoord) {
      segments.push({
        key: { fromId: "__start__", toId: firstWaypointId },
        fromCoord: startCoord,
        toCoord: firstCoord,
      });
    }

    for (let i = 0; i < dayPlan.waypointOrder.length - 1; i++) {
      const fromId = dayPlan.waypointOrder[i];
      const toId = dayPlan.waypointOrder[i + 1];
      const fromCoord = getWaypointCoord(fromId);
      const toCoord = getWaypointCoord(toId);

      if (fromCoord && toCoord) {
        segments.push({
          key: { fromId, toId },
          fromCoord,
          toCoord,
        });
      }
    }

    const endCoord = isLastDay ? end ?? lodging : lodging;
    const lastCoord = getWaypointCoord(lastWaypointId);

    if (endCoord && lastCoord) {
      segments.push({
        key: { fromId: lastWaypointId, toId: "__end__" },
        fromCoord: lastCoord,
        toCoord: endCoord,
      });
    }
  }

  return segments;
}

export async function callRoutingAPIForSegments(
  segments: SegmentRequest[]
): Promise<SegmentCost[]> {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  const results: SegmentCost[] = [];
  const batchSize = 3;
  const maxRetries = 2;

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (segment) => {
        // Retry logic for API calls
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const route = await getBestTransitRouteWithDetails(
              segment.fromCoord,
              segment.toCoord
            );

            if (!route) {
              if (attempt === maxRetries) {
                console.warn(
                  `[callRoutingAPI] No route found for ${segment.key.fromId} -> ${segment.key.toId}, using fallback`
                );
                return fallbackSegmentCost(segment);
              }
              // Retry
              continue;
            }

            return {
              key: segment.key,
              durationMinutes: route.totalDuration,
              distanceMeters: route.totalDistance,
              transfers: route.details?.transferCount ?? route.transferCount,
              polyline: route.polyline,
            } satisfies SegmentCost;
          } catch (error) {
            if (attempt === maxRetries) {
              console.error(
                `[callRoutingAPI] Error fetching route for ${segment.key.fromId} -> ${segment.key.toId}:`,
                error
              );
              return fallbackSegmentCost(segment);
            }
            // Wait before retry (exponential backoff)
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, attempt) * 100)
            );
          }
        }

        // Fallback (should not reach here)
        return fallbackSegmentCost(segment);
      })
    );

    results.push(...batchResults);

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < segments.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}

function fallbackSegmentCost(segment: SegmentRequest): SegmentCost {
  const distanceMeters = calculateDistance(segment.fromCoord, segment.toCoord);
  const durationMinutes = Math.round((distanceMeters / 1000) * 5);

  return {
    key: segment.key,
    durationMinutes,
    distanceMeters,
  };
}
