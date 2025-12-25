// ============================================
// Daily Distributor (일자별 분배 로직)
// ============================================

import type { DistanceMatrix, DayDistributionResult } from "@/types/optimize";
import type { FixedSchedule } from "@/types/schedule";
import type {
  OptimizeNode,
  DayAssignment,
  DailyTimeConfig,
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
 * 일자별 분배 옵션
 */
export interface DailyDistributorOptions {
  /** 여행 시작일 (YYYY-MM-DD) */
  startDate: string;
  /** 여행 종료일 (YYYY-MM-DD) */
  endDate: string;
  /** 일일 시작 시간 (HH:mm, 기본: "10:00") */
  dailyStartTime?: string;
  /** 일일 종료 시간 (HH:mm, 기본: "22:00") */
  dailyEndTime?: string;
  /** 일일 최대 활동 시간 (분, 기본: 480 = 8시간) */
  maxDailyMinutes?: number;
  /** 고정 일정 목록 */
  fixedSchedules?: FixedSchedule[];
  /** 장소별 체류시간 맵 (placeId -> minutes) */
  placeDurations?: Map<string, number>;
  /** 진행 콜백 */
  onProgress?: (day: number, totalDays: number) => void;
}

/**
 * 일자별 가용 시간 정보
 */
interface DailyAvailability {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 가용 시간 (분) */
  availableMinutes: number;
  /** 고정 일정으로 예약된 시간 슬롯 */
  reservedSlots: Array<{ start: number; end: number; placeId: string }>;
  /** 할당된 장소 ID */
  assignedPlaces: string[];
  /** 사용된 시간 (분) */
  usedMinutes: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * 시작 시간과 체류 시간으로 종료 시간(분) 계산
 */
function calculateEndMinutes(startTime: string, durationMinutes: number): number {
  return timeToMinutes(startTime) + durationMinutes;
}

/**
 * 일자별 가용 시간 계산
 *
 * @param options - 분배 옵션
 * @returns 일자별 가용 시간 배열
 */
function calculateDailyAvailability(
  options: DailyDistributorOptions
): DailyAvailability[] {
  const {
    startDate,
    endDate,
    dailyStartTime = "10:00",
    dailyEndTime = "22:00",
    maxDailyMinutes = 480,
    fixedSchedules = [],
    placeDurations,
  } = options;

  const totalDays = getDaysBetween(startDate, endDate);
  const dates = generateDateRange(startDate, totalDays);

  const dailyEndMinute = timeToMinutes(dailyEndTime);
  const dailyStartMinute = timeToMinutes(dailyStartTime);
  const defaultAvailable = Math.min(
    dailyEndMinute - dailyStartMinute,
    maxDailyMinutes
  );

  return dates.map((date) => {
    // 해당 날짜의 고정 일정 필터링
    const daySchedules = fixedSchedules.filter((s) => s.date === date);

    // 예약된 시간 슬롯 생성 (장소 체류시간으로 종료 시간 계산)
    const reservedSlots = daySchedules.map((s) => {
      const duration = placeDurations?.get(s.placeId) ?? 60;
      return {
        start: timeToMinutes(s.startTime),
        end: calculateEndMinutes(s.startTime, duration),
        placeId: s.placeId,
      };
    });

    // 고정 일정이 차지하는 총 시간
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

/**
 * 노드가 특정 날짜에 고정되어 있는지 확인
 */
function isNodeFixedOnDate(node: OptimizeNode, date: string): boolean {
  return node.isFixed && node.fixedDate === date;
}

/**
 * 노드가 특정 날짜에 할당 가능한지 확인
 */
function canAssignToDay(
  node: OptimizeNode,
  day: DailyAvailability,
  travelTime: number
): boolean {
  // 고정 일정은 해당 날짜에만 할당 가능
  if (node.isFixed) {
    return node.fixedDate === day.date;
  }

  // 일반 장소: 가용 시간 확인
  const requiredMinutes = node.duration + travelTime;
  return day.availableMinutes >= requiredMinutes;
}

// ============================================
// Core Algorithm
// ============================================

/**
 * 경로를 일자별로 분배
 *
 * 최적화된 경로를 일자별 시간 제약에 맞게 분배합니다.
 * - 고정 일정은 해당 날짜에 우선 배치
 * - 일반 장소는 순서를 유지하면서 시간 제약 내에서 배치
 * - 이동 시간도 고려하여 분배
 *
 * @param route - 최적화된 경로 (장소 ID 순서)
 * @param nodes - 노드 맵
 * @param distanceMatrix - 거리 행렬
 * @param options - 분배 옵션
 * @returns 분배 결과
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

  // 결과 초기화
  const days: string[][] = dailyAvailability.map(() => []);
  const dailyDurations: number[] = dailyAvailability.map(() => 0);
  const unassignedPlaces: string[] = [];

  // 1단계: 고정 일정 먼저 배치
  for (const placeId of route) {
    const node = nodes.get(placeId);
    if (!node) continue;

    if (node.isFixed && node.fixedDate) {
      const dayIndex = dailyAvailability.findIndex(
        (d) => d.date === node.fixedDate
      );
      if (dayIndex !== -1) {
        days[dayIndex].push(placeId);
        dailyDurations[dayIndex] += node.duration;
        dailyAvailability[dayIndex].assignedPlaces.push(placeId);
        dailyAvailability[dayIndex].usedMinutes += node.duration;
        dailyAvailability[dayIndex].availableMinutes -= node.duration;
      }
    }
  }

  // 2단계: 일반 장소 순서대로 배치
  let currentDayIndex = 0;
  let lastPlaceId: string | null = null;

  for (const placeId of route) {
    const node = nodes.get(placeId);
    if (!node) continue;

    // 이미 배치된 고정 일정은 건너뜀
    if (node.isFixed) {
      // 해당 날짜로 이동하고 lastPlaceId 갱신
      const dayIndex = dailyAvailability.findIndex(
        (d) => d.date === node.fixedDate
      );
      if (dayIndex !== -1) {
        currentDayIndex = dayIndex;
        lastPlaceId = placeId;
      }
      continue;
    }

    // 현재 위치에서의 이동 시간 계산
    let travelTime = 0;
    if (lastPlaceId) {
      const entry = getDistance(lastPlaceId, placeId);
      travelTime = entry?.duration ?? 0;
    }

    // 현재 일자에 배치 시도
    let assigned = false;
    const requiredMinutes = node.duration + travelTime;

    // 현재 일자부터 시작하여 배치 가능한 일자 탐색
    for (let d = currentDayIndex; d < dailyAvailability.length; d++) {
      const day = dailyAvailability[d];

      // 일자가 바뀌면 이동 시간 재계산 (이전 일자 마지막 장소에서)
      if (d > currentDayIndex) {
        const prevDayPlaces = days[d - 1];
        const prevLastPlace =
          prevDayPlaces.length > 0
            ? prevDayPlaces[prevDayPlaces.length - 1]
            : lastPlaceId;

        if (prevLastPlace) {
          const entry = getDistance(prevLastPlace, placeId);
          travelTime = entry?.duration ?? 0;
        } else {
          travelTime = 0;
        }
      }

      const adjustedRequired = node.duration + travelTime;

      if (day.availableMinutes >= adjustedRequired) {
        days[d].push(placeId);
        dailyDurations[d] += adjustedRequired;
        day.assignedPlaces.push(placeId);
        day.usedMinutes += adjustedRequired;
        day.availableMinutes -= adjustedRequired;

        currentDayIndex = d;
        lastPlaceId = placeId;
        assigned = true;
        break;
      }
    }

    // 배치 실패
    if (!assigned) {
      unassignedPlaces.push(placeId);
    }

    onProgress?.(currentDayIndex + 1, dailyAvailability.length);
  }

  // 3단계: 각 일자 내에서 고정 일정 기준으로 정렬
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

    // 고정 일정 시간순 정렬
    fixedPlaces.sort((a, b) => a.startMinute - b.startMinute);

    // 고정 일정 사이에 비고정 장소 배치 (간단한 방식)
    const sortedDay: string[] = [];

    if (fixedPlaces.length === 0) {
      // 고정 일정 없음: 그대로 유지
      sortedDay.push(...dayPlaces);
    } else {
      // 첫 번째 고정 일정 전
      let nonFixedIdx = 0;
      const dailyStartMinute = timeToMinutes(
        options.dailyStartTime ?? "10:00"
      );

      for (const fixed of fixedPlaces) {
        // 고정 일정 전에 배치할 수 있는 비고정 장소들
        while (nonFixedIdx < nonFixedPlaces.length) {
          const nextNonFixed = nonFixedPlaces[nonFixedIdx];
          const node = nodes.get(nextNonFixed);
          if (!node) {
            nonFixedIdx++;
            continue;
          }

          // 이 장소를 고정 일정 전에 배치할 수 있는지 확인
          // (간단히 순서대로 배치)
          sortedDay.push(nextNonFixed);
          nonFixedIdx++;

          // 한 개만 배치 (더 정교한 로직은 필요시 추가)
          break;
        }

        sortedDay.push(fixed.id);
      }

      // 남은 비고정 장소들
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
 * 일자별 분배 결과를 DayAssignment 배열로 변환
 *
 * @param result - 분배 결과
 * @param options - 분배 옵션
 * @returns DayAssignment 배열
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
 * 분배 결과 검증
 *
 * @param result - 분배 결과
 * @param originalRoute - 원본 경로
 * @returns 검증 결과
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
 * 일자별 분배 요약 통계
 *
 * @param result - 분배 결과
 * @returns 통계 정보
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
