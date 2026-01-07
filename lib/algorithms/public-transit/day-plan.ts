// ============================================
// Day Plan Generation
// ============================================

import type { Cluster, DayPlan, TripInput, Waypoint } from "@/types";
import { resolveDayEndAnchor } from "./cluster-ordering";
import { orderWithinClusterOneDirection } from "./within-cluster-ordering";

export async function generateDayPlans(
  orderedClusters: Cluster[],
  waypoints: Map<string, Waypoint>,
  endAnchor: { lat: number; lng: number },
  input: TripInput
): Promise<DayPlan[]> {
  // Parallelize within-cluster ordering for all clusters
  const dayPlans = await Promise.all(
    orderedClusters.map(async (cluster, dayIndex) => {
      const dayEndAnchor = resolveDayEndAnchor({
        dayIndex,
        orderedClusters,
        endAnchor,
        input,
      });

      // Determine the start position for this day
      let dayStartAnchor: { lat: number; lng: number };
      if (dayIndex === 0) {
        // First day: start from trip origin
        dayStartAnchor = input.start;
      } else if (input.lodging) {
        // Subsequent days with lodging: start from lodging
        dayStartAnchor = input.lodging;
      } else {
        // Subsequent days without lodging: start from previous cluster's centroid
        dayStartAnchor = orderedClusters[dayIndex - 1]?.centroid ?? input.start;
      }

      const waypointOrder = orderWithinClusterOneDirection({
        cluster,
        startAnchor: dayStartAnchor,
        endAnchor: dayEndAnchor,
        waypoints,
      });

      return {
        dayIndex: dayIndex + 1,
        waypointOrder,
        excludedWaypointIds: [],
      };
    })
  );

  return dayPlans;
}
