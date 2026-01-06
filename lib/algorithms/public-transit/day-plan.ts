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

      const waypointOrder = orderWithinClusterOneDirection({
        cluster,
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
