// ============================================
// Check-in Split (Public Transit)
// ============================================

import type { DayPlan, Waypoint, TripInput, LatLng } from "@/types";
import { calculateDistance } from "../utils/geo";

const MINUTES_PER_KM = 5;
const DEFAULT_DAY_START_TIME = "10:00";

function normalizeDateOnly(dateStr: string): string {
  const trimmed = dateStr.trim();
  return trimmed.split("T")[0].split(" ")[0];
}

function parseLocalDate(dateStr: string): Date {
  const normalized = normalizeDateOnly(dateStr);
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function getDayIndex(tripStartDate?: string, checkInDate?: string): number | null {
  if (!tripStartDate || !checkInDate) return null;
  const start = parseLocalDate(tripStartDate);
  const checkIn = parseLocalDate(checkInDate);
  const diffDays = Math.floor(
    (checkIn.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays >= 0 ? diffDays : null;
}

function estimateTravelMinutes(from: LatLng, to: LatLng): number {
  const distanceKm = calculateDistance(from, to) / 1000;
  return Math.round(distanceKm * MINUTES_PER_KM);
}

function resolveDayStartCoord(
  params: {
    dayIndex: number;
    dayPlans: DayPlan[];
    waypoints: Map<string, Waypoint>;
    input: TripInput;
  },
): LatLng {
  const { dayIndex, dayPlans, waypoints, input } = params;
  if (dayIndex === 0) return input.start;
  if (input.lodging) return input.lodging;

  const prevPlan = dayPlans[dayIndex - 1];
  const prevLastId = prevPlan?.waypointOrder?.[prevPlan.waypointOrder.length - 1];
  const prevLast = prevLastId ? waypoints.get(prevLastId) : undefined;
  return prevLast?.coord ?? input.start;
}

export function applyCheckInSplit(params: {
  dayPlans: DayPlan[];
  waypoints: Map<string, Waypoint>;
  input: TripInput;
}): void {
  const { dayPlans, waypoints, input } = params;
  if (!input.lodging || !input.checkInTime) return;

  const checkInDayIndex = getDayIndex(input.tripStartDate, input.checkInDate);
  if (checkInDayIndex === null) return;

  const dayPlan = dayPlans[checkInDayIndex];
  if (!dayPlan || dayPlan.waypointOrder.length === 0) return;

  const dayStartTime =
    input.dailyTimeLimits?.[checkInDayIndex]?.startTime ?? DEFAULT_DAY_START_TIME;
  const checkInMinute = timeToMinutes(input.checkInTime);
  let currentMinute = timeToMinutes(dayStartTime);
  let lastCoord = resolveDayStartCoord({
    dayIndex: checkInDayIndex,
    dayPlans,
    waypoints,
    input,
  });

  let splitIndex = dayPlan.waypointOrder.length;

  if (checkInMinute <= currentMinute) {
    dayPlan.checkInBreakIndex = 0;
    return;
  }

  for (let i = 0; i < dayPlan.waypointOrder.length; i++) {
    const waypointId = dayPlan.waypointOrder[i];
    const waypoint = waypoints.get(waypointId);
    if (!waypoint) continue;

    const travelMinutes = estimateTravelMinutes(lastCoord, waypoint.coord);
    const arrivalBase = currentMinute + travelMinutes;

    if (waypoint.isFixed && waypoint.fixedStartTime) {
      const fixedMinute = timeToMinutes(waypoint.fixedStartTime);
      if (fixedMinute >= checkInMinute) {
        splitIndex = i;
        break;
      }
      currentMinute = Math.max(fixedMinute, arrivalBase) + (waypoint.stayMinutes ?? 0);
    } else {
      if (arrivalBase >= checkInMinute) {
        splitIndex = i;
        break;
      }
      currentMinute = arrivalBase + (waypoint.stayMinutes ?? 0);
    }

    lastCoord = waypoint.coord;
  }

  dayPlan.checkInBreakIndex = splitIndex;
}
