/**
 * @file recalculate-time.ts
 * @description 일정 시간 재계산 유틸리티 함수
 *
 * 편집 모드에서 장소 순서가 변경되었을 때, 기존 이동 시간 데이터를 재사용하여
 * 새로운 도착/출발 시간을 계산합니다.
 *
 * 주요 기능:
 * 1. 각 일차별로 순회하며 시간 재계산
 * 2. dayOrigin 또는 첫 장소부터 시작
 * 3. 각 장소의 도착 시간 = 이전 장소 출발 시간 + 이동 시간
 * 4. 출발 시간 = 도착 시간 + 체류 시간
 * 5. dailyStartTime, dailyEndTime 업데이트
 *
 * 핵심 구현 로직:
 * - 기존 transportToNext 정보를 최대한 재사용
 * - dayOrigin, dayDestination 처리 포함
 * - dailyStartTime, dailyEndTime 고려
 *
 * @dependencies
 * - @/types/schedule: DailyItinerary, ScheduleItem, RouteSegment
 * - @/lib/optimize: normalizeTime, timeToMinutes, minutesToTime, addMinutesToTime
 *
 * @see {@link .cursor/design/itinerary-edit-mode.md} - 설계 문서
 */

import type { DailyItinerary, ScheduleItem } from "@/types/schedule";
import {
  normalizeTime,
  timeToMinutes,
  minutesToTime,
  addMinutesToTime,
} from "./types";

/**
 * 일정 시간 재계산
 *
 * @param itineraries - 재계산할 일정 배열
 * @param dailyStartTime - 일과 시작 시간 (HH:mm, 기본값: "10:00")
 * @param dailyEndTime - 일과 종료 시간 (HH:mm, 기본값: "22:00")
 * @returns 시간이 재계산된 일정 배열
 */
export function recalculateItineraryTimes(
  itineraries: DailyItinerary[],
  dailyStartTime: string = "10:00",
  dailyEndTime: string = "22:00",
): DailyItinerary[] {
  return itineraries.map((itinerary) => {
    const normalizedStartTime = normalizeTime(
      itinerary.dailyStartTime || dailyStartTime,
    );
    const normalizedEndTime = normalizeTime(
      itinerary.dailyEndTime || dailyEndTime,
    );

    // 일정이 비어있으면 그대로 반환
    if (itinerary.schedule.length === 0) {
      return {
        ...itinerary,
        startTime: normalizedStartTime,
        endTime: normalizedStartTime,
        dailyStartTime: normalizedStartTime,
        dailyEndTime: normalizedEndTime,
      };
    }

    // 첫 장소의 시작 시간 결정
    // dayOrigin이 있으면 transportFromOrigin의 이동 시간을 고려
    let currentTime = normalizedStartTime;
    if (itinerary.transportFromOrigin) {
      // 출발지에서 첫 장소까지 이동 시간 추가
      currentTime = addMinutesToTime(
        currentTime,
        itinerary.transportFromOrigin.duration,
      );
    }

    // 각 장소별로 시간 재계산
    const recalculatedSchedule: ScheduleItem[] = itinerary.schedule.map(
      (item, index) => {
        // 도착 시간 = 현재 시간
        const arrivalTime = normalizeTime(currentTime);

        // 출발 시간 = 도착 시간 + 체류 시간
        const departureTime = normalizeTime(
          addMinutesToTime(arrivalTime, item.duration),
        );

        // 다음 장소로 이동 시간 추가 (마지막 항목 제외)
        if (index < itinerary.schedule.length - 1 && item.transportToNext) {
          currentTime = addMinutesToTime(
            departureTime,
            item.transportToNext.duration,
          );
        }

        return {
          ...item,
          arrivalTime,
          departureTime,
        };
      },
    );

    // 마지막 장소의 출발 시간이 일과 종료 시간을 초과하는지 확인
    const lastItem = recalculatedSchedule[recalculatedSchedule.length - 1];
    const lastDepartureMinutes = timeToMinutes(lastItem.departureTime);
    const endTimeMinutes = timeToMinutes(normalizedEndTime);

    // 일과 종료 시간 계산
    let finalEndTime = lastItem.departureTime;
    if (itinerary.transportToDestination) {
      // 마지막 장소에서 도착지까지 이동 시간 추가
      finalEndTime = addMinutesToTime(
        lastItem.departureTime,
        itinerary.transportToDestination.duration,
      );
    }

    // 총 이동 거리 및 시간 재계산
    let totalDistance = 0;
    let totalDuration = 0;

    // transportFromOrigin 거리/시간 추가
    if (itinerary.transportFromOrigin) {
      totalDistance += itinerary.transportFromOrigin.distance || 0;
      totalDuration += itinerary.transportFromOrigin.duration;
    }

    // 각 장소 간 이동 거리/시간 추가
    recalculatedSchedule.forEach((item) => {
      if (item.transportToNext) {
        totalDistance += item.transportToNext.distance || 0;
        totalDuration += item.transportToNext.duration;
      }
    });

    // transportToDestination 거리/시간 추가
    if (itinerary.transportToDestination) {
      totalDistance += itinerary.transportToDestination.distance || 0;
      totalDuration += itinerary.transportToDestination.duration;
    }

    // 총 체류 시간 계산
    const totalStayDuration = recalculatedSchedule.reduce(
      (sum, item) => sum + item.duration,
      0,
    );

    return {
      ...itinerary,
      schedule: recalculatedSchedule,
      startTime: recalculatedSchedule[0]?.arrivalTime || normalizedStartTime,
      endTime: finalEndTime,
      totalDistance,
      totalDuration,
      totalStayDuration,
      dailyStartTime: normalizedStartTime,
      dailyEndTime: normalizedEndTime,
    };
  });
}

