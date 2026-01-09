// ============================================
// Balanced Clustering (Public Transit Algorithm)
// ============================================

import type { Cluster, Waypoint } from "@/types";
import { calculateCentroid, calculateDistance } from "../utils/geo";

interface ClusterBuilder {
  seed: Waypoint;
  waypoints: Waypoint[];
}

export function selectDistributedSeeds(
  waypoints: Waypoint[],
  k: number
): Waypoint[] {
  if (waypoints.length === 0 || k <= 0) {
    return [];
  }

  const centroid = calculateCentroid(waypoints.map((wp) => wp.coord));
  const seeds: Waypoint[] = [];

  const first = [...waypoints].sort(
    (a, b) =>
      calculateDistance(b.coord, centroid) -
      calculateDistance(a.coord, centroid)
  )[0];
  seeds.push(first);

  while (seeds.length < k) {
    let nextSeed: Waypoint | null = null;
    let maxDistance = -Infinity;

    for (const waypoint of waypoints) {
      const nearestDistance = Math.min(
        ...seeds.map((seed) => calculateDistance(seed.coord, waypoint.coord))
      );

      if (nearestDistance > maxDistance) {
        maxDistance = nearestDistance;
        nextSeed = waypoint;
      }
    }

    if (!nextSeed) break;
    if (!seeds.find((seed) => seed.id === nextSeed.id)) {
      seeds.push(nextSeed);
    } else {
      break;
    }
  }

  return seeds.slice(0, k);
}

export function initializeClusters(seeds: Waypoint[]): ClusterBuilder[] {
  return seeds.map((seed) => ({
    seed,
    waypoints: [seed],
  }));
}

export function findNearestCluster(
  clusters: ClusterBuilder[],
  waypoint: Waypoint,
  maxCapacity: number
): ClusterBuilder {
  let nearest: ClusterBuilder | null = null;
  let nearestDistance = Infinity;

  for (const cluster of clusters) {
    if (cluster.waypoints.length >= maxCapacity) {
      continue;
    }
    const distance = calculateDistance(cluster.seed.coord, waypoint.coord);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = cluster;
    }
  }

  if (nearest) {
    return nearest;
  }

  return clusters.reduce((best, cluster) => {
    const distance = calculateDistance(cluster.seed.coord, waypoint.coord);
    if (!best) return cluster;
    const bestDistance = calculateDistance(best.seed.coord, waypoint.coord);
    return distance < bestDistance ? cluster : best;
  }, clusters[0]);
}

export function balanceClusterSizes(
  clusters: ClusterBuilder[],
  targetPerDay: number
): void {
  const maxIterations = 100;
  const flexibilityRange = 0.4; // Allow ±40% from target

  const minSize = Math.max(1, Math.floor(targetPerDay * (1 - flexibilityRange)));
  const maxSize = Math.ceil(targetPerDay * (1 + flexibilityRange));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    clusters.sort((a, b) => b.waypoints.length - a.waypoints.length);

    const largest = clusters[0];
    const smallest = clusters[clusters.length - 1];

    const sizeDiff = largest.waypoints.length - smallest.waypoints.length;

    // Stop if balanced enough OR largest is within acceptable range
    if (sizeDiff <= 1 || largest.waypoints.length <= maxSize) {
      break;
    }

    // Only force balancing if largest exceeds max threshold significantly
    if (largest.waypoints.length <= maxSize + 1) {
      break;
    }

    const smallestCentroid = calculateCentroid(
      smallest.waypoints.map((wp) => wp.coord)
    );

    // Find movable waypoints (not seed, not fixed, not dayLocked)
    const movableWaypoints = largest.waypoints.filter(
      (wp) => wp.id !== largest.seed.id && !wp.isFixed && !wp.dayLock
    );

    if (movableWaypoints.length === 0) {
      break;
    }

    const candidate = movableWaypoints
      .map((wp) => ({
        wp,
        distance: calculateDistance(wp.coord, smallestCentroid),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (!candidate) {
      break;
    }

    // Only move if it doesn't create a huge detour
    const largestCentroid = calculateCentroid(largest.waypoints.map((wp) => wp.coord));
    const distanceFromLargest = calculateDistance(candidate.wp.coord, largestCentroid);

    // Don't move if it's >3x closer to current cluster
    if (candidate.distance > distanceFromLargest * 3) {
      break;
    }

    largest.waypoints = largest.waypoints.filter(
      (wp) => wp.id !== candidate.wp.id
    );
    smallest.waypoints.push(candidate.wp);
  }
}

export function ensureFixedWaypointsIncluded(
  clusters: ClusterBuilder[],
  fixedIds: string[],
  allWaypoints: Waypoint[]
): void {
  const assignedIds = new Set(
    clusters.flatMap((cluster) => cluster.waypoints.map((wp) => wp.id))
  );

  for (const fixedId of fixedIds) {
    if (assignedIds.has(fixedId)) continue;

    // Find from original waypoints, not from already assigned ones
    const fixedWaypoint = allWaypoints.find((wp) => wp.id === fixedId);
    if (!fixedWaypoint) continue;

    const target = findNearestCluster(clusters, fixedWaypoint, Infinity);
    target.waypoints.push(fixedWaypoint);
    assignedIds.add(fixedId);
  }
}

export function balancedClustering(params: {
  waypoints: Waypoint[];
  N: number;
  targetPerDay: number;
  fixedIds: string[];
}): Cluster[] {
  const { waypoints, N, targetPerDay, fixedIds } = params;

  if (waypoints.length === 0) {
    throw new Error("Cannot cluster empty waypoints");
  }

  if (N <= 0) {
    throw new Error("Number of days must be positive");
  }

  const actualDays = Math.min(N, waypoints.length);
  const seeds = selectDistributedSeeds(waypoints, actualDays);

  if (seeds.length === 0) {
    throw new Error("Failed to select seeds for clustering");
  }

  const clusters = initializeClusters(seeds);

  // Assign waypoints to clusters
  for (const waypoint of waypoints) {
    if (seeds.find((seed) => seed.id === waypoint.id)) {
      continue;
    }
    const nearest = findNearestCluster(clusters, waypoint, targetPerDay);
    nearest.waypoints.push(waypoint);
  }

  balanceClusterSizes(clusters, targetPerDay);
  ensureFixedWaypointsIncluded(clusters, fixedIds, waypoints);

  // Filter out empty clusters
  const nonEmptyClusters = clusters.filter((c) => c.waypoints.length > 0);

  if (nonEmptyClusters.length === 0) {
    throw new Error("All clusters are empty after balancing");
  }

  return nonEmptyClusters.map((cluster, index) => ({
    clusterId: `cluster-${index + 1}`,
    dayIndex: index + 1,
    waypointIds: cluster.waypoints.map((wp) => wp.id),
    centroid: calculateCentroid(cluster.waypoints.map((wp) => wp.coord)),
  }));
}
