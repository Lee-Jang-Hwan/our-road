// ============================================
// Within Cluster Ordering
// ============================================

import type { Cluster, Waypoint, LatLng } from "@/types";
import { calculateDirectionVector, calculateDistance, projectOntoAxis } from "../utils/geo";
import { doSegmentsIntersect } from "../utils/route-analysis";

export function calculateAxis(centroid: LatLng, endAnchor: LatLng) {
  return calculateDirectionVector(centroid, endAnchor);
}

export function orderWithinClusterOneDirection(params: {
  cluster: Cluster;
  endAnchor: LatLng;
  waypoints: Map<string, Waypoint>;
}): string[] {
  const { cluster, endAnchor, waypoints } = params;
  const waypointList = cluster.waypointIds
    .map((id) => waypoints.get(id))
    .filter((wp): wp is Waypoint => Boolean(wp));

  if (waypointList.length <= 1) {
    return waypointList.map((wp) => wp.id);
  }

  const axis = calculateAxis(cluster.centroid, endAnchor);

  const projected = waypointList.map((wp) => ({
    id: wp.id,
    projection: projectOntoAxis(wp.coord, axis),
    distanceToEnd: calculateDistance(wp.coord, endAnchor),
  }));

  const EPS = 1e-6;
  projected.sort((a, b) => {
    if (Math.abs(a.projection - b.projection) < EPS) {
      return b.distanceToEnd - a.distanceToEnd;
    }
    return a.projection - b.projection;
  });

  const orderedIds = projected.map((item) => item.id);
  return minimize2OptCrossing(orderedIds, waypoints);
}

export function minimize2OptCrossing(
  order: string[],
  waypoints: Map<string, Waypoint>
): string[] {
  const route = [...order];
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations += 1;

    for (let i = 0; i < route.length - 3; i++) {
      for (let j = i + 2; j < route.length - 1; j++) {
        const a1 = waypoints.get(route[i]);
        const a2 = waypoints.get(route[i + 1]);
        const b1 = waypoints.get(route[j]);
        const b2 = waypoints.get(route[j + 1]);

        if (!a1 || !a2 || !b1 || !b2) continue;
        if (doSegmentsIntersect(a1.coord, a2.coord, b1.coord, b2.coord)) {
          const reversed = route
            .slice(i + 1, j + 1)
            .reverse();
          route.splice(i + 1, j - i, ...reversed);
          improved = true;
        }
      }
    }
  }

  return route;
}
