// ============================================
// Routing API Integration
// ============================================

import type {
  DayPlan,
  LatLng,
  SegmentCost,
  SegmentKey,
  Waypoint,
} from "@/types";
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
  lodging?: LatLng,
): SegmentRequest[] {
  if (!Array.isArray(dayPlans) || dayPlans.length === 0) {
    return [];
  }

  if (!waypoints || waypoints.size === 0) {
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

  const pushSegment = (
    fromId: string,
    toId: string,
    fromCoord: LatLng,
    toCoord: LatLng,
  ) => {
    segments.push({
      key: { fromId, toId },
      fromCoord,
      toCoord,
    });
  };

  for (let dayIndex = 0; dayIndex < dayPlans.length; dayIndex++) {
    const dayPlan = dayPlans[dayIndex];
    if (!dayPlan || !Array.isArray(dayPlan.waypointOrder)) {
      continue;
    }
    if (dayPlan.waypointOrder.length === 0) continue;

    const isFirstDay = dayIndex === 0;
    const isLastDay = dayIndex === dayPlans.length - 1;

    // Determine start coordinate and ID
    let startCoord: LatLng = start;
    let startId = "__origin__";

    if (isFirstDay) {
      startCoord = start;
      startId = "__origin__";
    } else if (lodging) {
      startCoord = lodging;
      startId = "__accommodation_0__";
    } else {
      // ??덈꺖揶쎛 ??곸몵筌??袁④텊 筌띾뜆?筌?野껋럩?筌왖?癒?퐣 ??뽰삂
      const prevDayPlan = dayPlans[dayIndex - 1];

      if (
        !prevDayPlan ||
        !prevDayPlan.waypointOrder ||
        prevDayPlan.waypointOrder.length === 0
      ) {
        startCoord = start;
        startId = "__origin__";
      } else {
        const prevLastWaypointId =
          prevDayPlan.waypointOrder[prevDayPlan.waypointOrder.length - 1];
        const prevLastWaypoint = getWaypointCoord(prevLastWaypointId);

        if (!prevLastWaypoint) {
          startCoord = start;
          startId = "__origin__";
        } else {
          startCoord = prevLastWaypoint;
          startId = prevLastWaypointId;
        }
      }
    }

    const checkInBreakIndex = dayPlan.checkInBreakIndex;
    const hasCheckInBreak =
      lodging &&
      Number.isFinite(checkInBreakIndex) &&
      typeof checkInBreakIndex === "number";

    if (hasCheckInBreak && lodging) {
      let endCoord: LatLng | undefined;
      let endId: string | undefined;
      if (isLastDay && end) {
        const lastId =
          dayPlan.waypointOrder[dayPlan.waypointOrder.length - 1];
        const lastCoord = getWaypointCoord(lastId);
        const isSameAsLastWaypoint =
          !!lastCoord &&
          Math.abs(end.lat - lastCoord.lat) < 0.00001 &&
          Math.abs(end.lng - lastCoord.lng) < 0.00001;
        if (!isSameAsLastWaypoint) {
          endCoord = end;
          endId = "__destination__";
        }
      } else if (lodging) {
        endCoord = lodging;
        endId = "__accommodation_0__";
      }

      const breakIndex = Math.min(
        Math.max(checkInBreakIndex, 0),
        dayPlan.waypointOrder.length,
      );
      const amWaypointIds = dayPlan.waypointOrder.slice(0, breakIndex);
      const pmWaypointIds = dayPlan.waypointOrder.slice(breakIndex);
      const lodgingId = "__accommodation_0__";

      if (amWaypointIds.length > 0) {
        const firstAmId = amWaypointIds[0];
        const firstAmCoord = getWaypointCoord(firstAmId);
        if (firstAmCoord) {
          pushSegment(startId, firstAmId, startCoord, firstAmCoord);
        }

        for (let i = 0; i < amWaypointIds.length - 1; i++) {
          const fromId = amWaypointIds[i];
          const toId = amWaypointIds[i + 1];
          const fromCoord = getWaypointCoord(fromId);
          const toCoord = getWaypointCoord(toId);
          if (fromCoord && toCoord) {
            pushSegment(fromId, toId, fromCoord, toCoord);
          }
        }

        const lastAmId = amWaypointIds[amWaypointIds.length - 1];
        const lastAmCoord = getWaypointCoord(lastAmId);
        if (lastAmCoord) {
          pushSegment(lastAmId, lodgingId, lastAmCoord, lodging);
        }
      } else {
        pushSegment(startId, lodgingId, startCoord, lodging);
      }

      if (pmWaypointIds.length > 0) {
        const firstPmId = pmWaypointIds[0];
        const firstPmCoord = getWaypointCoord(firstPmId);
        if (firstPmCoord) {
          pushSegment(lodgingId, firstPmId, lodging, firstPmCoord);
        }

        for (let i = 0; i < pmWaypointIds.length - 1; i++) {
          const fromId = pmWaypointIds[i];
          const toId = pmWaypointIds[i + 1];
          const fromCoord = getWaypointCoord(fromId);
          const toCoord = getWaypointCoord(toId);
          if (fromCoord && toCoord) {
            pushSegment(fromId, toId, fromCoord, toCoord);
          }
        }

        const lastPmId = pmWaypointIds[pmWaypointIds.length - 1];
        const lastPmCoord = getWaypointCoord(lastPmId);
        if (endCoord && endId && lastPmCoord) {
          pushSegment(lastPmId, endId, lastPmCoord, endCoord);
        }
      }

      continue;
    }

    const firstWaypointId = dayPlan.waypointOrder[0];
    const lastWaypointId =
      dayPlan.waypointOrder[dayPlan.waypointOrder.length - 1];

    // 筌?野껋럩?筌왖嚥?揶쎛???닌덉퍢
    const firstCoord = getWaypointCoord(firstWaypointId);
    if (firstCoord) {
      segments.push({
        key: { fromId: startId, toId: firstWaypointId },
        fromCoord: startCoord,
        toCoord: firstCoord,
      });
    }

    // 野껋럩?筌왖 揶??닌덉퍢
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

    // ?袁⑷컩筌왖 ?ル슦紐?獄?ID 野껉퀣??
    const lastCoord = getWaypointCoord(lastWaypointId);
    let endCoord: LatLng | undefined;
    let endId: string | undefined;

    if (isLastDay && end) {
      // 筌띾뜆?筌??醫? ??湲??袁⑷컩筌왖 ????
      // (筌띾뜆?筌?野껋럩?筌왖?? ?袁⑷컩筌왖揶쎛 ?袁⑹읈??揶쏆늿? ?ル슦紐닷첎? ?袁⑤빍筌???湲??곕떽?)
      const isSameAsLastWaypoint =
        !!lastCoord &&
        Math.abs(end.lat - lastCoord.lat) < 0.00001 &&
        Math.abs(end.lng - lastCoord.lng) < 0.00001;

      if (!isSameAsLastWaypoint) {
        endCoord = end;
        endId = "__destination__";
      }
      // 筌띾뜆?筌?野껋럩?筌왖?? ?袁⑷컩筌왖揶쎛 ?袁⑹읈??揶쏆늿?앾쭖???쀬넎 ??六??곗쨮 揶쏄쑴竊??뤿연 endCoord????쇱젟??? ??놁벉
    } else if (lodging) {
      // 筌띾뜆?筌??醫롮뵠 ?袁⑤빍????덈꺖揶쎛 ??됱몵筌???덈꺖
      endCoord = lodging;
      endId = "__accommodation_0__";
    }
    // ??덈꺖揶쎛 ??얩?筌띾뜆?筌??醫롮뵠 ?袁⑤빍筌?endCoord????쇱젟??? ??놁벉 (??쇱벉 ????곷선筌?

    // 筌띾뜆?筌?野껋럩?筌왖?癒?퐣 ?袁⑷컩筌왖嚥?揶쎛???닌덉퍢
    if (endCoord && endId && lastCoord) {
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
      "Reopening circuit after failure in HALF_OPEN state",
    );
  } else if (circuitBreaker.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.state = "OPEN";
    logCircuitBreaker(
      "OPEN",
      circuitBreaker.failureCount,
      `Opening circuit after ${CIRCUIT_BREAKER_THRESHOLD} failures`,
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
  maxRetries = 3,
): Promise<SegmentCost> {
  // Check cache first
  const cached = segmentCache.get(segment.fromCoord, segment.toCoord);
  if (cached) {
    // Return cached data with original segment key
    return { ...cached, key: segment.key };
  }

  const distanceMeters = calculateDistance(segment.fromCoord, segment.toCoord);

  // 700 ??꾨릭筌? ?袁⑤궖 API ?紐꾪뀱
  if (distanceMeters <= 700) {
    try {
      const walkingRoute = await getTmapWalkingRoute(
        segment.fromCoord,
        segment.toCoord,
      );

      if (walkingRoute) {
        // ?袁⑤궖 ?닌덉퍢??transitDetails ?類κ묶嚥???볥궗 (筌왖????뽯뻻???袁る퉸)
        const result: SegmentCost = {
          key: segment.key,
          durationMinutes: walkingRoute.totalDuration,
          distanceMeters: walkingRoute.totalDistance,
          polyline: walkingRoute.polyline,
          transitDetails: {
            totalFare: 0,
            transferCount: 0,
            walkingTime: walkingRoute.totalDuration,
            walkingDistance: walkingRoute.totalDistance,
            subPaths: [
              {
                trafficType: 3, // ?袁⑤궖
                distance: walkingRoute.totalDistance,
                sectionTime: walkingRoute.totalDuration,
                startCoord: segment.fromCoord,
                endCoord: segment.toCoord,
                polyline: walkingRoute.polyline,
              },
            ],
          },
        };
        // Cache the result
        segmentCache.set(segment.fromCoord, segment.toCoord, result);
        return result;
      }
    } catch {
      // TMAP API failed, will use fallback
    }

    // TMAP API ??쎈솭 ??fallback
    return calculateWalkingSegmentCostWithDetails(segment, distanceMeters);
  }

  // 700m ?λ뜃?득? ??餓λ쵌???API ?紐꾪뀱
  // Check circuit breaker
  if (!checkCircuitBreaker()) {
    return fallbackSegmentCost(segment, distanceMeters);
  }

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const route = await getBestTransitRouteWithDetails(
        segment.fromCoord,
        segment.toCoord,
      );

      if (!route) {
        if (attempt === maxRetries) {
          recordFailure();
          return fallbackSegmentCost(segment, distanceMeters);
        }
        // Retry with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 200),
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
          error,
        );
        recordFailure();
        return fallbackSegmentCost(segment, distanceMeters);
      }
      // Exponential backoff: 200ms, 400ms, 800ms
      const delay = Math.pow(2, attempt) * 200;
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
  segments: SegmentRequest[],
): Promise<SegmentCost[]> {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  // Fetch all segments with concurrency limit
  const results = await Promise.all(
    segments.map((segment) => apiLimit(() => fetchSingleSegment(segment))),
  );

  return results;
}

/**
 * Calculate walking segment cost for short distances (<= 700m)
 * - Walking speed: 4 km/h (??67m/??
 * - No API call required
 * - transitDetails ??釉?(筌왖?袁⑸퓠???袁⑤궖 野껋럥以덃에???뽯뻻??띾┛ ?袁る퉸)
 */
function calculateWalkingSegmentCostWithDetails(
  segment: SegmentRequest,
  distanceMeters: number,
): SegmentCost {
  const distanceKm = distanceMeters / 1000;

  // Walking: 4 km/h
  const durationMinutes = Math.round((distanceKm / 4) * 60);

  // Ensure minimum duration (1 minute)
  const finalDuration = Math.max(1, durationMinutes);

  return {
    key: segment.key,
    durationMinutes: finalDuration,
    distanceMeters,
    // TMap polyline ??곸뵠 筌욊낯苑??怨뚭퍙 (from-to ?ル슦紐닸에?筌왖?袁⑸퓠 ??뽯뻻)
    transitDetails: {
      totalFare: 0,
      transferCount: 0,
      walkingTime: finalDuration,
      walkingDistance: distanceMeters,
      subPaths: [
        {
          trafficType: 3, // ?袁⑤궖
          distance: distanceMeters,
          sectionTime: finalDuration,
          startCoord: segment.fromCoord,
          endCoord: segment.toCoord,
          // polyline ??곸벉 = 筌욊낯苑??怨뚭퍙
        },
      ],
    },
  };
}

/**
 * Calculate fallback segment cost when API fails (for distances > 700m)
 * - Public transit: 20 km/h average speed + 5 min overhead for waiting/transfers
 */
function fallbackSegmentCost(
  segment: SegmentRequest,
  distanceMeters: number,
): SegmentCost {
  const distanceKm = distanceMeters / 1000;

  // Public transit assumption: 20 km/h + 5 min overhead
  const travelTimeMinutes = (distanceKm / 20) * 60;
  const overheadMinutes = 5;
  const durationMinutes = Math.round(travelTimeMinutes + overheadMinutes);

  // Ensure minimum duration
  const finalDuration = Math.max(1, durationMinutes);

  return {
    key: segment.key,
    durationMinutes: finalDuration,
    distanceMeters,
    // transitDetails ??곸벉 = API ??쎈솭 ??fallback
  };
}


