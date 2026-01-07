// ============================================
// Outlier Detection for Inefficient Waypoints
// ============================================

import type { Cluster, Waypoint } from "@/types";
import { calculateDistance, calculateCentroid } from "../utils/geo";

export interface OutlierWarning {
  waypointId: string;
  waypointName: string;
  reason: "isolated" | "far_from_cluster" | "creates_long_detour";
  clusterIndex: number;
  distanceFromClusterCenter: number;
  distanceFromNearestWaypoint: number;
  estimatedExtraTime?: number; // minutes
}

/**
 * Detect waypoints that are outliers and may cause inefficient routes
 * @param clusters - The clusters after balancing
 * @param waypoints - Map of all waypoints
 * @returns Array of warnings for outlier waypoints
 */
export function detectOutliers(
  clusters: Cluster[],
  waypoints: Map<string, Waypoint>
): OutlierWarning[] {
  const warnings: OutlierWarning[] = [];

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];

    const clusterWaypoints = cluster.waypointIds
      .map((id) => waypoints.get(id))
      .filter((wp): wp is Waypoint => Boolean(wp));

    // Skip empty clusters
    if (clusterWaypoints.length === 0) {
      continue;
    }

    // For clusters with only 1 waypoint, check distance to other clusters
    if (clusterWaypoints.length === 1) {
      const wp = clusterWaypoints[0];

      // Find nearest waypoint in OTHER clusters
      const otherClusterWaypoints = clusters
        .filter((_, idx) => idx !== i)
        .flatMap((c) => c.waypointIds.map((id) => waypoints.get(id)))
        .filter((w): w is Waypoint => Boolean(w));

      if (otherClusterWaypoints.length === 0) {
        continue; // Only one cluster total
      }

      const nearestDistance = Math.min(
        ...otherClusterWaypoints.map((other) =>
          calculateDistance(wp.coord, other.coord)
        )
      );

      // If singleton is >10km from nearest waypoint in other clusters
      if (nearestDistance > 10000) {
        const estimatedExtraTime = Math.round((nearestDistance / 1000 / 20) * 60) + 15;

        warnings.push({
          waypointId: wp.id,
          waypointName: wp.name,
          reason: "isolated",
          clusterIndex: i,
          distanceFromClusterCenter: 0,
          distanceFromNearestWaypoint: nearestDistance,
          estimatedExtraTime,
        });
      }
      continue;
    }

    // For clusters with 2+ waypoints, use statistical approach
    const clusterCentroid = calculateCentroid(clusterWaypoints.map((wp) => wp.coord));
    const distances = clusterWaypoints.map((wp) =>
      calculateDistance(wp.coord, clusterCentroid)
    );
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    // Threshold: 2.5x average distance from centroid
    const outlierThreshold = avgDistance * 2.5;

    for (const wp of clusterWaypoints) {
      const distanceFromCenter = calculateDistance(wp.coord, clusterCentroid);

      // Check if this waypoint is too far from cluster center
      if (distanceFromCenter > outlierThreshold && distanceFromCenter > 3000) {
        // >3km and >2.5x avg
        // Find nearest waypoint in the same cluster
        const nearestDistance = Math.min(
          ...clusterWaypoints
            .filter((other) => other.id !== wp.id)
            .map((other) => calculateDistance(wp.coord, other.coord))
        );

        // Estimate extra time (assume 20 km/h average speed + overhead)
        const estimatedExtraTime = Math.round((distanceFromCenter / 1000 / 20) * 60) + 10;

        warnings.push({
          waypointId: wp.id,
          waypointName: wp.name,
          reason: nearestDistance > 5000 ? "isolated" : "far_from_cluster",
          clusterIndex: i,
          distanceFromClusterCenter: distanceFromCenter,
          distanceFromNearestWaypoint: nearestDistance,
          estimatedExtraTime,
        });
      }
    }
  }

  return warnings;
}

/**
 * Calculate cluster quality score (0-1, higher is better)
 * Used for flexible balancing
 */
export function calculateClusterQuality(
  cluster: Cluster,
  waypoints: Map<string, Waypoint>
): number {
  const clusterWaypoints = cluster.waypointIds
    .map((id) => waypoints.get(id))
    .filter((wp): wp is Waypoint => Boolean(wp));

  if (clusterWaypoints.length <= 1) {
    return 1.0; // Single waypoint cluster is perfectly cohesive
  }

  // Calculate cohesion (average distance from centroid, lower is better)
  const centroid = cluster.centroid;
  const distances = clusterWaypoints.map((wp) =>
    calculateDistance(wp.coord, centroid)
  );
  const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const maxDistance = Math.max(...distances);

  // Cohesion score: penalize if max distance is too far from average
  const cohesionScore = maxDistance > 0 ? Math.min(1, avgDistance / maxDistance) : 1;

  // Uniformity score: penalize if distances vary too much (std dev)
  const variance =
    distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) /
    distances.length;
  const stdDev = Math.sqrt(variance);
  const uniformityScore = avgDistance > 0 ? Math.max(0, 1 - stdDev / avgDistance) : 1;

  // Combined quality score
  return cohesionScore * 0.6 + uniformityScore * 0.4;
}
