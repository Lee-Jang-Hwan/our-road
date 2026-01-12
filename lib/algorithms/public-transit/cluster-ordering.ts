// ============================================
// Cluster Ordering (Public Transit Algorithm)
// ============================================

import type { Cluster, LatLng, TripInput } from "@/types";
import { calculateCentroid, calculateDistance, calculateDirectionVector, dotProduct } from "../utils/geo";

export function chooseEndAnchor(
  lodging: LatLng | undefined,
  clusters: Cluster[]
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
  endAnchor: LatLng,
  startAnchor?: LatLng
): Cluster[] {
  if (!Array.isArray(clusters) || clusters.length === 0) {
    throw new Error("Cannot order empty clusters");
  }

  if (!endAnchor || !Number.isFinite(endAnchor.lat) || !Number.isFinite(endAnchor.lng)) {
    throw new Error("Invalid end anchor coordinates");
  }

  // If we have a start anchor, sort by progression from start to end
  // Otherwise, fallback to sorting by distance to end anchor
  let sorted: Cluster[];

  if (startAnchor && Number.isFinite(startAnchor.lat) && Number.isFinite(startAnchor.lng)) {
    // Calculate direction vector from start to end
    const direction = calculateDirectionVector(startAnchor, endAnchor);

    // Sort by projection onto start->end axis (progressive ordering)
    sorted = [...clusters].sort((a, b) => {
      const projA = dotProduct(
        calculateDirectionVector(startAnchor, a.centroid),
        direction
      );
      const projB = dotProduct(
        calculateDirectionVector(startAnchor, b.centroid),
        direction
      );
      return projA - projB;
    });
  } else {
    // Fallback: sort by distance to end anchor
    sorted = [...clusters].sort(
      (a, b) =>
        calculateDistance(a.centroid, endAnchor) -
        calculateDistance(b.centroid, endAnchor)
    );
  }

  const smoothed = smoothClusterOrder(sorted, endAnchor);

  // Validate monotonic progression
  const isValid = validateMonotonicProgression(smoothed, endAnchor, startAnchor);
  if (!isValid) {
    console.warn("[orderClustersOneDirection] Warning: Cluster order may have backtracking");
  }

  return smoothed;
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
        // Calculate cost considering connections
        const currentCost =
          calculateDistance(ordered[i - 1].centroid, ordered[i].centroid) +
          calculateDistance(ordered[i].centroid, ordered[i + 1]?.centroid ?? endAnchor) +
          (ordered[j - 1] ? calculateDistance(ordered[j - 1].centroid, ordered[j].centroid) : 0) +
          (ordered[j + 1] ? calculateDistance(ordered[j].centroid, ordered[j + 1].centroid) : 0);

        const swappedCost =
          calculateDistance(ordered[i - 1].centroid, ordered[j].centroid) +
          calculateDistance(ordered[j].centroid, ordered[i + 1]?.centroid ?? endAnchor) +
          (ordered[j - 1] ? calculateDistance(ordered[j - 1].centroid, ordered[i].centroid) : 0) +
          (ordered[j + 1] ? calculateDistance(ordered[i].centroid, ordered[j + 1].centroid) : 0);

        // Only swap if it significantly improves (avoid oscillation)
        if (swappedCost < currentCost - 100) { // 100m threshold
          const [removed] = ordered.splice(j, 1);
          ordered.splice(i, 0, removed);
          improved = true;
          break; // Re-evaluate after each swap
        }
      }
      if (improved) break;
    }

    if (!improved) {
      break;
    }
  }

  return ordered;
}

export function validateMonotonicProgression(
  orderedClusters: Cluster[],
  endAnchor: LatLng,
  startAnchor?: LatLng
): boolean {
  if (orderedClusters.length < 2) {
    return true;
  }

  // Use start->end direction if available, otherwise use first cluster->end
  const referenceStart = startAnchor ?? orderedClusters[0].centroid;
  const direction = calculateDirectionVector(referenceStart, endAnchor);

  let backtrackCount = 0;

  for (let i = 0; i < orderedClusters.length - 1; i++) {
    const current = orderedClusters[i].centroid;
    const next = orderedClusters[i + 1].centroid;
    const step = calculateDirectionVector(current, next);

    const progression = dotProduct(step, direction);

    if (progression < -0.1) { // Allow small tolerance for perpendicular movement
      backtrackCount++;
      console.warn(
        `[validateMonotonicProgression] Backtracking detected at cluster ${i} -> ${i + 1} (progression: ${progression.toFixed(3)})`
      );
    }
  }

  const isValid = backtrackCount === 0;

  if (!isValid) {
    console.warn(`[validateMonotonicProgression] ✗ ${backtrackCount} backtracking segments detected`);
  }

  return isValid;
}
