// ============================================
// Outlier Detection for Inefficient Waypoints
// ============================================
//
// ⚠️ DEPRECATED: This file is no longer used in the algorithm
// All waypoints are now processed without outlier filtering
// Kept for reference only
//
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
 * Uses a two-stage approach to avoid centroid contamination:
 * 1. Pairwise distance analysis to identify potential outliers
 * 2. Centroid-based validation using only non-outlier waypoints
 *
 * @param clusters - The clusters after balancing
 * @param waypoints - Map of all waypoints
 * @returns Array of warnings for outlier waypoints
 */
export function detectOutliers(
  clusters: Cluster[],
  waypoints: Map<string, Waypoint>
): OutlierWarning[] {
  const warnings: OutlierWarning[] = [];

  console.log(`[detectOutliers] Checking ${clusters.length} clusters`);

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

        console.log(
          `[detectOutliers] Singleton outlier detected: ${wp.name} (${Math.round(nearestDistance / 1000)}km from nearest)`
        );

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

    // For clusters with 2+ waypoints, use TWO-STAGE approach
    // Stage 1: Pairwise distance analysis to identify outliers
    const pairwiseOutliers = new Set<string>();

    for (const wp of clusterWaypoints) {
      // Calculate distances to all other waypoints in the cluster
      const distancesToOthers = clusterWaypoints
        .filter((other) => other.id !== wp.id)
        .map((other) => calculateDistance(wp.coord, other.coord));

      // Find nearest and median distances
      const nearestDistance = Math.min(...distancesToOthers);
      distancesToOthers.sort((a, b) => a - b);
      const medianDistance =
        distancesToOthers.length % 2 === 0
          ? (distancesToOthers[distancesToOthers.length / 2 - 1] +
              distancesToOthers[distancesToOthers.length / 2]) /
            2
          : distancesToOthers[Math.floor(distancesToOthers.length / 2)];

      // Outlier criteria:
      // - Nearest waypoint is >20km away (very isolated)
      // - OR median distance to others is >50km (far from the group)
      if (nearestDistance > 20000 || medianDistance > 50000) {
        pairwiseOutliers.add(wp.id);
        console.log(
          `[detectOutliers] Pairwise outlier detected: ${wp.name} (nearest: ${Math.round(nearestDistance / 1000)}km, median: ${Math.round(medianDistance / 1000)}km)`
        );
      }
    }

    // Stage 2: Centroid-based validation (excluding pairwise outliers)
    const nonOutlierWaypoints = clusterWaypoints.filter(
      (wp) => !pairwiseOutliers.has(wp.id)
    );

    // If all waypoints were marked as outliers, revert to using all
    // (This prevents false positives when all waypoints are far apart)
    const waypointsForCentroid =
      nonOutlierWaypoints.length > 0 ? nonOutlierWaypoints : clusterWaypoints;

    const clusterCentroid = calculateCentroid(
      waypointsForCentroid.map((wp) => wp.coord)
    );
    const centroidDistances = waypointsForCentroid.map((wp) =>
      calculateDistance(wp.coord, clusterCentroid)
    );
    const avgCentroidDistance =
      centroidDistances.reduce((sum, d) => sum + d, 0) / centroidDistances.length;

    console.log(
      `[detectOutliers] Cluster ${i}: ${clusterWaypoints.length} waypoints, ${pairwiseOutliers.size} pairwise outliers, avg centroid distance: ${Math.round(avgCentroidDistance / 1000)}km`
    );

    // Validate and create warnings
    for (const wp of clusterWaypoints) {
      const isPairwiseOutlier = pairwiseOutliers.has(wp.id);

      if (isPairwiseOutlier) {
        // Calculate distances for the warning
        const distanceFromCenter = calculateDistance(wp.coord, clusterCentroid);
        const nearestDistance = Math.min(
          ...clusterWaypoints
            .filter((other) => other.id !== wp.id)
            .map((other) => calculateDistance(wp.coord, other.coord))
        );

        const estimatedExtraTime = Math.round((distanceFromCenter / 1000 / 20) * 60) + 10;

        warnings.push({
          waypointId: wp.id,
          waypointName: wp.name,
          reason: nearestDistance > 20000 ? "isolated" : "far_from_cluster",
          clusterIndex: i,
          distanceFromClusterCenter: distanceFromCenter,
          distanceFromNearestWaypoint: nearestDistance,
          estimatedExtraTime,
        });
      }
    }
  }

  console.log(`[detectOutliers] Total warnings: ${warnings.length}`);

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
