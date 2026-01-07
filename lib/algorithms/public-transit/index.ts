// ============================================
// Public Transit Algorithm Entry
// ============================================

import type { TripInput, TripOutput, Waypoint } from "@/types";
import { preprocessWaypoints, determineTripMode } from "./preprocess";
import { balancedClustering } from "./clustering";
import { chooseEndAnchor, orderClustersOneDirection } from "./cluster-ordering";
import { generateDayPlans } from "./day-plan";
import {
  exceedsDailyLimitProxy,
  selectWorstComplexityPoint,
  removeWaypoint,
  calculateActualDailyTimes,
  identifyOverloadedDays,
  selectWaypointsToRemoveFromDay,
} from "./complexity-removal";
import { extractSegments, callRoutingAPIForSegments } from "./api-caller";
import { detectAnomalousSegments, applyLocalFixes } from "./anomaly-detection";
import { buildOutput } from "./output-builder";

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

  console.log(`[generatePublicTransitRoute] Initial API calls: ${segments.length} segments`);

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
        console.log(`[generatePublicTransitRoute] All days within time limit after ${roundCount} rounds`);
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

      console.log(
        `[generatePublicTransitRoute] Round ${roundCount + 1}: Removing ${toRemove.length} waypoints from day ${mostOverloaded.dayIndex + 1}`
      );

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

      console.log(
        `[generatePublicTransitRoute] Round ${roundCount + 1}: ${uncachedSegments.length} new segments to call API (${newSegments.length} total segments)`
      );

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

  const warnings = detectAnomalousSegments(segmentCosts);
  if (warnings.length > 0) {
    applyLocalFixes(dayPlans, warnings);
  }

  return buildOutput({
    tripId: input.tripId,
    mode,
    clusters: orderedClusters,
    dayPlans,
    segmentCosts,
  });
}
