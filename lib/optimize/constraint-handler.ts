// ============================================
// Constraint Handler (고정 일정 제약 처리)
// ============================================

import type { ScheduleConflict } from "@/types/optimize";
import type { FixedSchedule } from "@/types/schedule";
import type { OptimizeNode, TimeWindow } from "./types";
import {
  timeToMinutes,
  minutesToTime,
  getMinutesBetween,
  getDaysBetween,
  generateDateRange,
} from "./types";

// ============================================
// Types
// ============================================

/**
 * 시간 슬롯 (분 단위)
 */
interface TimeSlot {
  start: number;
  end: number;
  placeId?: string;
  scheduleId?: string;
}

/**
 * 일자별 시간 제약
 */
interface DailyConstraints {
  date: string;
  /** 일과 시작 시간 (분) */
  dayStart: number;
  /** 일과 종료 시간 (분) */
  dayEnd: number;
  /** 고정된 시간 슬롯들 */
  fixedSlots: TimeSlot[];
  /** 가용 시간 슬롯들 */
  availableSlots: TimeSlot[];
}

/**
 * 제약 검증 결과
 */
export interface ConstraintValidationResult {
  /** 유효성 */
  isValid: boolean;
  /** 충돌 목록 */
  conflicts: ScheduleConflict[];
  /** 경고 메시지 */
  warnings: string[];
}

/**
 * 제약 처리 옵션
 */
export interface ConstraintOptions {
  /** 여행 시작일 */
  startDate: string;
  /** 여행 종료일 */
  endDate: string;
  /** 일일 시작 시간 (HH:mm) */
  dailyStartTime: string;
  /** 일일 종료 시간 (HH:mm) */
  dailyEndTime: string;
}

// ============================================
// Conflict Detection
// ============================================

/**
 * 두 시간 슬롯이 겹치는지 확인
 *
 * @param slot1 - 첫 번째 슬롯
 * @param slot2 - 두 번째 슬롯
 * @returns 겹침 여부
 */
function slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  return slot1.start < slot2.end && slot2.start < slot1.end;
}

/**
 * 고정 일정 간의 충돌 감지
 *
 * @param schedules - 고정 일정 배열
 * @returns 충돌 목록
 */
export function detectScheduleConflicts(
  schedules: FixedSchedule[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // 날짜별로 그룹화
  const byDate = new Map<string, FixedSchedule[]>();
  for (const schedule of schedules) {
    const existing = byDate.get(schedule.date) ?? [];
    existing.push(schedule);
    byDate.set(schedule.date, existing);
  }

  // 각 날짜별로 충돌 확인
  for (const [date, daySchedules] of byDate) {
    // 시간 순으로 정렬
    const sorted = [...daySchedules].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    // 인접한 일정 간 충돌 확인
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      const currentEnd = timeToMinutes(current.endTime);
      const nextStart = timeToMinutes(next.startTime);

      if (currentEnd > nextStart) {
        conflicts.push({
          type: "overlap",
          scheduleIds: [current.id, next.id],
          date,
          message: `고정 일정 "${current.id}"와 "${next.id}"가 ${current.endTime}~${next.startTime} 시간대에 겹칩니다.`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * 고정 일정이 일일 시간 범위를 벗어나는지 확인
 *
 * @param schedules - 고정 일정 배열
 * @param dailyStartTime - 일일 시작 시간 (HH:mm)
 * @param dailyEndTime - 일일 종료 시간 (HH:mm)
 * @returns 충돌 목록
 */
export function detectOutOfHoursConflicts(
  schedules: FixedSchedule[],
  dailyStartTime: string,
  dailyEndTime: string
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const dayStart = timeToMinutes(dailyStartTime);
  const dayEnd = timeToMinutes(dailyEndTime);

  for (const schedule of schedules) {
    const scheduleStart = timeToMinutes(schedule.startTime);
    const scheduleEnd = timeToMinutes(schedule.endTime);

    if (scheduleStart < dayStart || scheduleEnd > dayEnd) {
      conflicts.push({
        type: "outside_hours",
        scheduleIds: [schedule.id],
        date: schedule.date,
        message: `고정 일정 "${schedule.id}"(${schedule.startTime}~${schedule.endTime})가 일일 시간 범위(${dailyStartTime}~${dailyEndTime}) 밖입니다.`,
      });
    }
  }

  return conflicts;
}

/**
 * 일일 시간 제한 초과 감지
 *
 * @param schedules - 고정 일정 배열
 * @param nodes - 노드 맵 (체류 시간 조회용)
 * @param maxDailyMinutes - 일일 최대 시간 (분)
 * @returns 충돌 목록
 */
export function detectDailyLimitConflicts(
  schedules: FixedSchedule[],
  nodes: Map<string, OptimizeNode>,
  maxDailyMinutes: number
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // 날짜별로 그룹화
  const byDate = new Map<string, FixedSchedule[]>();
  for (const schedule of schedules) {
    const existing = byDate.get(schedule.date) ?? [];
    existing.push(schedule);
    byDate.set(schedule.date, existing);
  }

  // 각 날짜별 총 시간 계산
  for (const [date, daySchedules] of byDate) {
    let totalMinutes = 0;

    for (const schedule of daySchedules) {
      const duration = getMinutesBetween(schedule.startTime, schedule.endTime);
      totalMinutes += duration;
    }

    if (totalMinutes > maxDailyMinutes) {
      conflicts.push({
        type: "exceeds_daily_limit",
        scheduleIds: daySchedules.map((s) => s.id),
        date,
        message: `${date}의 고정 일정 총 시간(${totalMinutes}분)이 일일 제한(${maxDailyMinutes}분)을 초과합니다.`,
      });
    }
  }

  return conflicts;
}

// ============================================
// Constraint Validation
// ============================================

/**
 * 고정 일정의 유효성 검증
 *
 * @param schedules - 고정 일정 배열
 * @param options - 제약 옵션
 * @returns 검증 결과
 */
export function validateFixedSchedules(
  schedules: FixedSchedule[],
  options: ConstraintOptions
): ConstraintValidationResult {
  const conflicts: ScheduleConflict[] = [];
  const warnings: string[] = [];

  // 1. 날짜 범위 확인
  const tripDates = new Set(
    generateDateRange(
      options.startDate,
      getDaysBetween(options.startDate, options.endDate)
    )
  );

  for (const schedule of schedules) {
    if (!tripDates.has(schedule.date)) {
      warnings.push(
        `고정 일정 "${schedule.id}"의 날짜(${schedule.date})가 여행 기간 밖입니다.`
      );
    }
  }

  // 2. 일정 간 충돌 확인
  conflicts.push(...detectScheduleConflicts(schedules));

  // 3. 일일 시간 범위 확인
  conflicts.push(
    ...detectOutOfHoursConflicts(
      schedules,
      options.dailyStartTime,
      options.dailyEndTime
    )
  );

  // 4. 시간 역전 확인 (시작 > 종료)
  for (const schedule of schedules) {
    const start = timeToMinutes(schedule.startTime);
    const end = timeToMinutes(schedule.endTime);
    if (start >= end) {
      conflicts.push({
        type: "overlap",
        scheduleIds: [schedule.id],
        date: schedule.date,
        message: `고정 일정 "${schedule.id}"의 시작 시간(${schedule.startTime})이 종료 시간(${schedule.endTime})보다 늦거나 같습니다.`,
      });
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
    warnings,
  };
}

// ============================================
// Time Window Management
// ============================================

/**
 * 일자별 가용 시간 슬롯 계산
 *
 * @param schedules - 고정 일정 배열
 * @param options - 제약 옵션
 * @returns 일자별 제약 정보
 */
export function calculateDailyConstraints(
  schedules: FixedSchedule[],
  options: ConstraintOptions
): Map<string, DailyConstraints> {
  const result = new Map<string, DailyConstraints>();

  const dayStart = timeToMinutes(options.dailyStartTime);
  const dayEnd = timeToMinutes(options.dailyEndTime);

  // 모든 날짜 초기화
  const dates = generateDateRange(
    options.startDate,
    getDaysBetween(options.startDate, options.endDate)
  );

  for (const date of dates) {
    result.set(date, {
      date,
      dayStart,
      dayEnd,
      fixedSlots: [],
      availableSlots: [{ start: dayStart, end: dayEnd }],
    });
  }

  // 고정 일정 추가
  for (const schedule of schedules) {
    const dayConstraints = result.get(schedule.date);
    if (!dayConstraints) continue;

    const fixedSlot: TimeSlot = {
      start: timeToMinutes(schedule.startTime),
      end: timeToMinutes(schedule.endTime),
      placeId: schedule.placeId,
      scheduleId: schedule.id,
    };

    dayConstraints.fixedSlots.push(fixedSlot);
  }

  // 가용 시간 슬롯 재계산
  for (const [, dayConstraints] of result) {
    if (dayConstraints.fixedSlots.length === 0) continue;

    // 고정 슬롯 정렬
    dayConstraints.fixedSlots.sort((a, b) => a.start - b.start);

    // 가용 슬롯 재계산
    const available: TimeSlot[] = [];
    let currentStart = dayStart;

    for (const fixed of dayConstraints.fixedSlots) {
      if (fixed.start > currentStart) {
        available.push({ start: currentStart, end: fixed.start });
      }
      currentStart = Math.max(currentStart, fixed.end);
    }

    if (currentStart < dayEnd) {
      available.push({ start: currentStart, end: dayEnd });
    }

    dayConstraints.availableSlots = available;
  }

  return result;
}

/**
 * 특정 시간에 배치 가능한지 확인
 *
 * @param date - 날짜
 * @param startMinute - 시작 시간 (분)
 * @param durationMinutes - 소요 시간 (분)
 * @param constraints - 일자별 제약 정보
 * @returns 배치 가능 여부
 */
export function canPlaceAt(
  date: string,
  startMinute: number,
  durationMinutes: number,
  constraints: Map<string, DailyConstraints>
): boolean {
  const dayConstraints = constraints.get(date);
  if (!dayConstraints) return false;

  const endMinute = startMinute + durationMinutes;
  const slot: TimeSlot = { start: startMinute, end: endMinute };

  // 일과 시간 범위 확인
  if (startMinute < dayConstraints.dayStart || endMinute > dayConstraints.dayEnd) {
    return false;
  }

  // 고정 일정과 충돌 확인
  for (const fixed of dayConstraints.fixedSlots) {
    if (slotsOverlap(slot, fixed)) {
      return false;
    }
  }

  return true;
}

/**
 * 가용 시간 슬롯 중 가장 적합한 시간 찾기
 *
 * @param date - 날짜
 * @param durationMinutes - 필요한 시간 (분)
 * @param preferredStart - 선호 시작 시간 (분)
 * @param constraints - 일자별 제약 정보
 * @returns 시작 시간 (분) 또는 null
 */
export function findAvailableSlot(
  date: string,
  durationMinutes: number,
  preferredStart: number,
  constraints: Map<string, DailyConstraints>
): number | null {
  const dayConstraints = constraints.get(date);
  if (!dayConstraints) return null;

  // 선호 시간 이후의 가용 슬롯 찾기
  for (const slot of dayConstraints.availableSlots) {
    const actualStart = Math.max(slot.start, preferredStart);
    if (actualStart + durationMinutes <= slot.end) {
      return actualStart;
    }
  }

  // 선호 시간 이전의 가용 슬롯도 확인
  for (const slot of dayConstraints.availableSlots) {
    if (slot.end <= preferredStart) {
      if (slot.end - slot.start >= durationMinutes) {
        return slot.start;
      }
    }
  }

  return null;
}

// ============================================
// Node Conversion
// ============================================

/**
 * 고정 일정을 OptimizeNode로 변환
 *
 * @param schedule - 고정 일정
 * @param place - 장소 정보
 * @returns OptimizeNode
 */
export function fixedScheduleToNode(
  schedule: FixedSchedule,
  place: { id: string; name: string; coordinate: { lat: number; lng: number } }
): OptimizeNode {
  const duration = getMinutesBetween(schedule.startTime, schedule.endTime);

  return {
    id: place.id,
    name: place.name,
    coordinate: place.coordinate,
    duration,
    priority: 0, // 고정 일정은 최고 우선순위
    isFixed: true,
    fixedDate: schedule.date,
    fixedStartTime: schedule.startTime,
    fixedEndTime: schedule.endTime,
  };
}

/**
 * 특정 날짜의 총 고정 일정 시간 계산
 *
 * @param date - 날짜
 * @param schedules - 고정 일정 배열
 * @returns 총 시간 (분)
 */
export function getTotalFixedMinutes(
  date: string,
  schedules: FixedSchedule[]
): number {
  return schedules
    .filter((s) => s.date === date)
    .reduce((sum, s) => sum + getMinutesBetween(s.startTime, s.endTime), 0);
}

/**
 * 특정 날짜의 가용 시간 계산
 *
 * @param date - 날짜
 * @param schedules - 고정 일정 배열
 * @param dailyStartTime - 일일 시작 시간
 * @param dailyEndTime - 일일 종료 시간
 * @returns 가용 시간 (분)
 */
export function getAvailableMinutes(
  date: string,
  schedules: FixedSchedule[],
  dailyStartTime: string,
  dailyEndTime: string
): number {
  const totalDayMinutes = getMinutesBetween(dailyStartTime, dailyEndTime);
  const fixedMinutes = getTotalFixedMinutes(date, schedules);
  return Math.max(0, totalDayMinutes - fixedMinutes);
}
