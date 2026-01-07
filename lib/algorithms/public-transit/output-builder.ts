// ============================================
// Output Builder
// ============================================

import type { Cluster, DayPlan, SegmentCost, TripMode, TripOutput } from "@/types";

export function buildOutput(params: {
  tripId: string;
  mode: TripMode;
  clusters: Cluster[];
  dayPlans: DayPlan[];
  segmentCosts: SegmentCost[];
}): TripOutput {
  return {
    tripId: params.tripId,
    mode: params.mode,
    clusters: params.clusters,
    dayPlans: params.dayPlans,
    segmentCosts: params.segmentCosts,
  };
}
