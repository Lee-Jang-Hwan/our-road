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

/**
 * Apply local fixes to address anomalous segments
 * Phase 2 implementation: Log warnings and suggest fixes
 * Future enhancement: Automatically apply fixes (add intermediate stops, swap order, etc.)
 */
export function applyLocalFixes(
  dayPlans: DayPlan[],
  warnings: Warning[]
): void {
  if (warnings.length === 0) return;

  console.log(`[applyLocalFixes] Found ${warnings.length} warnings:`);

  for (const warning of warnings) {
    const { type, segment, suggestion } = warning;

    console.log(
      `  - ${type}: ${segment.key.fromId} → ${segment.key.toId} (${segment.durationMinutes}min)`
    );
    console.log(`    Suggestion: ${suggestion}`);

    // Apply specific fixes based on warning type
    switch (type) {
      case "LONG_DURATION":
        trySwapAdjacentWaypoints(dayPlans, segment);
        break;

      case "TOO_MANY_TRANSFERS":
        // Future: Consider alternative route or reorder nearby waypoints
        console.log(
          `    [TODO] Consider alternative route for ${segment.key.fromId} → ${segment.key.toId}`
        );
        break;

      case "LONG_WAIT_TIME":
        // Future: Adjust timing or suggest alternative departure time
        console.log(
          `    [TODO] Consider timing adjustment for ${segment.key.fromId} → ${segment.key.toId}`
        );
        break;
    }
  }
}

/**
 * Try swapping adjacent waypoints to reduce long travel times
 */
function trySwapAdjacentWaypoints(
  dayPlans: DayPlan[],
  segment: SegmentCost
): void {
  for (const dayPlan of dayPlans) {
    const fromIndex = dayPlan.waypointOrder.indexOf(segment.key.fromId);
    const toIndex = dayPlan.waypointOrder.indexOf(segment.key.toId);

    if (
      fromIndex >= 0 &&
      toIndex >= 0 &&
      Math.abs(fromIndex - toIndex) === 1
    ) {
      // Adjacent waypoints found - suggest swap
      console.log(
        `    [Suggestion] Consider swapping ${segment.key.fromId} ↔ ${segment.key.toId} in day ${dayPlan.dayIndex + 1}`
      );
      // Future enhancement: Actually perform the swap and re-evaluate
      return;
    }
  }
}
