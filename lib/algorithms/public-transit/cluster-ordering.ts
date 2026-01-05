// ============================================
// Cluster Ordering (Public Transit Algorithm)
// ============================================

import type { Cluster, LatLng, TripInput } from "@/types";
import { calculateCentroid, calculateDistance, calculateDirectionVector, dotProduct } from "../utils/geo";

export function chooseEndAnchor(
  lodging: LatLng | undefined,
  clusters: Cluster[],
  _days: number
): LatLng {
  if (lodging) {
    return lodging;
  }

  if (!Array.isArray(clusters) || clusters.length === 0) {
    throw new Error("Cannot choose end anchor from empty clusters");
  }

  const centroids = clusters.map((cluster) => cluster.centroid);
  const average = calculateCentroid(centroids);

  const farthest = centroids.sort(
    (a, b) => calculateDistance(b, average) - calculateDistance(a, average)
  )[0];

  if (!farthest) {
    throw new Error("Failed to determine end anchor");
  }

  return farthest;
}

export function resolveDayEndAnchor(params: {
  dayIndex: number;
  orderedClusters: Cluster[];
  endAnchor: LatLng;
  input: TripInput;
}): LatLng {
  const { dayIndex, orderedClusters, endAnchor, input } = params;
  const lastIndex = orderedClusters.length - 1;

  if (input.lodging) {
    return input.lodging;
  }

  if (dayIndex === lastIndex) {
    if (input.end) {
      return input.end;
    }
    return input.start ?? endAnchor;
  }

  return orderedClusters[dayIndex + 1]?.centroid ?? endAnchor;
}

export function orderClustersOneDirection(
  clusters: Cluster[],
  endAnchor: LatLng
): Cluster[] {
  if (!Array.isArray(clusters) || clusters.length === 0) {
    throw new Error("Cannot order empty clusters");
  }

  if (!endAnchor || !Number.isFinite(endAnchor.lat) || !Number.isFinite(endAnchor.lng)) {
    throw new Error("Invalid end anchor coordinates");
  }

  const sorted = [...clusters].sort(
    (a, b) =>
      calculateDistance(a.centroid, endAnchor) -
      calculateDistance(b.centroid, endAnchor)
  );

  return smoothClusterOrder(sorted, endAnchor);
}

export function smoothClusterOrder(
  sorted: Cluster[],
  endAnchor: LatLng
): Cluster[] {
  if (sorted.length < 3) {
    return sorted;
  }

  const ordered = [...sorted];
  const maxIterations = 5;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let improved = false;

    for (let i = 1; i < ordered.length - 1; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const currentCost =
          calculateDistance(ordered[i - 1].centroid, ordered[i].centroid) +
          calculateDistance(ordered[j].centroid, ordered[j - 1].centroid);

        const swappedCost =
          calculateDistance(ordered[i - 1].centroid, ordered[j].centroid) +
          calculateDistance(ordered[i].centroid, ordered[j - 1].centroid);

        if (swappedCost < currentCost) {
          const [removed] = ordered.splice(j, 1);
          ordered.splice(i, 0, removed);
          improved = true;
        }
      }
    }

    if (!improved) {
      break;
    }
  }

  return ordered;
}

export function validateMonotonicProgression(
  orderedClusters: Cluster[],
  endAnchor: LatLng
): boolean {
  if (orderedClusters.length < 2) {
    return true;
  }

  const direction = calculateDirectionVector(
    orderedClusters[0].centroid,
    endAnchor
  );

  for (let i = 0; i < orderedClusters.length - 1; i++) {
    const current = orderedClusters[i].centroid;
    const next = orderedClusters[i + 1].centroid;
    const step = calculateDirectionVector(current, next);

    if (dotProduct(step, direction) < 0) {
      return false;
    }
  }

  return true;
}
