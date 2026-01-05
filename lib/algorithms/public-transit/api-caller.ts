// ============================================
// Routing API Integration
// ============================================

import type { DayPlan, LatLng, SegmentCost, SegmentKey, Waypoint } from "@/types";
import { getBestTransitRouteWithDetails } from "@/lib/api/odsay";
import { calculateDistance } from "../utils/geo";
import pLimit from "p-limit";

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

// Circuit Breaker state
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
}

const circuitBreaker: CircuitBreakerState = {
  failureCount: 0,
  lastFailureTime: 0,
  state: "CLOSED",
};

const CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 consecutive failures
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds
const CIRCUIT_BREAKER_HALF_OPEN_RETRIES = 3;

function checkCircuitBreaker(): boolean {
  const now = Date.now();

  if (circuitBreaker.state === "OPEN") {
    if (now - circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
      // Try to recover
      circuitBreaker.state = "HALF_OPEN";
      circuitBreaker.failureCount = 0;
      return true;
    }
    return false; // Circuit is open, reject request
  }

  return true; // Circuit is closed or half-open, allow request
}

function recordSuccess(): void {
  if (circuitBreaker.state === "HALF_OPEN") {
    circuitBreaker.state = "CLOSED";
  }
  circuitBreaker.failureCount = 0;
}

function recordFailure(): void {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.state === "HALF_OPEN") {
    circuitBreaker.state = "OPEN";
    console.warn("[CircuitBreaker] Reopening circuit after failure in HALF_OPEN state");
  } else if (circuitBreaker.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.state = "OPEN";
    console.warn(
      `[CircuitBreaker] Opening circuit after ${CIRCUIT_BREAKER_THRESHOLD} failures`
    );
  }
}

// Concurrency limit for API calls
const API_CONCURRENCY_LIMIT = 3; // Maximum 3 concurrent API requests
const apiLimit = pLimit(API_CONCURRENCY_LIMIT);

export async function callRoutingAPIForSegments(
  segments: SegmentRequest[]
): Promise<SegmentCost[]> {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  const maxRetries = 3;

  // Use p-limit to control concurrency instead of manual batching
  const results = await Promise.all(
    segments.map((segment) =>
      apiLimit(async () => {
        // Check circuit breaker
        if (!checkCircuitBreaker()) {
          console.warn(
            `[callRoutingAPI] Circuit breaker is OPEN, using fallback for ${segment.key.fromId} -> ${segment.key.toId}`
          );
          return fallbackSegmentCost(segment);
        }

        // Retry logic with exponential backoff
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const route = await getBestTransitRouteWithDetails(
              segment.fromCoord,
              segment.toCoord
            );

            if (!route) {
              if (attempt === maxRetries) {
                console.warn(
                  `[callRoutingAPI] No route found for ${segment.key.fromId} -> ${segment.key.toId} after ${maxRetries} retries, using fallback`
                );
                recordFailure();
                return fallbackSegmentCost(segment);
              }
              // Retry with exponential backoff
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, attempt) * 200)
              );
              continue;
            }

            // Success
            recordSuccess();
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
                `[callRoutingAPI] Error fetching route for ${segment.key.fromId} -> ${segment.key.toId} after ${maxRetries} retries:`,
                error
              );
              recordFailure();
              return fallbackSegmentCost(segment);
            }
            // Exponential backoff: 200ms, 400ms, 800ms
            const delay = Math.pow(2, attempt) * 200;
            console.log(
              `[callRoutingAPI] Retry ${attempt + 1}/${maxRetries} for ${segment.key.fromId} -> ${segment.key.toId} after ${delay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        // Fallback (should not reach here)
        recordFailure();
        return fallbackSegmentCost(segment);
      })
    )
  );

  return results;
}

/**
 * Calculate fallback segment cost using improved estimation
 * - Walking: 4 km/h for distances < 500m
 * - Public transit: 20 km/h average speed + 5 min overhead for transfers/waiting
 */
function fallbackSegmentCost(segment: SegmentRequest): SegmentCost {
  const distanceMeters = calculateDistance(segment.fromCoord, segment.toCoord);
  const distanceKm = distanceMeters / 1000;

  let durationMinutes: number;

  if (distanceMeters < 500) {
    // Short distance: assume walking at 4 km/h
    durationMinutes = Math.round((distanceKm / 4) * 60);
  } else {
    // Longer distance: assume public transit
    // Average speed: 20 km/h + 5 min overhead for waiting/transfers
    const travelTimeMinutes = (distanceKm / 20) * 60;
    const overheadMinutes = 5;
    durationMinutes = Math.round(travelTimeMinutes + overheadMinutes);
  }

  // Ensure minimum duration
  durationMinutes = Math.max(1, durationMinutes);

  return {
    key: segment.key,
    durationMinutes,
    distanceMeters,
  };
}
