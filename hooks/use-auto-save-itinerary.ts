/**
 * @file use-auto-save-itinerary.ts
 * @description 일정 자동 저장 Hook
 *
 * 편집 모드에서 일정이 변경될 때마다 자동으로 저장하는 Hook입니다.
 * Debounce를 적용하여 불필요한 저장 요청을 최소화합니다.
 *
 * 주요 기능:
 * 1. 변경사항 감지 (deep comparison)
 * 2. Debounce (500ms)
 * 3. updateDayItinerary 호출 (각 일차별로)
 * 4. 저장 상태 관리 (saving, saved, error)
 *
 * 핵심 구현 로직:
 * - useEffect로 변경사항 감지
 * - setTimeout으로 Debounce 구현
 * - cleanup 함수로 타이머 정리 필수
 *
 * @dependencies
 * - react: useEffect, useState, useCallback, useRef
 * - @/actions/itinerary/update-itinerary: updateDayItinerary
 * - @/types/schedule: DailyItinerary
 *
 * @see {@link hooks/use-debounce.ts} - Debounce 유틸리티 (참고)
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { DailyItinerary } from "@/types/schedule";
import { updateDayItinerary } from "@/actions/itinerary/update-itinerary";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

export interface UseAutoSaveItineraryResult {
  saveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: Date;
  save: () => Promise<void>;
}

/**
 * 일정 자동 저장 Hook
 *
 * @param tripId - 여행 ID
 * @param itineraries - 저장할 일정 배열
 * @param isEditMode - 편집 모드 여부 (편집 모드일 때만 자동 저장)
 * @returns 저장 상태 및 저장 함수
 */
export function useAutoSaveItinerary(
  tripId: string,
  itineraries: DailyItinerary[],
  isEditMode: boolean = true,
): UseAutoSaveItineraryResult {
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousItinerariesRef = useRef<DailyItinerary[]>(itineraries);

  /**
   * 두 일정 배열이 같은지 비교 (간단한 비교)
   */
  const areItinerariesEqual = useCallback(
    (a: DailyItinerary[], b: DailyItinerary[]): boolean => {
      if (a.length !== b.length) return false;

      for (let i = 0; i < a.length; i++) {
        const dayA = a[i];
        const dayB = b[i];

        if (
          dayA.dayNumber !== dayB.dayNumber ||
          dayA.schedule.length !== dayB.schedule.length
        ) {
          return false;
        }

        // 각 일정 항목 비교 (간단한 비교)
        for (let j = 0; j < dayA.schedule.length; j++) {
          const itemA = dayA.schedule[j];
          const itemB = dayB.schedule[j];

          if (
            itemA.placeId !== itemB.placeId ||
            itemA.order !== itemB.order ||
            itemA.arrivalTime !== itemB.arrivalTime ||
            itemA.departureTime !== itemB.departureTime ||
            itemA.duration !== itemB.duration
          ) {
            return false;
          }
        }
      }

      return true;
    },
    [],
  );

  /**
   * 저장 함수
   */
  const save = useCallback(async () => {
    if (!tripId || itineraries.length === 0) {
      return;
    }

    setSaveStatus("saving");

    try {
      // 각 일차별로 저장
      const savePromises = itineraries.map((itinerary) =>
        updateDayItinerary({
          tripId,
          dayNumber: itinerary.dayNumber,
          schedule: itinerary.schedule,
          totalDistance: itinerary.totalDistance,
          totalDuration: itinerary.totalDuration,
          totalStayDuration: itinerary.totalStayDuration,
        }),
      );

      const results = await Promise.all(savePromises);

      // 모든 저장이 성공했는지 확인
      const allSuccess = results.every((result) => result.success);

      if (allSuccess) {
        setSaveStatus("saved");
        setLastSavedAt(new Date());

        // 2초 후 idle 상태로 변경
        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } else {
        const errorMessages = results
          .filter((result) => !result.success)
          .map((result) => result.error)
          .filter(Boolean)
          .join(", ");

        setSaveStatus("error");
        console.error("일정 저장 실패:", errorMessages);
        showErrorToast(`일정 저장 실패: ${errorMessages}`);
      }
    } catch (error) {
      setSaveStatus("error");
      console.error("일정 저장 중 예외 발생:", error);
      showErrorToast("일정 저장 중 오류가 발생했습니다.");
    }
  }, [tripId, itineraries]);

  /**
   * 변경사항 감지 및 Debounce 저장
   */
  useEffect(() => {
    // 편집 모드가 아니면 자동 저장하지 않음
    if (!isEditMode) {
      return;
    }

    // 초기 로드 시에는 저장하지 않음
    if (
      previousItinerariesRef.current.length === 0 &&
      itineraries.length > 0
    ) {
      previousItinerariesRef.current = itineraries;
      return;
    }

    // 변경사항이 없으면 저장하지 않음
    if (areItinerariesEqual(previousItinerariesRef.current, itineraries)) {
      return;
    }

    // 이전 타이머 정리
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce 타이머 설정 (500ms)
    debounceTimerRef.current = setTimeout(() => {
      save();
      previousItinerariesRef.current = itineraries;
    }, 500);

    // Cleanup 함수
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [itineraries, save, areItinerariesEqual, isEditMode]);

  return {
    saveStatus,
    lastSavedAt,
    save,
  };
}

