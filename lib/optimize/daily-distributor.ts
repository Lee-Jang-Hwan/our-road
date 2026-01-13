// ============================================
// Daily Distributor (?쇱옄蹂?遺꾨같 濡쒖쭅)
// ============================================

import type { DistanceMatrix, DayDistributionResult } from "@/types/optimize";
import type { FixedSchedule } from "@/types/schedule";
import type {
  OptimizeNode,
  DayAssignment,
} from "./types";
import {
  timeToMinutes,
  getDaysBetween,
  generateDateRange,
} from "./types";
import { createDistanceMatrixGetter } from "./distance-matrix";

// ============================================
// Types
// ============================================

/**
 * ?쇱옄蹂?遺꾨같 ?듭뀡
 */
export interface DailyDistributorOptions {
  /** ?ы뻾 ?쒖옉??(YYYY-MM-DD) */
  startDate: string;
  /** ?ы뻾 醫낅즺??(YYYY-MM-DD) */
  endDate: string;
  /** ?쇱씪 ?쒖옉 ?쒓컙 (HH:mm, 湲곕낯: "10:00") */
  dailyStartTime?: string;
  /** ?쇱씪 醫낅즺 ?쒓컙 (HH:mm, 湲곕낯: "22:00") */
  dailyEndTime?: string;
  /** ?쇱씪 理쒕? ?쒕룞 ?쒓컙 (遺? - 吏?뺥븯吏 ?딆쑝硫?startTime~endTime ?꾩껜 ?ъ슜 */
  maxDailyMinutes?: number;
  /** 怨좎젙 ?쇱젙 紐⑸줉 */
  fixedSchedules?: FixedSchedule[];
  /** ?μ냼蹂?泥대쪟?쒓컙 留?(placeId -> minutes) */
  placeDurations?: Map<string, number>;
  /** Day-specific start/end endpoint IDs */
  dayEndpoints?: Array<{ startId?: string; endId?: string }>;
  /** 吏꾪뻾 肄쒕갚 */
  onProgress?: (day: number, totalDays: number) => void;
}

/**
 * ?쇱옄蹂?媛???쒓컙 ?뺣낫
 */
interface DailyAvailability {
  /** ?좎쭨 (YYYY-MM-DD) */
  date: string;
  /** 媛???쒓컙 (遺? */
  availableMinutes: number;
  /** 怨좎젙 ?쇱젙?쇰줈 ?덉빟???쒓컙 ?щ’ */
  reservedSlots: Array<{ start: number; end: number; placeId: string }>;
  /** ?좊떦???μ냼 ID */
  assignedPlaces: string[];
  /** ?ъ슜???쒓컙 (遺? */
  usedMinutes: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * ?쒖옉 ?쒓컙怨?泥대쪟 ?쒓컙?쇰줈 醫낅즺 ?쒓컙(遺? 怨꾩궛
 */
function calculateEndMinutes(startTime: string, durationMinutes: number): number {
  return timeToMinutes(startTime) + durationMinutes;
}

/**
 * ?쇱옄蹂?媛???쒓컙 怨꾩궛
 *
 * @param options - 遺꾨같 ?듭뀡
 * @returns ?쇱옄蹂?媛???쒓컙 諛곗뿴
 */
function calculateDailyAvailability(
  options: DailyDistributorOptions
): DailyAvailability[] {
  const {
    startDate,
    endDate,
    dailyStartTime = "10:00",
    dailyEndTime = "22:00",
    maxDailyMinutes,
    fixedSchedules = [],
    placeDurations,
  } = options;

  const totalDays = getDaysBetween(startDate, endDate);
  const dates = generateDateRange(startDate, totalDays);

  const dailyEndMinute = timeToMinutes(dailyEndTime);
  const dailyStartMinute = timeToMinutes(dailyStartTime);
  // maxDailyMinutes媛 吏?뺣릺吏 ?딆쑝硫?startTime~endTime ?꾩껜 ?쒓컙 ?ъ슜
  const timeWindowMinutes = dailyEndMinute - dailyStartMinute;
  const defaultAvailable = maxDailyMinutes
    ? Math.min(timeWindowMinutes, maxDailyMinutes)
    : timeWindowMinutes;

  return dates.map((date) => {
    // ?대떦 ?좎쭨??怨좎젙 ?쇱젙 ?꾪꽣留?
    const daySchedules = fixedSchedules.filter((s) => s.date === date);

    // ?덉빟???쒓컙 ?щ’ ?앹꽦 (?μ냼 泥대쪟?쒓컙?쇰줈 醫낅즺 ?쒓컙 怨꾩궛)
    const reservedSlots = daySchedules.map((s) => {
      const duration = placeDurations?.get(s.placeId) ?? 60;
      return {
        start: timeToMinutes(s.startTime),
        end: calculateEndMinutes(s.startTime, duration),
        placeId: s.placeId,
      };
    });

    // 怨좎젙 ?쇱젙??李⑥??섎뒗 珥??쒓컙
    const reservedMinutes = reservedSlots.reduce(
      (sum, slot) => sum + (slot.end - slot.start),
      0
    );

    return {
      date,
      availableMinutes: Math.max(0, defaultAvailable - reservedMinutes),
      reservedSlots,
      assignedPlaces: [],
      usedMinutes: reservedMinutes,
    };
  });
}


// ============================================
// Core Algorithm
// ============================================

/**
 * 寃쎈줈瑜??쇱옄蹂꾨줈 遺꾨같
 *
 * 理쒖쟻?붾맂 寃쎈줈瑜??쇱옄蹂??쒓컙 ?쒖빟??留욊쾶 遺꾨같?⑸땲??
 * - 怨좎젙 ?쇱젙? ?대떦 ?좎쭨???곗꽑 諛곗튂
 * - ?쇰컲 ?μ냼???쒖꽌瑜??좎??섎㈃??洹좊벑?섍쾶 遺꾨같
 * - ?대룞 ?쒓컙??怨좊젮?섏뿬 遺꾨같
 *
 * @param route - 理쒖쟻?붾맂 寃쎈줈 (?μ냼 ID ?쒖꽌)
 * @param nodes - ?몃뱶 留?
 * @param distanceMatrix - 嫄곕━ ?됰젹
 * @param options - 遺꾨같 ?듭뀡
 * @returns 遺꾨같 寃곌낵
 *
 * @example
 * ```ts
 * const result = distributeToDaily(
 *   ["place1", "place2", "place3", "place4", "place5"],
 *   nodeMap,
 *   distanceMatrix,
 *   {
 *     startDate: "2024-01-15",
 *     endDate: "2024-01-17",
 *     dailyStartTime: "10:00",
 *     dailyEndTime: "22:00",
 *   }
 * );
 * console.log(result.days); // [["place1", "place2"], ["place3", "place4"], ["place5"]]
 * ```
 */
export function distributeToDaily(
  route: string[],
  nodes: Map<string, OptimizeNode>,
  distanceMatrix: DistanceMatrix,
  options: DailyDistributorOptions
): DayDistributionResult {
  const dailyAvailability = calculateDailyAvailability(options);
  const getDistance = createDistanceMatrixGetter(distanceMatrix);
  const { onProgress } = options;

  const totalDays = dailyAvailability.length;

  // 寃곌낵 珥덇린??
  const days: string[][] = dailyAvailability.map(() => []);
  const dailyDurations: number[] = dailyAvailability.map(() => 0);
  const unassignedPlaces: string[] = [];

  // 1?④퀎: 怨좎젙 ?쇱젙怨??쇰컲 ?μ냼 遺꾨━
  const fixedPlaces: Array<{ placeId: string; dayIndex: number }> = [];
  const normalPlaces: string[] = [];

  for (const placeId of route) {
    const node = nodes.get(placeId);
    if (!node) continue;

    if (node.isFixed && node.fixedDate) {
      const dayIndex = dailyAvailability.findIndex(
        (d) => d.date === node.fixedDate
      );
      if (dayIndex !== -1) {
        fixedPlaces.push({ placeId, dayIndex });
        days[dayIndex].push(placeId);
        dailyDurations[dayIndex] += node.duration;
        dailyAvailability[dayIndex].assignedPlaces.push(placeId);
        dailyAvailability[dayIndex].usedMinutes += node.duration;
        dailyAvailability[dayIndex].availableMinutes -= node.duration;
      }
    } else {
      normalPlaces.push(placeId);
    }
  }

  // 2?④퀎: ?쇰컲 ?μ냼瑜??쇱옄蹂꾨줈 洹좊벑 遺꾨같
  // 媛??쇱옄蹂?紐⑺몴 ?μ냼 ??怨꾩궛
  const placesPerDay = Math.ceil(normalPlaces.length / totalDays);

  const dayEndpoints = options.dayEndpoints ?? [];
  const dayPlaceCounts = days.map((day) => day.length);
  const dayLastPlaceIds = dailyAvailability.map(() => null as string | null);
  const dayEndTravelMinutes = dailyAvailability.map(() => 0);

  const getDayStartId = (dayIndex: number): string | undefined =>
    dayEndpoints[dayIndex]?.startId;

  const getDayEndId = (dayIndex: number): string | undefined =>
    dayEndpoints[dayIndex]?.endId;

  const getTravelMinutes = (
    fromId?: string | null,
    toId?: string | null
  ): number => {
    if (!fromId || !toId) return 0;
    const entry = getDistance(fromId, toId);
    return entry?.duration ?? 0;
  };

  const getPlacementDelta = (
    dayIndex: number,
    node: OptimizeNode
  ): { delta: number; newEndTravel: number } => {
    const prevLastPlaceId = dayLastPlaceIds[dayIndex];
    const travelFromPrev = prevLastPlaceId
      ? getTravelMinutes(prevLastPlaceId, node.id)
      : getTravelMinutes(getDayStartId(dayIndex), node.id);
    const prevEndTravel = dayEndTravelMinutes[dayIndex];
    const dayEndId = getDayEndId(dayIndex);
    const newEndTravel = dayEndId
      ? getTravelMinutes(node.id, dayEndId)
      : 0;
    const delta = node.duration + travelFromPrev + newEndTravel - prevEndTravel;
    return { delta, newEndTravel };
  };

  let currentDayIndex = 0;

  for (const placeId of normalPlaces) {
    const node = nodes.get(placeId);
    if (!node) continue;

    const day = dailyAvailability[currentDayIndex];
    const { delta: requiredMinutes } = getPlacementDelta(currentDayIndex, node);

    const shouldMoveToNextDay =
      (dayPlaceCounts[currentDayIndex] >= placesPerDay &&
        currentDayIndex < totalDays - 1) ||
      (day.availableMinutes < requiredMinutes && currentDayIndex < totalDays - 1);

    if (shouldMoveToNextDay) {
      currentDayIndex++;
    }

    let assigned = false;
    for (let d = currentDayIndex; d < dailyAvailability.length; d++) {
      const targetDay = dailyAvailability[d];
      const { delta: adjustedRequired, newEndTravel } = getPlacementDelta(
        d,
        node
      );

      if (targetDay.availableMinutes >= adjustedRequired) {
        days[d].push(placeId);
        dailyDurations[d] += adjustedRequired;
        targetDay.assignedPlaces.push(placeId);
        targetDay.usedMinutes += adjustedRequired;
        targetDay.availableMinutes -= adjustedRequired;

        dayLastPlaceIds[d] = placeId;
        dayEndTravelMinutes[d] = newEndTravel;
        dayPlaceCounts[d] += 1;
        currentDayIndex = d;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      unassignedPlaces.push(placeId);
    }

    onProgress?.(currentDayIndex + 1, dailyAvailability.length);
  }

  // 3?④퀎: 媛??쇱옄 ?댁뿉??怨좎젙 ?쇱젙 湲곗??쇰줈 ?뺣젹
  for (let d = 0; d < days.length; d++) {
    const dayPlaces = days[d];
    if (dayPlaces.length <= 1) continue;

    const fixedPlaces: Array<{ id: string; startMinute: number }> = [];
    const nonFixedPlaces: string[] = [];

    for (const placeId of dayPlaces) {
      const node = nodes.get(placeId);
      if (node?.isFixed && node.fixedStartTime) {
        fixedPlaces.push({
          id: placeId,
          startMinute: timeToMinutes(node.fixedStartTime),
        });
      } else {
        nonFixedPlaces.push(placeId);
      }
    }

    // 怨좎젙 ?쇱젙 ?쒓컙???뺣젹
    fixedPlaces.sort((a, b) => a.startMinute - b.startMinute);

    // 怨좎젙 ?쇱젙 ?ъ씠??鍮꾧퀬???μ냼 諛곗튂 (媛꾨떒??諛⑹떇)
    const sortedDay: string[] = [];

    if (fixedPlaces.length === 0) {
      // 怨좎젙 ?쇱젙 ?놁쓬: 洹몃?濡??좎?
      sortedDay.push(...dayPlaces);
    } else {
      // 泥?踰덉㎏ 怨좎젙 ?쇱젙 ??
      let nonFixedIdx = 0;

      for (const fixed of fixedPlaces) {
        // 怨좎젙 ?쇱젙 ?꾩뿉 諛곗튂?????덈뒗 鍮꾧퀬???μ냼??
        while (nonFixedIdx < nonFixedPlaces.length) {
          const nextNonFixed = nonFixedPlaces[nonFixedIdx];
          const node = nodes.get(nextNonFixed);
          if (!node) {
            nonFixedIdx++;
            continue;
          }

          // ???μ냼瑜?怨좎젙 ?쇱젙 ?꾩뿉 諛곗튂?????덈뒗吏 ?뺤씤
          // (媛꾨떒???쒖꽌?濡?諛곗튂)
          sortedDay.push(nextNonFixed);
          nonFixedIdx++;

          // ??媛쒕쭔 諛곗튂 (???뺢탳??濡쒖쭅? ?꾩슂??異붽?)
          break;
        }

        sortedDay.push(fixed.id);
      }

      // ?⑥? 鍮꾧퀬???μ냼??
      while (nonFixedIdx < nonFixedPlaces.length) {
        sortedDay.push(nonFixedPlaces[nonFixedIdx]);
        nonFixedIdx++;
      }
    }

    days[d] = sortedDay;
  }

  return {
    days,
    dailyDurations,
    unassignedPlaces,
  };
}

/**
 * ?쇱옄蹂?遺꾨같 寃곌낵瑜?DayAssignment 諛곗뿴濡?蹂??
 *
 * @param result - 遺꾨같 寃곌낵
 * @param options - 遺꾨같 ?듭뀡
 * @returns DayAssignment 諛곗뿴
 */
export function toDayAssignments(
  result: DayDistributionResult,
  options: DailyDistributorOptions
): DayAssignment[] {
  const totalDays = getDaysBetween(options.startDate, options.endDate);
  const dates = generateDateRange(options.startDate, totalDays);
  const maxMinutes =
    options.maxDailyMinutes ??
    timeToMinutes(options.dailyEndTime ?? "22:00") -
      timeToMinutes(options.dailyStartTime ?? "10:00");

  return result.days.map((placeIds, index) => ({
    dayNumber: index + 1,
    date: dates[index],
    placeIds,
    usedMinutes: result.dailyDurations[index],
    remainingMinutes: maxMinutes - result.dailyDurations[index],
  }));
}

/**
 * 遺꾨같 寃곌낵 寃利?
 *
 * @param result - 遺꾨같 寃곌낵
 * @param originalRoute - ?먮낯 寃쎈줈
 * @returns 寃利?寃곌낵
 */
export function validateDistribution(
  result: DayDistributionResult,
  originalRoute: string[]
): {
  isValid: boolean;
  missingPlaces: string[];
  duplicatePlaces: string[];
  allPlacesAssigned: boolean;
} {
  const assignedPlaces = new Set<string>();
  const duplicatePlaces: string[] = [];

  for (const dayPlaces of result.days) {
    for (const placeId of dayPlaces) {
      if (assignedPlaces.has(placeId)) {
        duplicatePlaces.push(placeId);
      }
      assignedPlaces.add(placeId);
    }
  }

  const missingPlaces = originalRoute.filter(
    (id) => !assignedPlaces.has(id) && !result.unassignedPlaces.includes(id)
  );

  return {
    isValid:
      missingPlaces.length === 0 &&
      duplicatePlaces.length === 0 &&
      result.unassignedPlaces.length === 0,
    missingPlaces,
    duplicatePlaces,
    allPlacesAssigned: result.unassignedPlaces.length === 0,
  };
}

/**
 * ?쇱옄蹂?遺꾨같 ?붿빟 ?듦퀎
 *
 * @param result - 遺꾨같 寃곌낵
 * @returns ?듦퀎 ?뺣낫
 */
export function getDistributionStats(result: DayDistributionResult): {
  totalDays: number;
  totalPlaces: number;
  avgPlacesPerDay: number;
  avgDurationPerDay: number;
  maxDayPlaces: number;
  minDayPlaces: number;
  unassignedCount: number;
} {
  const placeCounts = result.days.map((d) => d.length);
  const totalPlaces = placeCounts.reduce((a, b) => a + b, 0);
  const totalDuration = result.dailyDurations.reduce((a, b) => a + b, 0);

  return {
    totalDays: result.days.length,
    totalPlaces,
    avgPlacesPerDay: totalPlaces / result.days.length,
    avgDurationPerDay: totalDuration / result.days.length,
    maxDayPlaces: Math.max(...placeCounts),
    minDayPlaces: Math.min(...placeCounts),
    unassignedCount: result.unassignedPlaces.length,
  };
}


