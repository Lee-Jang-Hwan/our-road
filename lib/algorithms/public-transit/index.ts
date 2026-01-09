// ============================================
// Public Transit Algorithm Entry
// ============================================

import type { TripInput, TripOutput, Waypoint, Cluster } from "@/types";
import { preprocessWaypoints, determineTripMode } from "./preprocess";
import { balancedClustering } from "./clustering";
import { chooseEndAnchor, orderClustersOneDirection } from "./cluster-ordering";
import { generateDayPlans } from "./day-plan";
import { calculateCentroid } from "../utils/geo";
import {
  exceedsDailyLimitProxy,
  selectWorstComplexityPoint,
  removeWaypoint,
  calculateActualDailyTimes,
  identifyOverloadedDays,
  selectWaypointsToRemoveFromDay,
} from "./complexity-removal";
import { extractSegments, callRoutingAPIForSegments } from "./api-caller";
import { buildOutput } from "./output-builder";

/**
 * 고정 일정이 있는 장소를 날짜별로 그룹화
 * @param waypoints 모든 경유지
 * @param tripStartDate 여행 시작 날짜 (YYYY-MM-DD)
 * @returns dayIndex -> waypoint[] 매핑
 */
function groupFixedWaypointsByDay(
  waypoints: Waypoint[],
  tripStartDate?: string
): Map<number, Waypoint[]> {
  const grouped = new Map<number, Waypoint[]>();
  
  if (!tripStartDate) {
    return grouped;
  }

  const startDate = new Date(tripStartDate);
  
  for (const wp of waypoints) {
    if (wp.isFixed && wp.fixedDate) {
      const fixedDate = new Date(wp.fixedDate);
      // 날짜 차이 계산 (일 단위)
      const dayIndex = Math.floor(
        (fixedDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (dayIndex >= 0) {
        if (!grouped.has(dayIndex)) {
          grouped.set(dayIndex, []);
        }
        grouped.get(dayIndex)!.push(wp);
      }
    }
  }
  
  return grouped;
}

/**
 * 클러스터에 고정 일정 장소를 강제 배정
 * @param clusters 클러스터 목록
 * @param fixedByDay 날짜별 고정 장소
 * @param waypoints 전체 경유지 맵
 */
function assignFixedWaypointsToClusters(
  clusters: Cluster[],
  fixedByDay: Map<number, Waypoint[]>,
  waypoints: Waypoint[]
): void {
  for (const [dayIndex, fixedWaypoints] of fixedByDay.entries()) {
    if (dayIndex < clusters.length) {
      const cluster = clusters[dayIndex];
      
      // 고정 장소를 클러스터에 추가 (중복 제거)
      for (const fixedWp of fixedWaypoints) {
        const exists = cluster.waypointIds.includes(fixedWp.id);
        if (!exists) {
          cluster.waypointIds.push(fixedWp.id);
        }
      }
      
      // centroid 재계산 (waypointIds를 사용하여 Waypoint 객체 찾기)
      const clusterWaypoints = cluster.waypointIds
        .map((id) => waypoints.find((wp) => wp.id === id))
        .filter((wp): wp is Waypoint => wp !== undefined);
      
      if (clusterWaypoints.length > 0) {
        cluster.centroid = calculateCentroid(clusterWaypoints.map((wp) => wp.coord));
      }
    } else {
      console.warn(
        `[assignFixedWaypoints] Fixed waypoint for day ${dayIndex + 1} exceeds trip duration`
      );
    }
  }
}

export async function generatePublicTransitRoute(
  input: TripInput
): Promise<TripOutput> {
  // Validate input
  if (!input || typeof input !== "object") {
    throw new Error("Invalid input: must be a TripInput object");
  }

  if (!input.tripId || typeof input.tripId !== "string") {
    throw new Error("Invalid input: tripId is required");
  }

  if (!Number.isFinite(input.days) || input.days <= 0) {
    throw new Error("Invalid input: days must be a positive number");
  }

  if (!input.start || !input.start.lat || !input.start.lng) {
    throw new Error("Invalid input: start coordinate is required");
  }

  if (!Array.isArray(input.waypoints) || input.waypoints.length === 0) {
    throw new Error("Invalid input: waypoints array is required and must not be empty");
  }

  // Preprocess waypoints
  const waypoints = preprocessWaypoints(input.waypoints);

  if (waypoints.length === 0) {
    throw new Error("No valid waypoints after preprocessing");
  }

  const mode = determineTripMode(input.lodging, input.start, input.end);

  // Calculate clustering parameters
  const targetPerDay = Math.ceil(waypoints.length / input.days);
  const fixedIds = waypoints.filter((wp) => wp.isFixed).map((wp) => wp.id);

  // 고정 일정을 날짜별로 그룹화
  const fixedByDay = groupFixedWaypointsByDay(waypoints, input.tripStartDate);

  // Perform clustering
  const clusters = balancedClustering({
    waypoints,
    N: input.days,
    targetPerDay,
    fixedIds,
  });

  if (clusters.length === 0) {
    throw new Error("Clustering produced no valid clusters");
  }

  // 클러스터에 고정 일정 강제 배정
  assignFixedWaypointsToClusters(clusters, fixedByDay, waypoints);

  // Order clusters with start position consideration
  const endAnchor = chooseEndAnchor(input.lodging, clusters, input.days);
  const orderedClusters = orderClustersOneDirection(clusters, endAnchor, input.start);

  // Build waypoint map
  const waypointMap = new Map<string, Waypoint>();
  waypoints.forEach((wp) => waypointMap.set(wp.id, wp));

  // Generate day plans (parallel within-cluster ordering)
  const dayPlans = await generateDayPlans(
    orderedClusters,
    waypointMap,
    endAnchor,
    input
  );

  if (dayPlans.length === 0) {
    throw new Error("Failed to generate day plans");
  }

  // Complexity-based removal with safeguards
  if (input.dailyMaxMinutes) {
    const maxRemovalIterations = Math.floor(waypoints.length * 0.5); // Remove max 50% of waypoints
    let removalCount = 0;

    while (
      exceedsDailyLimitProxy(dayPlans, input.dailyMaxMinutes, waypointMap) &&
      removalCount < maxRemovalIterations
    ) {
      const worstPoint = selectWorstComplexityPoint(
        dayPlans,
        fixedIds,
        waypointMap
      );
      if (!worstPoint) {
        // No removable waypoints left
        console.warn(
          "[generatePublicTransitRoute] Cannot meet daily time limit: no removable waypoints"
        );
        break;
      }
      removeWaypoint(dayPlans, worstPoint);
      removalCount++;
    }

    if (removalCount >= maxRemovalIterations) {
      console.warn(
        `[generatePublicTransitRoute] Reached max removal limit (${maxRemovalIterations}). Daily time limit may not be met.`
      );
    }
  }

  let segments = extractSegments(
    dayPlans,
    waypointMap,
    input.start,
    input.end,
    input.lodging
  );
  let segmentCosts = await callRoutingAPIForSegments(segments);

  // API-based time optimization (Phase 2)
  if (input.dailyMaxMinutes) {
    const maxReoptimizationRounds = 3;
    let roundCount = 0;

    // Segment cache to avoid duplicate API calls
    const segmentCache = new Map(
      segmentCosts.map((c) => [`${c.key.fromId}:${c.key.toId}`, c])
    );

    while (roundCount < maxReoptimizationRounds) {
      const dayTimeInfos = calculateActualDailyTimes(
        dayPlans,
        segmentCosts,
        waypointMap
      );
      const overloadedDays = identifyOverloadedDays(
        dayTimeInfos,
        input.dailyMaxMinutes
      );

      if (overloadedDays.length === 0) {
        // All days are within limit
        break;
      }

      // Select and remove waypoints from the most overloaded day
      const mostOverloaded = overloadedDays[0];
      const dayPlan = dayPlans[mostOverloaded.dayIndex];

      const toRemove = selectWaypointsToRemoveFromDay(
        dayPlan,
        mostOverloaded.exceedMinutes,
        fixedIds,
        waypointMap,
        segmentCosts
      );

      if (toRemove.length === 0) {
        console.warn(
          `[generatePublicTransitRoute] Cannot reduce time for day ${mostOverloaded.dayIndex}: no removable waypoints`
        );
        break;
      }

      // Remove waypoints
      for (const waypointId of toRemove) {
        removeWaypoint(dayPlans, waypointId);
      }

      // Recalculate segments
      const newSegments = extractSegments(
        dayPlans,
        waypointMap,
        input.start,
        input.end,
        input.lodging
      );

      // Only call API for segments NOT in cache
      const uncachedSegments = newSegments.filter((seg) => {
        const key = `${seg.key.fromId}:${seg.key.toId}`;
        return !segmentCache.has(key);
      });

      if (uncachedSegments.length > 0) {
        const newCosts = await callRoutingAPIForSegments(uncachedSegments);

        // Add new costs to cache
        for (const cost of newCosts) {
          const key = `${cost.key.fromId}:${cost.key.toId}`;
          segmentCache.set(key, cost);
        }
      }

      // Build segmentCosts from current segments using cache
      segmentCosts = newSegments
        .map((seg) => {
          const key = `${seg.key.fromId}:${seg.key.toId}`;
          return segmentCache.get(key);
        })
        .filter((cost): cost is NonNullable<typeof cost> => cost !== undefined);

      // Update segments reference for next iteration
      segments = newSegments;

      roundCount++;
    }

    if (roundCount >= maxReoptimizationRounds) {
      console.warn(
        `[generatePublicTransitRoute] Reached max reoptimization rounds (${maxReoptimizationRounds}). Some days may still exceed time limit.`
      );
    }
  }

  return buildOutput({
    tripId: input.tripId,
    mode,
    clusters: orderedClusters,
    dayPlans,
    segmentCosts,
  });
}
