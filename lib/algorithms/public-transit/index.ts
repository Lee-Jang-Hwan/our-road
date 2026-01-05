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

  // Order clusters
  const endAnchor = chooseEndAnchor(input.lodging, clusters, input.days);
  const orderedClusters = orderClustersOneDirection(clusters, endAnchor);

  // Build waypoint map
  const waypointMap = new Map<string, Waypoint>();
  waypoints.forEach((wp) => waypointMap.set(wp.id, wp));

  // Generate day plans
  const dayPlans = generateDayPlans(
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

  const segments = extractSegments(
    dayPlans,
    waypointMap,
    input.start,
    input.end,
    input.lodging
  );
  const segmentCosts = await callRoutingAPIForSegments(segments);

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
