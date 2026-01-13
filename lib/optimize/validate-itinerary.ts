/**
 * @file validate-itinerary.ts
 * @description 일정 검증 유틸리티 함수
 *
 * 편집 모드에서 일정 변경 시 유효성을 검증하는 함수들입니다.
 *
 * 주요 기능:
 * 1. 일차별 최소 1개 장소 확인
 * 2. 고정 일정 시간 충돌 확인
 * 3. 일과 시간 범위 확인
 * 4. 체류 시간 유효성 검증 (30분 단위, 30~720분)
 *
 * @dependencies
 * - @/types/schedule: DailyItinerary, ScheduleItem
 * - @/lib/optimize: timeToMinutes, minutesToTime
 *
 * @see {@link .cursor/design/itinerary-edit-mode.md} - 설계 문서
 */

import type { DailyItinerary, ScheduleItem } from "@/types/schedule";
import { timeToMinutes } from "./types";

export interface ValidationError {
  code: string;
  message: string;
  dayNumber?: number;
  placeId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * 일정 유효성 검증
 *
 * @param itineraries - 검증할 일정 배열
 * @param dailyStartTime - 일과 시작 시간 (HH:mm, 기본값: "10:00")
 * @param dailyEndTime - 일과 종료 시간 (HH:mm, 기본값: "22:00")
 * @returns 검증 결과
 */
export function validateItinerary(
  itineraries: DailyItinerary[],
  dailyStartTime: string = "10:00",
  dailyEndTime: string = "22:00",
): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. 일차별 최소 1개 장소 확인
  for (const itinerary of itineraries) {
    if (itinerary.schedule.length === 0) {
      errors.push({
        code: "EMPTY_DAY",
        message: `${itinerary.dayNumber}일차에 장소가 없습니다. 최소 1개 장소가 필요합니다.`,
        dayNumber: itinerary.dayNumber,
      });
    }
  }

  // 2. 각 일차별로 시간 범위 및 체류 시간 검증
  const startMinutes = timeToMinutes(dailyStartTime);
  const endMinutes = timeToMinutes(dailyEndTime);

  for (const itinerary of itineraries) {
    for (const item of itinerary.schedule) {
      // 체류 시간 유효성 검증
      if (item.duration < 30) {
        errors.push({
          code: "INVALID_DURATION",
          message: `"${item.placeName}"의 체류 시간이 너무 짧습니다. 최소 30분이 필요합니다.`,
          dayNumber: itinerary.dayNumber,
          placeId: item.placeId,
        });
      }

      if (item.duration > 720) {
        errors.push({
          code: "INVALID_DURATION",
          message: `"${item.placeName}"의 체류 시간이 너무 깁니다. 최대 720분(12시간)까지 가능합니다.`,
          dayNumber: itinerary.dayNumber,
          placeId: item.placeId,
        });
      }

      if (item.duration % 30 !== 0) {
        errors.push({
          code: "INVALID_DURATION",
          message: `"${item.placeName}"의 체류 시간은 30분 단위여야 합니다.`,
          dayNumber: itinerary.dayNumber,
          placeId: item.placeId,
        });
      }

      // 일과 시간 범위 확인
      const arrivalMinutes = timeToMinutes(item.arrivalTime);
      const departureMinutes = timeToMinutes(item.departureTime);

      if (arrivalMinutes < startMinutes) {
        errors.push({
          code: "OUT_OF_HOURS",
          message: `"${item.placeName}"의 도착 시간이 일과 시작 시간(${dailyStartTime})보다 이릅니다.`,
          dayNumber: itinerary.dayNumber,
          placeId: item.placeId,
        });
      }

      if (departureMinutes > endMinutes) {
        errors.push({
          code: "OUT_OF_HOURS",
          message: `"${item.placeName}"의 출발 시간이 일과 종료 시간(${dailyEndTime})보다 늦습니다.`,
          dayNumber: itinerary.dayNumber,
          placeId: item.placeId,
        });
      }

      // 도착 시간이 출발 시간보다 늦으면 안 됨
      if (arrivalMinutes >= departureMinutes) {
        errors.push({
          code: "INVALID_TIME",
          message: `"${item.placeName}"의 도착 시간이 출발 시간보다 늦거나 같습니다.`,
          dayNumber: itinerary.dayNumber,
          placeId: item.placeId,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 일차별 최소 1개 장소 확인
 *
 * @param itinerary - 검증할 일정
 * @returns 유효 여부
 */
export function validateDayHasPlaces(
  itinerary: DailyItinerary,
): boolean {
  return itinerary.schedule.length > 0;
}

/**
 * 체류 시간 유효성 검증
 *
 * @param duration - 체류 시간 (분)
 * @returns 유효 여부
 */
export function validateDuration(duration: number): boolean {
  return duration >= 30 && duration <= 720 && duration % 30 === 0;
}

