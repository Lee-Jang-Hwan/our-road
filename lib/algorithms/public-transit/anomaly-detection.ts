// ============================================
// Anomaly Detection
// ============================================

import type { SegmentCost, DayPlan } from "@/types";

export type WarningType =
  | "LONG_DURATION"
  | "TOO_MANY_TRANSFERS"
  | "LONG_WAIT_TIME";

export interface Warning {
  type: WarningType;
  segment: SegmentCost;
  suggestion: string;
}

export function detectAnomalousSegments(
  segmentCosts: SegmentCost[]
): Warning[] {
  const warnings: Warning[] = [];

  for (const segment of segmentCosts) {
    if (segment.durationMinutes > 20) {
      warnings.push({
        type: "LONG_DURATION",
        segment,
        suggestion: "Consider adding an intermediate stop or adjusting order.",
      });
    }

    if (segment.transfers && segment.transfers > 2) {
      warnings.push({
        type: "TOO_MANY_TRANSFERS",
        segment,
        suggestion: "Prefer a route with fewer transfers.",
      });
    }

    if (segment.waitTimeMinutes && segment.waitTimeMinutes > 8) {
      warnings.push({
        type: "LONG_WAIT_TIME",
        segment,
        suggestion: "Consider alternative timing or nearby stop.",
      });
    }
  }

  return warnings;
}

export function applyLocalFixes(
  _dayPlans: DayPlan[],
  _warnings: Warning[]
): void {
  // Placeholder: keep current plan and surface warnings to the client.
}
