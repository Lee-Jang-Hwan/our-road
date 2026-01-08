// ============================================
// Routing API Integration
// ============================================

import type { DayPlan, LatLng, SegmentCost, SegmentKey, Waypoint } from "@/types";
import { getBestTransitRouteWithDetails } from "@/lib/api/odsay";
import { getTmapWalkingRoute } from "@/lib/api/tmap";
import { calculateDistance } from "../utils/geo";
import pLimit from "p-limit";
import { logCircuitBreaker } from "@/lib/utils/api-logger";
import { segmentCache } from "./segment-cache";

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

    // 출발지 좌표 및 ID 결정
    let startCoord: LatLng;
    let startId: string;

    if (isFirstDay) {
      startCoord = start;
      startId = "__origin__";
    } else if (lodging) {
      startCoord = lodging;
      startId = "__accommodation_0__";
    } else {
      // 숙소가 없으면 전날 마지막 경유지에서 시작
      const prevDayPlan = dayPlans[dayIndex - 1];

      if (!prevDayPlan || !prevDayPlan.waypointOrder || prevDayPlan.waypointOrder.length === 0) {
        console.warn(`[extractSegments] Day ${dayIndex + 1}: No previous day waypoints, using origin`);
        startCoord = start;
        startId = "__origin__";
      } else {
        const prevLastWaypointId = prevDayPlan.waypointOrder[prevDayPlan.waypointOrder.length - 1];
        const prevLastWaypoint = getWaypointCoord(prevLastWaypointId);

        if (!prevLastWaypoint) {
          console.warn(`[extractSegments] Day ${dayIndex + 1}: Cannot find coordinates for waypoint ${prevLastWaypointId}, using origin`);
          startCoord = start;
          startId = "__origin__";
        } else {
          startCoord = prevLastWaypoint;
          startId = prevLastWaypointId;
        }
      }
    }

    // 첫 경유지로 가는 구간
    const firstCoord = getWaypointCoord(firstWaypointId);
    if (firstCoord) {
      segments.push({
        key: { fromId: startId, toId: firstWaypointId },
        fromCoord: startCoord,
        toCoord: firstCoord,
      });
    }

    // 경유지 간 구간
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

    // 도착지 좌표 및 ID 결정
    const lastCoord = getWaypointCoord(lastWaypointId);
    let endCoord: LatLng | undefined;
    let endId: string | undefined;
    console.log(`[extractSegments Day ${dayIndex + 1}] isLastDay:`, isLastDay, 'lodging:', lodging, 'end:', end);

    if (lodging) {
      // 숙소가 있으면 모든 날의 종점은 숙소
      endCoord = lodging;
      endId = "__accommodation_0__";
    } else if (isLastDay && end) {
      // 숙소가 없고 마지막 날: 도착지 추가
      // (마지막 경유지와 도착지가 완전히 같은 좌표가 아니면 항상 추가)
      const isSameAsLastWaypoint =
        !!lastCoord &&
        Math.abs(end.lat - lastCoord.lat) < 0.00001 &&
        Math.abs(end.lng - lastCoord.lng) < 0.00001;

      if (!isSameAsLastWaypoint) {
        endCoord = end;
        endId = "__destination__";
      }
      // 마지막 경유지와 도착지가 완전히 같으면 순환 여행으로 간주하여 endCoord를 설정하지 않음
    }
    // 숙소가 없고 마지막 날이 아니면 endCoord를 설정하지 않음 (다음 날 이어짐)

    // 마지막 경유지에서 도착지로 가는 구간
    if (endCoord && endId && lastCoord) {
      console.log(`[extractSegments Day ${dayIndex + 1}] Adding destination segment: ${lastWaypointId} -> ${endId}`);
      segments.push({
        key: { fromId: lastWaypointId, toId: endId },
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
    logCircuitBreaker("CLOSED", 0, "Circuit recovered from HALF_OPEN");
  }
  circuitBreaker.failureCount = 0;
}

function recordFailure(): void {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.state === "HALF_OPEN") {
    circuitBreaker.state = "OPEN";
    logCircuitBreaker(
      "OPEN",
      circuitBreaker.failureCount,
      "Reopening circuit after failure in HALF_OPEN state"
    );
    console.warn("[CircuitBreaker] Reopening circuit after failure in HALF_OPEN state");
  } else if (circuitBreaker.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.state = "OPEN";
    logCircuitBreaker(
      "OPEN",
      circuitBreaker.failureCount,
      `Opening circuit after ${CIRCUIT_BREAKER_THRESHOLD} failures`
    );
    console.warn(
      `[CircuitBreaker] Opening circuit after ${CIRCUIT_BREAKER_THRESHOLD} failures`
    );
  }
}

// Concurrency limit for API calls
const API_CONCURRENCY_LIMIT = 3; // Maximum 3 concurrent API requests
const apiLimit = pLimit(API_CONCURRENCY_LIMIT);

/**
 * Fetch single segment with caching
 */
async function fetchSingleSegment(
  segment: SegmentRequest,
  maxRetries = 3
): Promise<SegmentCost> {
  // Check cache first
  const cached = segmentCache.get(segment.fromCoord, segment.toCoord);
  if (cached) {
    console.log(
      `[Cache HIT] ${segment.key.fromId} -> ${segment.key.toId}`
    );
    // Return cached data with original segment key
    return { ...cached, key: segment.key };
  }

  console.log(`[Cache MISS] ${segment.key.fromId} -> ${segment.key.toId}`);

  const distanceMeters = calculateDistance(segment.fromCoord, segment.toCoord);

  // 500m 미만: 도보 API 호출
  if (distanceMeters < 500) {
    console.log(
      `[callRoutingAPI] Walking distance (${Math.round(distanceMeters)}m) for ${segment.key.fromId} -> ${segment.key.toId}, calling TMAP API`
    );

    try {
      const walkingRoute = await getTmapWalkingRoute(
        segment.fromCoord,
        segment.toCoord
      );

      if (walkingRoute) {
        const result: SegmentCost = {
          key: segment.key,
          durationMinutes: walkingRoute.totalDuration,
          distanceMeters: walkingRoute.totalDistance,
          polyline: walkingRoute.polyline,
        };
        // Cache the result
        segmentCache.set(segment.fromCoord, segment.toCoord, result);
        return result;
      }
      console.warn(
        `[callRoutingAPI] TMAP returned no route for ${segment.key.fromId} -> ${segment.key.toId}`,
        { from: segment.fromCoord, to: segment.toCoord }
      );
    } catch (error) {
      console.warn(
        `[callRoutingAPI] TMAP API failed for ${segment.key.fromId} -> ${segment.key.toId}, using fallback calculation`,
        error
      );
    }

    // TMAP API 실패 시 fallback
    return calculateWalkingSegmentCost(segment, distanceMeters);
  }

  // 500m 이상: 대중교통 API 호출
  // Check circuit breaker
  if (!checkCircuitBreaker()) {
    console.warn(
      `[callRoutingAPI] Circuit breaker is OPEN, using fallback for ${segment.key.fromId} -> ${segment.key.toId}`
    );
    return fallbackSegmentCost(segment, distanceMeters);
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
          return fallbackSegmentCost(segment, distanceMeters);
        }
        // Retry with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 200)
        );
        continue;
      }

      // Success
      recordSuccess();
      const result: SegmentCost = {
        key: segment.key,
        durationMinutes: route.totalDuration,
        distanceMeters: route.totalDistance,
        transfers: route.details?.transferCount ?? route.transferCount,
        polyline: route.polyline,
        transitDetails: route.details,
      };

      // Cache the successful result
      segmentCache.set(segment.fromCoord, segment.toCoord, result);

      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(
          `[callRoutingAPI] Error fetching route for ${segment.key.fromId} -> ${segment.key.toId} after ${maxRetries} retries:`,
          error
        );
        recordFailure();
        return fallbackSegmentCost(segment, distanceMeters);
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
  return fallbackSegmentCost(segment, distanceMeters);
}

/**
 * Call routing API for multiple segments with smart caching and retry
 * Only retries failed segments, not the entire batch
 */
export async function callRoutingAPIForSegments(
  segments: SegmentRequest[]
): Promise<SegmentCost[]> {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  console.log(`[callRoutingAPIForSegments] Processing ${segments.length} segments`);

  // Fetch all segments with concurrency limit
  const results = await Promise.all(
    segments.map((segment) => apiLimit(() => fetchSingleSegment(segment)))
  );

  // Log cache statistics
  const stats = segmentCache.getStats();
  console.log(
    `[SegmentCache] Size: ${stats.size}/${stats.maxSize} entries`
  );

  return results;
}

/**
 * Calculate walking segment cost for short distances (< 500m)
 * - Walking speed: 4 km/h (약 67m/분)
 * - No API call required
 */
function calculateWalkingSegmentCost(
  segment: SegmentRequest,
  distanceMeters: number
): SegmentCost {
  const distanceKm = distanceMeters / 1000;

  // Walking: 4 km/h
  const durationMinutes = Math.round((distanceKm / 4) * 60);

  // Ensure minimum duration (1 minute)
  const finalDuration = Math.max(1, durationMinutes);

  console.log(
    `[calculateWalkingSegmentCost] ${segment.key.fromId} -> ${segment.key.toId}: ${Math.round(distanceMeters)}m, ${finalDuration}분 (도보)`
  );

  return {
    key: segment.key,
    durationMinutes: finalDuration,
    distanceMeters,
    // transitDetails 없음 = 도보 구간
  };
}

/**
 * Calculate fallback segment cost when API fails (for distances >= 500m)
 * - Public transit: 20 km/h average speed + 5 min overhead for waiting/transfers
 */
function fallbackSegmentCost(
  segment: SegmentRequest,
  distanceMeters: number
): SegmentCost {
  const distanceKm = distanceMeters / 1000;

  // Public transit assumption: 20 km/h + 5 min overhead
  const travelTimeMinutes = (distanceKm / 20) * 60;
  const overheadMinutes = 5;
  const durationMinutes = Math.round(travelTimeMinutes + overheadMinutes);

  // Ensure minimum duration
  const finalDuration = Math.max(1, durationMinutes);

  console.warn(
    `[fallbackSegmentCost] ${segment.key.fromId} -> ${segment.key.toId}: ${Math.round(distanceMeters)}m, ${finalDuration}분 (추정)`
  );

  return {
    key: segment.key,
    durationMinutes: finalDuration,
    distanceMeters,
    // transitDetails 없음 = API 실패 시 fallback
  };
}
