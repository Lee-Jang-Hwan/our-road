// ============================================
// Output Builder
// ============================================

import type { Cluster, DayPlan, SegmentCost, TripMode, TripOutput, OutlierWarning } from "@/types";

export function buildOutput(params: {
  tripId: string;
  mode: TripMode;
  clusters: Cluster[];
  dayPlans: DayPlan[];
  segmentCosts: SegmentCost[];
  outlierWarnings?: OutlierWarning[];
}): TripOutput {
  return {
    tripId: params.tripId,
    mode: params.mode,
    clusters: params.clusters,
    dayPlans: params.dayPlans,
    segmentCosts: params.segmentCosts,
    outlierWarnings: params.outlierWarnings,
  };
}
