// ============================================
// Complexity-based Removal (Optional)
// ============================================

import type { DayPlan, Waypoint } from "@/types";
import { calculateDistance } from "../utils/geo";
import { calculateBacktracking, calculateCrossing } from "../utils/route-analysis";

const MINUTES_PER_KM = 5;
const WEIGHTS = {
  ALPHA_BACKTRACKING: 2.0,
  BETA_CROSSING: 1.0,
  GAMMA_TIME: 1.0,
  DELTA_DISTANCE: 0.5,
  EPSILON_IMPORTANCE: 2.0,
  ZETA_STAYTIME: 1.0,
};

export function exceedsDailyLimitProxy(
  dayPlans: DayPlan[],
  dailyMaxMinutes: number,
  waypoints: Map<string, Waypoint>
): boolean {
  if (!Array.isArray(dayPlans) || dayPlans.length === 0) {
    return false;
  }

  if (!Number.isFinite(dailyMaxMinutes) || dailyMaxMinutes <= 0) {
    return false;
  }

  return dayPlans.some((dayPlan) => {
    if (!dayPlan || !Array.isArray(dayPlan.waypointOrder)) {
      return false;
    }

    const route = dayPlan.waypointOrder;
    if (route.length < 2) {
      return false;
    }

    let distanceMeters = 0;
    let validSegments = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const from = waypoints.get(route[i]);
      const to = waypoints.get(route[i + 1]);
      if (!from || !to) continue;

      try {
        distanceMeters += calculateDistance(from.coord, to.coord);
        validSegments++;
      } catch (error) {
        console.warn(
          `[exceedsDailyLimitProxy] Error calculating distance between ${route[i]} and ${route[i + 1]}:`,
          error
        );
      }
    }

    if (validSegments === 0) {
      return false;
    }

    const distanceKm = distanceMeters / 1000;
    const estimatedMinutes = distanceKm * MINUTES_PER_KM;
    return estimatedMinutes > dailyMaxMinutes;
  });
}

export function calculateComplexityImpact(
  waypoint: Waypoint,
  currentRoute: string[],
  waypoints: Map<string, Waypoint>
): number {
  const index = currentRoute.indexOf(waypoint.id);
  if (index < 0) {
    return 0;
  }

  const backtrackingDelta = calculateBacktrackingDelta(
    currentRoute,
    waypoint.id,
    waypoints
  );
  const crossingDelta = calculateCrossingDelta(
    currentRoute,
    waypoint.id,
    waypoints
  );

  const deltaDistanceMeters = calculateDeltaDistanceMeters(
    currentRoute,
    index,
    waypoints
  );
  const deltaDistanceKm = deltaDistanceMeters / 1000;
  const deltaTimeMinutes = deltaDistanceKm * MINUTES_PER_KM;

  return (
    WEIGHTS.ALPHA_BACKTRACKING * backtrackingDelta +
    WEIGHTS.BETA_CROSSING * crossingDelta +
    WEIGHTS.GAMMA_TIME * deltaTimeMinutes +
    WEIGHTS.DELTA_DISTANCE * deltaDistanceKm -
    WEIGHTS.EPSILON_IMPORTANCE * getImportance(waypoint) -
    WEIGHTS.ZETA_STAYTIME * getStayMinutes(waypoint)
  );
}

export function selectWorstComplexityPoint(
  dayPlans: DayPlan[],
  fixedIds: string[],
  waypoints: Map<string, Waypoint>
): string | null {
  let worstId: string | null = null;
  let worstScore = -Infinity;

  for (const dayPlan of dayPlans) {
    for (const waypointId of dayPlan.waypointOrder) {
      if (fixedIds.includes(waypointId)) continue;
      const waypoint = waypoints.get(waypointId);
      if (!waypoint) continue;
      if (waypoint.dayLock) continue;

      const score = calculateComplexityImpact(
        waypoint,
        dayPlan.waypointOrder,
        waypoints
      );
      if (score > worstScore) {
        worstScore = score;
        worstId = waypointId;
      }
    }
  }

  return worstId;
}

export function removeWaypoint(dayPlans: DayPlan[], waypointId: string): void {
  for (const dayPlan of dayPlans) {
    if (!dayPlan.waypointOrder.includes(waypointId)) continue;
    dayPlan.waypointOrder = dayPlan.waypointOrder.filter(
      (id) => id !== waypointId
    );
    if (!dayPlan.excludedWaypointIds.includes(waypointId)) {
      dayPlan.excludedWaypointIds.push(waypointId);
    }
    return;
  }
}

function calculateBacktrackingDelta(
  route: string[],
  waypointId: string,
  waypoints: Map<string, Waypoint>
): number {
  const withPoint = calculateBacktracking(route, waypoints);
  const routeWithout = route.filter((id) => id !== waypointId);
  const withoutPoint = calculateBacktracking(routeWithout, waypoints);
  return withPoint - withoutPoint;
}

function calculateCrossingDelta(
  route: string[],
  waypointId: string,
  waypoints: Map<string, Waypoint>
): number {
  const withPoint = calculateCrossing(route, waypoints);
  const routeWithout = route.filter((id) => id !== waypointId);
  const withoutPoint = calculateCrossing(routeWithout, waypoints);
  return withPoint - withoutPoint;
}

function calculateDeltaDistanceMeters(
  route: string[],
  index: number,
  waypoints: Map<string, Waypoint>
): number {
  if (index < 0 || index >= route.length) {
    return 0;
  }

  const currentId = route[index];
  const prevId = route[index - 1];
  const nextId = route[index + 1];

  const current = currentId ? waypoints.get(currentId) : undefined;
  const prev = prevId ? waypoints.get(prevId) : undefined;
  const next = nextId ? waypoints.get(nextId) : undefined;

  if (!current) {
    return 0;
  }

  try {
    if (prev && next) {
      const include =
        calculateDistance(prev.coord, current.coord) +
        calculateDistance(current.coord, next.coord);
      const exclude = calculateDistance(prev.coord, next.coord);
      return Math.max(0, include - exclude);
    }

    if (prev) {
      return calculateDistance(prev.coord, current.coord);
    }

    if (next) {
      return calculateDistance(current.coord, next.coord);
    }
  } catch (error) {
    console.warn(
      `[calculateDeltaDistanceMeters] Error calculating distance delta for waypoint ${currentId}:`,
      error
    );
    return 0;
  }

  return 0;
}

function getImportance(waypoint: Waypoint): number {
  return waypoint.importance ?? 1;
}

function getStayMinutes(waypoint: Waypoint): number {
  return waypoint.stayMinutes ?? 0;
}
