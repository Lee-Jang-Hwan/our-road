// ============================================
// Public Transit Algorithm Entry
// ============================================

import type { TripInput, TripOutput, Waypoint, Cluster, LatLng } from "@/types";
import { preprocessWaypoints, determineTripMode } from "./preprocess";
import { zoneClustering } from "./clustering";
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

const PUBLIC_TRANSIT_DEBUG = process.env.PUBLIC_TRANSIT_DEBUG === "1";

function logPublicTransitDebug(message: string, data?: unknown): void {
  if (!PUBLIC_TRANSIT_DEBUG) return;
  if (data === undefined) {
    console.log(`[PublicTransit] ${message}`);
    return;
  }
  console.log(`[PublicTransit] ${message}`, data);
}

/**
 * ?좎쭨 臾몄옄?댁쓣 濡쒖뺄 ?좎쭨濡??뚯떛 (??꾩〈 臾몄젣 諛⑹?)
 * @param dateStr "YYYY-MM-DD" ?뺤떇???좎쭨 臾몄옄?? * @returns 濡쒖뺄 ??꾩〈 湲곗? Date 媛앹껜
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  // ?붿? 0遺???쒖옉?섎?濡?-1
  return new Date(year, month - 1, day);
}

/**
 * 怨좎젙 ?쇱젙???덈뒗 ?μ냼瑜??좎쭨蹂꾨줈 洹몃９?? * @param waypoints 紐⑤뱺 寃쎌쑀吏
 * @param tripStartDate ?ы뻾 ?쒖옉 ?좎쭨 (YYYY-MM-DD)
 * @returns dayIndex -> waypoint[] 留ㅽ븨
 */
function groupFixedWaypointsByDay(
  waypoints: Waypoint[],
  tripStartDate?: string
): Map<number, Waypoint[]> {
  const grouped = new Map<number, Waypoint[]>();

  if (!tripStartDate) {
    return grouped;
  }

  const startDate = parseLocalDate(tripStartDate);

  for (const wp of waypoints) {
    if (wp.isFixed && wp.fixedDate) {
      const fixedDate = parseLocalDate(wp.fixedDate);
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

function buildDayAnchors(
  input: TripInput
): Array<{ start?: LatLng; end?: LatLng }> {
  return Array.from({ length: input.days }, (_, index) => {
    const isFirst = index === 0;
    const isLast = index === input.days - 1;
    const start = isFirst ? input.start : input.lodging;
    const end = isLast ? input.end ?? input.lodging : input.lodging;
    return { start, end };
  });
}

function validateFixedWaypointAssignments(
  clusters: Cluster[],
  fixedByDay: Map<number, Waypoint[]>
): void {
  for (const [dayIndex, fixedWaypoints] of fixedByDay.entries()) {
    if (dayIndex >= clusters.length) {
      continue;
    }

    const cluster = clusters[dayIndex];
    const clusterWaypointIds = new Set(cluster.waypointIds);

    for (const fixedWp of fixedWaypoints) {
      // ?щ컮瑜??좎쭨???대윭?ㅽ꽣???덈뒗吏 ?뺤씤
      if (!clusterWaypointIds.has(fixedWp.id)) {
        console.warn(
          `[validateFixedWaypoints] Fixed waypoint ${fixedWp.id} is missing from day ${dayIndex + 1} cluster`
        );
      }

      // ?ㅻⅨ ?대윭?ㅽ꽣??以묐났?섏뼱 ?덈뒗吏 ?뺤씤
      for (let i = 0; i < clusters.length; i++) {
        if (i === dayIndex) continue;
        if (clusters[i].waypointIds.includes(fixedWp.id)) {
          console.warn(
            `[validateFixedWaypoints] Fixed waypoint ${fixedWp.id} is incorrectly assigned to both day ${dayIndex + 1} and day ${i + 1}`
          );
        }
      }
    }
  }
}

/**
 * ?대윭?ㅽ꽣??怨좎젙 ?쇱젙 ?μ냼瑜?媛뺤젣 諛곗젙
 * @param clusters ?대윭?ㅽ꽣 紐⑸줉
 * @param fixedByDay ?좎쭨蹂?怨좎젙 ?μ냼
 * @param waypoints ?꾩껜 寃쎌쑀吏 留? */
function assignFixedWaypointsToClusters(
  clusters: Cluster[],
  fixedByDay: Map<number, Waypoint[]>,
  waypoints: Waypoint[]
): void {
  // 癒쇱? 紐⑤뱺 怨좎젙 ?쇱젙 waypoint ID瑜??섏쭛
  const fixedWaypointIds = new Set<string>();
  for (const fixedWaypoints of fixedByDay.values()) {
    for (const fixedWp of fixedWaypoints) {
      fixedWaypointIds.add(fixedWp.id);
    }
  }

  // 紐⑤뱺 ?대윭?ㅽ꽣?먯꽌 怨좎젙 ?쇱젙 waypoint ?쒓굅 (?섎せ???대윭?ㅽ꽣??諛곗젙??寃??쒓굅)
  for (const cluster of clusters) {
    cluster.waypointIds = cluster.waypointIds.filter(
      (id) => !fixedWaypointIds.has(id)
    );
  }

  // ?щ컮瑜??좎쭨???대윭?ㅽ꽣??怨좎젙 ?쇱젙 異붽?
  for (const [dayIndex, fixedWaypoints] of fixedByDay.entries()) {
    if (dayIndex < clusters.length) {
      const cluster = clusters[dayIndex];
      
      // 怨좎젙 ?μ냼瑜??대윭?ㅽ꽣??異붽?
      for (const fixedWp of fixedWaypoints) {
        if (!cluster.waypointIds.includes(fixedWp.id)) {
          cluster.waypointIds.push(fixedWp.id);
        }
      }
      
      // centroid ?ш퀎??(waypointIds瑜??ъ슜?섏뿬 Waypoint 媛앹껜 李얘린)
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

  logPublicTransitDebug("input", {
    tripId: input.tripId,
    days: input.days,
    waypoints: waypoints.length,
    dailyMaxMinutes: input.dailyMaxMinutes ?? null,
    hasLodging: Boolean(input.lodging),
    hasDestination: Boolean(input.end),
  });

  const mode = determineTripMode(input.lodging, input.start, input.end);
  const waypointNameById = PUBLIC_TRANSIT_DEBUG
    ? new Map(waypoints.map((wp) => [wp.id, wp.name]))
    : null;

  // Calculate clustering parameters
  const targetPerDay = Math.ceil(waypoints.length / input.days);
  const fixedIds = waypoints.filter((wp) => wp.isFixed).map((wp) => wp.id);
  const fixedByDay = groupFixedWaypointsByDay(waypoints, input.tripStartDate);
  const dayAnchors = buildDayAnchors(input);

  // Perform clustering
  const clusters = zoneClustering({
    waypoints,
    N: input.days,
    targetPerDay,
    fixedIds,
    tripStartDate: input.tripStartDate,
    dailyMaxMinutes: input.dailyMaxMinutes,
    anchors: dayAnchors,
  });

  if (clusters.length === 0) {
    throw new Error("Clustering produced no valid clusters");
  }

  // ?대윭?ㅽ꽣??怨좎젙 ?쇱젙 媛뺤젣 諛곗젙
  if (PUBLIC_TRANSIT_DEBUG && waypointNameById) {
    logPublicTransitDebug(
      "clusters",
      clusters.map((cluster, index) => ({
        dayIndex: index + 1,
        waypointCount: cluster.waypointIds.length,
        waypointNames: cluster.waypointIds.map(
          (id) => waypointNameById.get(id) ?? id
        ),
      }))
    );
  }

  assignFixedWaypointsToClusters(clusters, fixedByDay, waypoints);

  // 寃利? 怨좎젙 ?쇱젙???щ컮瑜??좎쭨??諛곗젙?섏뿀?붿? ?뺤씤
  validateFixedWaypointAssignments(clusters, fixedByDay);

  // Order clusters with start position consideration
  const endAnchor = chooseEndAnchor(input.lodging, clusters);
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

  if (PUBLIC_TRANSIT_DEBUG && waypointNameById) {
    logPublicTransitDebug(
      "day plan order",
      dayPlans.map((plan) => ({
        dayIndex: plan.dayIndex,
        waypointOrder: plan.waypointOrder.map(
          (id) => waypointNameById.get(id) ?? id
        ),
      }))
    );
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





